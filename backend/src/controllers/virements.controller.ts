// backend/src/controllers/virements.controller.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { sendSms } from '../utils/sms';
import { notifier, emailTpl } from '../utils/notifications';
import { generateRef, hashCode, verifyHashedCode } from '../utils/crypto';
import { codeAutorise, codeEchec, codeSucces } from '../utils/rateLimits';
import { fCFA, parsePage, parseLimit } from '../utils/format';

function genOTP() { return crypto.randomInt(100000, 1000000).toString(); }

function validerMontant(montant: any): number | null {
  const n = Number(montant);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

class ErreurVirement extends Error {}

export async function initierVirement(req: Request, res: Response) {
  try {
    const { ribDest, montant, motif } = req.body;
    if (!ribDest || !montant) return res.status(400).json({ error:'RIB destinataire et montant requis' });
    const montantNum = validerMontant(montant);
    if (montantNum === null) return res.status(400).json({ error:'Montant invalide' });
    if (montantNum < 100) return res.status(400).json({ error:'Montant minimum : 100 F' });

    const compteSource = await prisma.compte.findUnique({
      where:   { userId:req.user!.userId },
      include: { user:{ select:{ nom:true, prenom:true, telephone:true, whatsapp:true, email:true, notifWhatsapp:true, notifEmail:true } } }
    });
    if (!compteSource) return res.status(404).json({ error:'Compte introuvable' });
    if (compteSource.statut !== 'ACTIF') return res.status(403).json({ error:'Votre compte n\'est pas actif' });
    if (Number(compteSource.solde) < montantNum)
      return res.status(400).json({ error:`Solde insuffisant. Votre solde : ${fCFA(Number(compteSource.solde))}` });

    const compteDest = await prisma.compte.findUnique({
      where:   { rib:ribDest.trim().toUpperCase() },
      include: { user:{ select:{ nom:true, prenom:true } } }
    });
    if (!compteDest) return res.status(404).json({ error:`Aucun compte LCP trouvé avec le RIB : ${ribDest}` });
    if (compteDest.statut !== 'ACTIF') return res.status(400).json({ error:'Le compte destinataire n\'est pas actif' });
    if (compteDest.id === compteSource.id) return res.status(400).json({ error:'Vous ne pouvez pas vous virer à vous-même' });

    const otp      = genOTP();
    const expireAt = new Date(Date.now() + 10 * 60 * 1000);

    const virement = await prisma.virement.create({
      data:{ reference:generateRef('VIR'), compteSourceId:compteSource.id, compteDestId:compteDest.id, montant:montantNum, motif:motif||'', statut:'EN_ATTENTE', codeConfirm:hashCode(otp), codeExpireAt:expireAt }
    });

    // SMS OTP
    sendSms({ to:compteSource.user.telephone, message:`SEMENCE EPARGNE LCP: Code confirmation virement: ${otp}. Valable 10 min. Virement de ${fCFA(montantNum)} vers ${compteDest.user.prenom} ${compteDest.user.nom}. Ne communiquez jamais ce code.`, userId:req.user!.userId }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Code OTP envoyé par SMS. Confirmez le virement.',
      data: {
        virementId:   virement.id,
        reference:    virement.reference,
        montant:      montantNum,
        motif:        motif || '',
        expireAt:     expireAt.toISOString(),
        destinataire: { rib:ribDest, nom:compteDest.user.nom, prenom:compteDest.user.prenom, compte:compteDest.numeroCompte }
      }
    });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

export async function confirmerVirement(req: Request, res: Response) {
  try {
    const { virementId, codeOtp } = req.body;
    if (!virementId || !codeOtp) return res.status(400).json({ error:'virementId et codeOtp requis' });

    const virement = await prisma.virement.findUnique({
      where:   { id:virementId },
      include: {
        compteSource: { include:{ user:{ select:{ id:true, nom:true, prenom:true, telephone:true, whatsapp:true, email:true, notifWhatsapp:true, notifEmail:true } } } },
        compteDest:   { include:{ user:{ select:{ id:true, nom:true, prenom:true, telephone:true, whatsapp:true, email:true, notifWhatsapp:true, notifEmail:true } } } },
      }
    });
    if (!virement) return res.status(404).json({ error:'Virement introuvable' });
    if (virement.compteSource.userId !== req.user!.userId) return res.status(403).json({ error:'Ce virement ne vous appartient pas' });
    if (virement.statut !== 'EN_ATTENTE') return res.status(400).json({ error:`Virement déjà ${virement.statut.toLowerCase()}` });
    if (virement.codeExpireAt && new Date() > virement.codeExpireAt) return res.status(400).json({ error:'Code OTP expiré. Recommencez.' });
    if (!codeAutorise(`virement:${virementId}`)) return res.status(429).json({ error:'Trop de tentatives. Réessayez dans 15 minutes.' });
    if (!virement.codeConfirm || !verifyHashedCode(String(codeOtp), virement.codeConfirm)) {
      codeEchec(`virement:${virementId}`);
      return res.status(400).json({ error:'Code OTP incorrect' });
    }
    codeSucces(`virement:${virementId}`);

    const montant = Number(virement.montant);

    // [SÉCURITÉ] Traitement atomique : claim conditionnel + débit/crédit dans la même
    // transaction. Deux confirmations concurrentes : la première gagne, la seconde
    // reçoit "déjà traité" (élimine le double-débit / double-crédit).
    try {
      await prisma.$transaction(async (tx) => {
        const claim = await tx.virement.updateMany({
          where: { id: virementId, statut: 'EN_ATTENTE', codeConfirm: virement.codeConfirm },
          data:   { statut: 'VALIDE', codeConfirm: null, traiteLe: new Date() },
        });
        if (claim.count !== 1) throw new ErreurVirement('Virement déjà traité');

        // Re-vérification du solde dans la transaction (données à jour)
        const source = await tx.compte.findUnique({ where:{ id:virement.compteSourceId }, select:{ solde:true } });
        if (!source || Number(source.solde) < montant) {
          throw new ErreurVirement(`Solde insuffisant. Solde : ${fCFA(Number(source?.solde || 0))}`);
        }

        await tx.compte.update({ where:{ id:virement.compteSourceId }, data:{ solde:{ decrement:montant } } });
        await tx.compte.update({ where:{ id:virement.compteDestId   }, data:{ solde:{ increment:montant } } });
        await tx.transaction.create({ data:{ reference:generateRef('TXN'), type:'VIREMENT_LCP', montant, frais:0, montantNet:-montant, statut:'SUCCES', compteId:virement.compteSourceId, description:`Virement vers ${virement.compteDest.user.prenom} ${virement.compteDest.user.nom} — ${virement.motif}`, metadata:{ virementId, sens:'DEBIT' } } });
        await tx.transaction.create({ data:{ reference:generateRef('TXN'), type:'VIREMENT_LCP', montant, frais:0, montantNet:montant, statut:'SUCCES', compteId:virement.compteDestId, description:`Virement de ${virement.compteSource.user.prenom} ${virement.compteSource.user.nom} — ${virement.motif}`, metadata:{ virementId, sens:'CREDIT' } } });
      });
    } catch (err: any) {
      if (err instanceof ErreurVirement) return res.status(409).json({ error: err.message });
      throw err;
    }

    await prisma.auditLog.create({ data:{ action:'VIREMENT_LCP', entite:'Virement', entiteId:virement.id, actorId:req.user!.userId, details:{ montant } } });

    // Lecture des soldes à jour pour les notifications (éviter un solde périmé)
    const [srcFresh, dstFresh] = await Promise.all([
      prisma.compte.findUnique({ where:{ id:virement.compteSourceId }, select:{ solde:true } }),
      prisma.compte.findUnique({ where:{ id:virement.compteDestId },   select:{ solde:true } }),
    ]);
    const soldeNouveau = Number(srcFresh?.solde ?? 0);
    const soldeDest    = Number(dstFresh?.solde ?? 0);

    // Notif expéditeur
    const src = virement.compteSource.user;
    const dst = virement.compteDest.user;
    const tplSrc = emailTpl.virementEnvoye(`${src.prenom} ${src.nom}`, virement.reference, montant, `${dst.prenom} ${dst.nom}`, soldeNouveau);
    notifier({ userId:src.id, telephone:src.telephone, whatsapp:src.whatsapp, email:src.email, notifWhatsapp:src.notifWhatsapp, notifEmail:src.notifEmail,
      messageSms:`LCP SEMENCE: Virement de ${fCFA(montant)} effectué vers ${dst.prenom} ${dst.nom}. Nouveau solde: ${fCFA(soldeNouveau)}.`,
      sujetEmail:tplSrc.sujet, htmlEmail:tplSrc.html }).catch(() => {});

    // Notif destinataire
    const tplDst = emailTpl.virementRecu(`${dst.prenom} ${dst.nom}`, virement.reference, montant, `${src.prenom} ${src.nom}`, soldeDest);
    notifier({ userId:dst.id, telephone:dst.telephone, whatsapp:dst.whatsapp, email:dst.email, notifWhatsapp:dst.notifWhatsapp, notifEmail:dst.notifEmail,
      messageSms:`LCP SEMENCE: Reçu ${fCFA(montant)} de ${src.prenom} ${src.nom}. Motif: ${virement.motif||'Virement LCP'}.`,
      sujetEmail:tplDst.sujet, htmlEmail:tplDst.html }).catch(() => {});

    return res.json({ success:true, message:'Virement effectué !', data:{ reference:virement.reference, montant, motif:virement.motif, soldeNouveau, destinataire:{ nom:dst.nom, prenom:dst.prenom, compte:virement.compteDest.numeroCompte } } });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

export async function annulerVirement(req: Request, res: Response) {
  try {
    const virement = await prisma.virement.findUnique({ where:{ id:req.params.virementId } });
    if (!virement) return res.status(404).json({ error:'Virement introuvable' });

    // [SÉCURITÉ] Seul le propriétaire (compte source) ou un admin peut annuler
    const compte = await prisma.compte.findUnique({ where:{ userId:req.user!.userId }, select:{ id:true } });
    if (virement.compteSourceId !== compte?.id && !['MASTER','SUPER_ADMIN'].includes(req.user!.role))
      return res.status(403).json({ error:'Ce virement ne vous appartient pas' });

    // Claim conditionnel — empêche d'annuler un virement déjà traité (course)
    const maj = await prisma.virement.updateMany({
      where: { id:req.params.virementId, statut:'EN_ATTENTE' },
      data:  { statut:'ANNULE' },
    });
    if (maj.count !== 1) return res.status(409).json({ error:'Ce virement ne peut plus être annulé' });
    return res.json({ success:true, message:'Virement annulé' });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

export async function mesVirements(req: Request, res: Response) {
  try {
    const compte = await prisma.compte.findUnique({ where:{ userId:req.user!.userId } });
    if (!compte) return res.status(404).json({ error:'Compte introuvable' });
    const page  = parsePage(req.query.page as string);
    const limit = parseLimit(req.query.limit as string);
    const [total, virements] = await Promise.all([
      prisma.virement.count({ where:{ OR:[{ compteSourceId:compte.id },{ compteDestId:compte.id }] } }),
      prisma.virement.findMany({ where:{ OR:[{ compteSourceId:compte.id },{ compteDestId:compte.id }] }, skip:(page-1)*limit, take:limit, orderBy:{ createdAt:'desc' }, include:{ compteSource:{ include:{ user:{ select:{ nom:true, prenom:true } } } }, compteDest:{ include:{ user:{ select:{ nom:true, prenom:true } } } } } })
    ]);
    return res.json({ data:virements.map(v=>({ ...v, montant:Number(v.montant), sens:v.compteSourceId===compte.id?'DEBIT':'CREDIT' })), pagination:{ total, page, limit, pages:Math.ceil(total/limit) } });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

export async function rechercherParRib(req: Request, res: Response) {
  try {
    const { rib } = req.params;
    if (!rib || rib.length < 5) return res.status(400).json({ error:'RIB trop court' });
    const compte = await prisma.compte.findUnique({ where:{ rib:rib.trim().toUpperCase() }, select:{ numeroCompte:true, rib:true, statut:true, user:{ select:{ nom:true, prenom:true } } } });
    if (!compte) return res.status(404).json({ error:'Aucun compte LCP avec ce RIB' });
    if (compte.statut !== 'ACTIF') return res.status(400).json({ error:'Ce compte est inactif' });
    return res.json({ data:{ rib:compte.rib, numeroCompte:compte.numeroCompte, nom:compte.user.nom, prenom:compte.user.prenom } });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

export async function tousLesVirements(req: Request, res: Response) {
  try {
    const page   = parsePage(req.query.page as string);
    const limit  = parseLimit(req.query.limit as string);
    const statut = req.query.statut as string|undefined;
    const where: any = {};
    if (statut) where.statut = statut;
    const [total, virements] = await Promise.all([
      prisma.virement.count({ where }),
      prisma.virement.findMany({ where, skip:(page-1)*limit, take:limit, orderBy:{ createdAt:'desc' }, include:{ compteSource:{ include:{ user:{ select:{ nom:true, prenom:true, telephone:true } } } }, compteDest:{ include:{ user:{ select:{ nom:true, prenom:true, telephone:true } } } } } })
    ]);
    return res.json({ data:virements.map(v=>({ ...v, montant:Number(v.montant) })), pagination:{ total, page, limit, pages:Math.ceil(total/limit) } });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}
