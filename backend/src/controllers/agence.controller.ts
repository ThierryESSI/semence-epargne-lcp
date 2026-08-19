// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// ============================================================
// backend/src/controllers/agence.controller.ts
// Opérations financières en agence (conseiller/distributeur sur compte client)
// Dépôt, retrait, virement — tous tracés avec canal='AGENCE'

import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { sendSms, tpl } from '../utils/sms';
import { notifier, emailTpl } from '../utils/notifications';
import { clientAppartientA } from '../utils/acces';
import { generateRef, hashCode, verifyHashedCode } from '../utils/crypto';
import { fCFA } from '../utils/format';
import { codeAutorise, codeEchec, codeSucces } from '../utils/rateLimits';

function genOTP(): string { return crypto.randomInt(100000, 1000000).toString(); }

// ─── Vérifier que l'acteur a accès au client cible ──────────────────────
async function verifierAccesClient(clientUserId: string, role: string, actorUserId: string): Promise<boolean> {
  if (role === 'MASTER' || role === 'SUPER_ADMIN') return true;
  return clientAppartientA(clientUserId, role, actorUserId);
}

// ══════════════════════════════════════════════════════════════════════════
// DÉPÔT EN AGENCE (conseiller crédite le compte du client)
// ══════════════════════════════════════════════════════════════════════════
export async function depotEnAgence(req: Request, res: Response) {
  try {
    const { clientUserId, montant, motif } = req.body;
    if (!clientUserId || !montant)
      return res.status(400).json({ error: 'clientUserId et montant requis' });

    const montantNum = Number(montant);
    if (!Number.isFinite(montantNum) || montantNum <= 0)
      return res.status(400).json({ error: 'Montant invalide' });
    if (montantNum < 100)
      return res.status(400).json({ error: 'Montant minimum : 100 F' });

    // [SÉCURITÉ] Vérifier que l'acteur a accès à ce client
    if (!(await verifierAccesClient(clientUserId, req.user!.role, req.user!.userId)))
      return res.status(403).json({ error: 'Accès refusé : ce client ne fait pas partie de votre réseau' });

    const compte = await prisma.compte.findUnique({
      where: { userId: clientUserId },
      include: { user: { select: { id: true, nom: true, prenom: true, telephone: true, whatsapp: true, email: true, notifWhatsapp: true, notifEmail: true } } }
    });
    if (!compte) return res.status(404).json({ error: 'Compte client introuvable' });
    if (compte.statut !== 'ACTIF')
      return res.status(400).json({ error: 'Le compte client n\'est pas actif' });

    const frais = 0; // Dépôt en agence sans frais
    const net = montantNum;

    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          reference: generateRef('TXN'),
          type: 'DEPOT_AGENCE',
          montant: montantNum,
          frais,
          montantNet: net,
          statut: 'SUCCES',
          compteId: compte.id,
          description: `Dépôt en agence par ${req.user!.role} — ${motif || 'Dépôt agence'}`,
          metadata: { canal: 'AGENCE', actorId: req.user!.userId, motif }
        }
      }),
      prisma.compte.update({ where: { id: compte.id }, data: { solde: { increment: net } } }),
    ]);

    await prisma.auditLog.create({
      data: {
        action: 'DEPOT_AGENCE',
        entite: 'Transaction',
        entiteId: transaction.id,
        actorId: req.user!.userId,
        details: { clientUserId, montant: montantNum, frais, net, motif }
      }
    });

    // Notifications
    const user = compte.user;
    const compteUpdated = await prisma.compte.findUnique({ where: { id: compte.id } });
    const nouveauSolde = Number(compteUpdated?.solde);

    const msgSms = `LCP SEMENCE: Dépôt agence ${fCFA(montantNum)} reçu. Solde: ${fCFA(nouveauSolde)}. Ref: ${transaction.reference}`;
    const tplEmail = emailTpl.depotSucces(`${user.prenom} ${user.nom}`, transaction.reference, montantNum, net, nouveauSolde);
    notifier({
      userId: user.id, telephone: user.telephone, whatsapp: user.whatsapp,
      email: user.email?.includes('@semence-noemail.ci') ? null : user.email,
      notifWhatsapp: user.notifWhatsapp, notifEmail: user.notifEmail,
      messageSms: msgSms, sujetEmail: tplEmail.sujet, htmlEmail: tplEmail.html,
      transactionId: transaction.id,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: `Dépôt de ${fCFA(montantNum)} effectué sur le compte de ${user.prenom} ${user.nom}`,
      data: { transactionRef: transaction.reference, montant: montantNum, nouveauSolde, destinataire: { nom: user.nom, prenom: user.prenom, compte: compte.numeroCompte } }
    });
  } catch (err: any) {
    console.error('[depotEnAgence]', err.message);
    return res.status(500).json({ error: 'Erreur lors du dépôt en agence' });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// INITIER RETRAIT EN AGENCE (envoie OTP au client ou au conseiller)
// ══════════════════════════════════════════════════════════════════════════
export async function initierRetrait(req: Request, res: Response) {
  try {
    const { clientUserId, montant, motif, destinataire } = req.body;
    // destinataire: 'CLIENT' (OTP au client) | 'CONSEILLER' (OTP au conseiller)
    if (!clientUserId || !montant)
      return res.status(400).json({ error: 'clientUserId et montant requis' });

    const montantNum = Number(montant);
    if (!Number.isFinite(montantNum) || montantNum <= 0)
      return res.status(400).json({ error: 'Montant invalide' });
    if (montantNum < 100)
      return res.status(400).json({ error: 'Montant minimum : 100 F' });

    if (!(await verifierAccesClient(clientUserId, req.user!.role, req.user!.userId)))
      return res.status(403).json({ error: 'Accès refusé : ce client ne fait pas partie de votre réseau' });

    const compte = await prisma.compte.findUnique({
      where: { userId: clientUserId },
      include: { user: { select: { id: true, nom: true, prenom: true, telephone: true, whatsapp: true, email: true, notifWhatsapp: true, notifEmail: true } } }
    });
    if (!compte) return res.status(404).json({ error: 'Compte client introuvable' });
    if (compte.statut !== 'ACTIF')
      return res.status(400).json({ error: 'Le compte client n\'est pas actif' });
    if (Number(compte.solde) < montantNum)
      return res.status(400).json({ error: `Solde insuffisant. Solde client : ${fCFA(Number(compte.solde))}` });

    const otp = genOTP();
    const expireAt = new Date(Date.now() + 10 * 60 * 1000);

    // Créer le retrait en attente
    const retrait = await prisma.virement.create({
      data: {
        reference: generateRef('RET'),
        compteSourceId: compte.id,
        compteDestId: compte.id, // Même compte (retrait)
        montant: montantNum,
        motif: motif || 'Retrait en agence',
        statut: 'EN_ATTENTE',
        codeConfirm: hashCode(otp),
        codeExpireAt: expireAt,
      }
    });

    // Envoyer l'OTP selon la cible choisie
    const cible = destinataire === 'CONSEILLER' ? 'CONSEILLER' : 'CLIENT';
    const destinataireTelephone = cible === 'CLIENT'
      ? compte.user.telephone
      : req.user!.telephone;

    const msgOtp = `SEMENCE EPARGNE LCP: Code retrait ${fCFA(montantNum)}: ${otp}. Valable 10 min. Ne communiquez jamais ce code.`;
    sendSms({ to: destinataireTelephone, message: msgOtp, userId: cible === 'CLIENT' ? clientUserId : req.user!.userId }).catch(() => {});

    await prisma.auditLog.create({
      data: {
        action: 'INIT_RETRAIT_AGENCE',
        entite: 'Virement',
        entiteId: retrait.id,
        actorId: req.user!.userId,
        details: { clientUserId, montant: montantNum, destinataireOtp: cible, motif }
      }
    });

    return res.status(201).json({
      success: true,
      message: `Code OTP envoyé au ${cible === 'CLIENT' ? 'client' : 'conseiller'}. Attendez la confirmation.`,
      data: {
        retraitId: retrait.id,
        reference: retrait.reference,
        montant: montantNum,
        destinataire: { nom: compte.user.nom, prenom: compte.user.prenom, compte: compte.numeroCompte },
        otpEnvoyeA: cible,
        expireAt: expireAt.toISOString(),
      }
    });
  } catch (err: any) {
    console.error('[initierRetrait]', err.message);
    return res.status(500).json({ error: 'Erreur lors de l\'initiation du retrait' });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// CONFIRMER RETRAIT EN AGENCE (valide l'OTP et débite le compte)
// ══════════════════════════════════════════════════════════════════════════
export async function confirmerRetrait(req: Request, res: Response) {
  try {
    const { retraitId, codeOtp } = req.body;
    if (!retraitId || !codeOtp)
      return res.status(400).json({ error: 'retraitId et codeOtp requis' });

    const retrait = await prisma.virement.findUnique({
      where: { id: retraitId },
      include: {
        compteSource: { include: { user: { select: { id: true, nom: true, prenom: true, telephone: true, whatsapp: true, email: true, notifWhatsapp: true, notifEmail: true } } } }
      }
    });
    if (!retrait) return res.status(404).json({ error: 'Retrait introuvable' });
    if (retrait.statut !== 'EN_ATTENTE')
      return res.status(400).json({ error: `Retrait déjà ${retrait.statut.toLowerCase()}` });
    if (retrait.codeExpireAt && new Date() > retrait.codeExpireAt)
      return res.status(400).json({ error: 'Code OTP expiré. Recommencez.' });

    if (!codeAutorise(`retrait:${retraitId}`))
      return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });

    if (!retrait.codeConfirm || !verifyHashedCode(String(codeOtp), retrait.codeConfirm)) {
      codeEchec(`retrait:${retraitId}`);
      return res.status(400).json({ error: 'Code OTP incorrect' });
    }
    codeSucces(`retrait:${retraitId}`);

    const montant = Number(retrait.montant);

    // [SÉCURITÉ] Traitement atomique : claim conditionnel + débit
    try {
      await prisma.$transaction(async (tx) => {
        const claim = await tx.virement.updateMany({
          where: { id: retraitId, statut: 'EN_ATTENTE', codeConfirm: retrait.codeConfirm },
          data: { statut: 'VALIDE', codeConfirm: null, traiteLe: new Date() },
        });
        if (claim.count !== 1) throw new Error('Retrait déjà traité');

        const source = await tx.compte.findUnique({ where: { id: retrait.compteSourceId }, select: { solde: true } });
        if (!source || Number(source.solde) < montant)
          throw new Error(`Solde insuffisant. Solde : ${fCFA(Number(source?.solde || 0))}`);

        await tx.compte.update({ where: { id: retrait.compteSourceId }, data: { solde: { decrement: montant } } });
        await tx.transaction.create({
          data: {
            reference: generateRef('TXN'),
            type: 'RETRAIT_AGENCE',
            montant,
            frais: 0,
            montantNet: -montant,
            statut: 'SUCCES',
            compteId: retrait.compteSourceId,
            description: `Retrait en agence — ${retrait.motif}`,
            metadata: { canal: 'AGENCE', virementId: retraitId, actorId: req.user!.userId }
          }
        });
      });
    } catch (err: any) {
      return res.status(409).json({ error: err.message || 'Retrait déjà traité' });
    }

    await prisma.auditLog.create({
      data: {
        action: 'RETRAIT_AGENCE',
        entite: 'Virement',
        entiteId: retrait.id,
        actorId: req.user!.userId,
        details: { montant, clientUserId: retrait.compteSource.userId }
      }
    });

    // Notifications
    const user = retrait.compteSource.user;
    const compteUpdated = await prisma.compte.findUnique({ where: { id: retrait.compteSourceId } });
    const nouveauSolde = Number(compteUpdated?.solde);

    const msgSms = `LCP SEMENCE: Retrait agence ${fCFA(montant)}. Solde: ${fCFA(nouveauSolde)}. Ref: ${retrait.reference}`;
    notifier({
      userId: user.id, telephone: user.telephone, whatsapp: user.whatsapp,
      email: user.email?.includes('@semence-noemail.ci') ? null : user.email,
      notifWhatsapp: user.notifWhatsapp, notifEmail: user.notifEmail,
      messageSms: msgSms,
    }).catch(() => {});

    return res.json({
      success: true,
      message: `Retrait de ${fCFA(montant)} effectué`,
      data: { reference: retrait.reference, montant, nouveauSolde, client: { nom: user.nom, prenom: user.prenom, compte: retrait.compteSource.numeroCompte } }
    });
  } catch (err: any) {
    console.error('[confirmerRetrait]', err.message);
    return res.status(500).json({ error: 'Erreur lors de la confirmation du retrait' });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// INITIER VIREMENT EN AGENCE (d'un client vers un autre, avec OTP)
// ══════════════════════════════════════════════════════════════════════════
export async function initierVirement(req: Request, res: Response) {
  try {
    const { clientUserIdSource, ribDest, montant, motif, destinataire } = req.body;
    if (!clientUserIdSource || !ribDest || !montant)
      return res.status(400).json({ error: 'clientUserIdSource, ribDest et montant requis' });

    const montantNum = Number(montant);
    if (!Number.isFinite(montantNum) || montantNum <= 0)
      return res.status(400).json({ error: 'Montant invalide' });
    if (montantNum < 100)
      return res.status(400).json({ error: 'Montant minimum : 100 F' });

    if (!(await verifierAccesClient(clientUserIdSource, req.user!.role, req.user!.userId)))
      return res.status(403).json({ error: 'Accès refusé : ce client ne fait pas partie de votre réseau' });

    const compteSource = await prisma.compte.findUnique({
      where: { userId: clientUserIdSource },
      include: { user: { select: { id: true, nom: true, prenom: true, telephone: true, whatsapp: true, email: true, notifWhatsapp: true, notifEmail: true } } }
    });
    if (!compteSource) return res.status(404).json({ error: 'Compte source introuvable' });
    if (compteSource.statut !== 'ACTIF')
      return res.status(400).json({ error: 'Le compte source n\'est pas actif' });
    if (Number(compteSource.solde) < montantNum)
      return res.status(400).json({ error: `Solde insuffisant. Solde client : ${fCFA(Number(compteSource.solde))}` });

    const compteDest = await prisma.compte.findUnique({
      where: { rib: ribDest.trim().toUpperCase() },
      include: { user: { select: { nom: true, prenom: true } } }
    });
    if (!compteDest) return res.status(404).json({ error: `Aucun compte LCP trouvé avec le RIB : ${ribDest}` });
    if (compteDest.statut !== 'ACTIF')
      return res.status(400).json({ error: 'Le compte destinataire n\'est pas actif' });
    if (compteDest.id === compteSource.id)
      return res.status(400).json({ error: 'Impossible de virer à soi-même' });

    const otp = genOTP();
    const expireAt = new Date(Date.now() + 10 * 60 * 1000);

    const virement = await prisma.virement.create({
      data: {
        reference: generateRef('VIR'),
        compteSourceId: compteSource.id,
        compteDestId: compteDest.id,
        montant: montantNum,
        motif: motif || 'Virement en agence',
        statut: 'EN_ATTENTE',
        codeConfirm: hashCode(otp),
        codeExpireAt: expireAt,
      }
    });

    const cible = destinataire === 'CONSEILLER' ? 'CONSEILLER' : 'CLIENT';
    const destinataireTelephone = cible === 'CLIENT'
      ? compteSource.user.telephone
      : req.user!.telephone;

    const msgOtp = `SEMENCE EPARGNE LCP: Code virement ${fCFA(montantNum)} vers ${compteDest.user.prenom} ${compteDest.user.nom}: ${otp}. Valable 10 min.`;
    sendSms({ to: destinataireTelephone, message: msgOtp, userId: cible === 'CLIENT' ? clientUserIdSource : req.user!.userId }).catch(() => {});

    await prisma.auditLog.create({
      data: {
        action: 'INIT_VIREMENT_AGENCE',
        entite: 'Virement',
        entiteId: virement.id,
        actorId: req.user!.userId,
        details: { clientUserIdSource, montant: montantNum, ribDest, destinataireOtp: cible, motif }
      }
    });

    return res.status(201).json({
      success: true,
      message: `Code OTP envoyé au ${cible === 'CLIENT' ? 'client' : 'conseiller'}. Attendez la confirmation.`,
      data: {
        virementId: virement.id,
        reference: virement.reference,
        montant: montantNum,
        destinataire: { nom: compteDest.user.nom, prenom: compteDest.user.prenom, compte: compteDest.numeroCompte },
        client: { nom: compteSource.user.nom, prenom: compteSource.user.prenom, compte: compteSource.numeroCompte },
        otpEnvoyeA: cible,
        expireAt: expireAt.toISOString(),
      }
    });
  } catch (err: any) {
    console.error('[initierVirement]', err.message);
    return res.status(500).json({ error: 'Erreur lors de l\'initiation du virement' });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// CONFIRMER VIREMENT EN AGENCE
// ══════════════════════════════════════════════════════════════════════════
export async function confirmerVirement(req: Request, res: Response) {
  try {
    const { virementId, codeOtp } = req.body;
    if (!virementId || !codeOtp)
      return res.status(400).json({ error: 'virementId et codeOtp requis' });

    const virement = await prisma.virement.findUnique({
      where: { id: virementId },
      include: {
        compteSource: { include: { user: { select: { id: true, nom: true, prenom: true, telephone: true, whatsapp: true, email: true, notifWhatsapp: true, notifEmail: true } } } },
        compteDest: { include: { user: { select: { id: true, nom: true, prenom: true, telephone: true, whatsapp: true, email: true, notifWhatsapp: true, notifEmail: true } } } },
      }
    });
    if (!virement) return res.status(404).json({ error: 'Virement introuvable' });
    if (virement.compteSource.userId !== req.user!.userId && req.user!.role !== 'MASTER' && req.user!.role !== 'SUPER_ADMIN') {
      // Vérifier que l'acteur a accès au client source
      if (!(await verifierAccesClient(virement.compteSource.userId, req.user!.role, req.user!.userId)))
        return res.status(403).json({ error: 'Accès refusé' });
    }
    if (virement.statut !== 'EN_ATTENTE')
      return res.status(400).json({ error: `Virement déjà ${virement.statut.toLowerCase()}` });
    if (virement.codeExpireAt && new Date() > virement.codeExpireAt)
      return res.status(400).json({ error: 'Code OTP expiré. Recommencez.' });

    if (!codeAutorise(`virement-agence:${virementId}`))
      return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' });

    if (!virement.codeConfirm || !verifyHashedCode(String(codeOtp), virement.codeConfirm)) {
      codeEchec(`virement-agence:${virementId}`);
      return res.status(400).json({ error: 'Code OTP incorrect' });
    }
    codeSucces(`virement-agence:${virementId}`);

    const montant = Number(virement.montant);

    try {
      await prisma.$transaction(async (tx) => {
        const claim = await tx.virement.updateMany({
          where: { id: virementId, statut: 'EN_ATTENTE', codeConfirm: virement.codeConfirm },
          data: { statut: 'VALIDE', codeConfirm: null, traiteLe: new Date() },
        });
        if (claim.count !== 1) throw new Error('Virement déjà traité');

        const source = await tx.compte.findUnique({ where: { id: virement.compteSourceId }, select: { solde: true } });
        if (!source || Number(source.solde) < montant)
          throw new Error(`Solde insuffisant. Solde : ${fCFA(Number(source?.solde || 0))}`);

        await tx.compte.update({ where: { id: virement.compteSourceId }, data: { solde: { decrement: montant } } });
        await tx.compte.update({ where: { id: virement.compteDestId }, data: { solde: { increment: montant } } });
        await tx.transaction.create({
          data: {
            reference: generateRef('TXN'), type: 'VIREMENT_LCP', montant, frais: 0,
            montantNet: -montant, statut: 'SUCCES', compteId: virement.compteSourceId,
            description: `Virement agence vers ${virement.compteDest.user.prenom} ${virement.compteDest.user.nom} — ${virement.motif}`,
            metadata: { canal: 'AGENCE', virementId, sens: 'DEBIT', actorId: req.user!.userId }
          }
        });
        await tx.transaction.create({
          data: {
            reference: generateRef('TXN'), type: 'VIREMENT_LCP', montant, frais: 0,
            montantNet: montant, statut: 'SUCCES', compteId: virement.compteDestId,
            description: `Virement agence de ${virement.compteSource.user.prenom} ${virement.compteSource.user.nom} — ${virement.motif}`,
            metadata: { canal: 'AGENCE', virementId, sens: 'CREDIT' }
          }
        });
      });
    } catch (err: any) {
      return res.status(409).json({ error: err.message || 'Virement déjà traité' });
    }

    await prisma.auditLog.create({
      data: {
        action: 'VIREMENT_AGENCE',
        entite: 'Virement',
        entiteId: virement.id,
        actorId: req.user!.userId,
        details: { montant, clientUserIdSource: virement.compteSource.userId, clientUserIdDest: virement.compteDest.userId }
      }
    });

    // Notifications
    const [srcFresh, dstFresh] = await Promise.all([
      prisma.compte.findUnique({ where: { id: virement.compteSourceId }, select: { solde: true } }),
      prisma.compte.findUnique({ where: { id: virement.compteDestId }, select: { solde: true } }),
    ]);
    const src = virement.compteSource.user;
    const dst = virement.compteDest.user;

    notifier({
      userId: src.id, telephone: src.telephone, whatsapp: src.whatsapp,
      email: src.email?.includes('@semence-noemail.ci') ? null : src.email,
      notifWhatsapp: src.notifWhatsapp, notifEmail: src.notifEmail,
      messageSms: `LCP SEMENCE: Virement agence de ${fCFA(montant)} vers ${dst.prenom} ${dst.nom}. Nouveau solde: ${fCFA(Number(srcFresh?.solde))}.`,
    }).catch(() => {});

    notifier({
      userId: dst.id, telephone: dst.telephone, whatsapp: dst.whatsapp,
      email: dst.email?.includes('@semence-noemail.ci') ? null : dst.email,
      notifWhatsapp: dst.notifWhatsapp, notifEmail: dst.notifEmail,
      messageSms: `LCP SEMENCE: Reçu ${fCFA(montant)} de ${src.prenom} ${src.nom} (virement agence).`,
    }).catch(() => {});

    return res.json({
      success: true,
      message: `Virement de ${fCFA(montant)} effectué`,
      data: {
        reference: virement.reference, montant,
        soldeNouveau: Number(srcFresh?.solde),
        destinataire: { nom: dst.nom, prenom: dst.prenom, compte: virement.compteDest.numeroCompte }
      }
    });
  } catch (err: any) {
    console.error('[confirmerVirement]', err.message);
    return res.status(500).json({ error: 'Erreur lors de la confirmation du virement' });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// HISTORIQUE OPÉRATIONS AGENCE
// ══════════════════════════════════════════════════════════════════════════
export async function historiqueAgence(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');

    // Filtrer les transactions avec metadata.canal = 'AGENCE'
    const [total, transactions] = await Promise.all([
      prisma.transaction.count({ where: { metadata: { path: ['canal'], equals: 'AGENCE' } } }),
      prisma.transaction.findMany({
        where: { metadata: { path: ['canal'], equals: 'AGENCE' } },
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          compte: { include: { user: { select: { nom: true, prenom: true } } } },
          carte: { select: { reference: true, montant: true } },
        }
      })
    ]);

    return res.json({
      data: transactions,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err: any) {
    console.error('[historiqueAgence]', err.message);
    return res.status(500).json({ error: 'Erreur lors de la récupération de l\'historique' });
  }
}
