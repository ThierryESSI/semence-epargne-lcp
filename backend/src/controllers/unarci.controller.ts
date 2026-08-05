// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// ============================================================
// backend/src/controllers/unarci.controller.ts
// Adhésion UNARCI :
//  - Formulaire public → l'adhérent devient CLIENT sous l'agence UNARCI
//  - SMS automatique avec le numéro de paie LCP
//  - Le conseiller valide le paiement manuellement (statut → ACTIF)
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { generateRef, generateCodeActeur } from '../utils/crypto';
import { sendSms, tpl } from '../utils/sms';
import { ensureUnarciInfra, unarciConfig, generatePassword, UNARCI_CONST } from '../utils/unarci';

function fCFA(n: number): string { return new Intl.NumberFormat('fr-CI').format(Math.round(n)) + ' F'; }

// Candidats de numéro pour détecter un doublon (formats variés)
function candidatsTel(tel: string): string[] {
  const d = tel.replace(/\D/g, '');
  const out = [tel, d];
  if (d.startsWith('225') && d.length === 11) out.push('0' + d.slice(3));
  if (d.length === 10 && d.startsWith('0')) out.push('225' + d.slice(1));
  if (d.length === 8) { out.push('0' + d, '225' + d); }
  return out;
}

// ─── PUBLIC : soumettre le formulaire d'adhésion ──────────────────────
export async function adherer(req: Request, res: Response) {
  try {
    const cfg = await unarciConfig();
    if (cfg.UNARCI_ACTIF !== 'true')
      return res.status(403).json({ error:'Les adhésions UNARCI sont momentanément fermées' });

    const { nomComplet, telephone, email, region, ville } = req.body;
    if (!nomComplet || !telephone)
      return res.status(400).json({ error:'Nom complet et téléphone requis' });
    if (!region) return res.status(400).json({ error:'La région est requise' });
    const telDigits = String(telephone).replace(/\D/g, '');
    if (telDigits.length < 8) return res.status(400).json({ error:'Numéro de téléphone invalide' });

    // Doublon : téléphone ou email déjà utilisé
    const duplicata = await prisma.user.findFirst({ where:{ telephone:{ in:candidatsTel(String(telephone)) } } });
    if (duplicata) return res.status(409).json({ error:'Un compte existe déjà avec ce numéro de téléphone' });
    if (email) {
      const exEmail = await prisma.user.findUnique({ where:{ email:String(email).trim().toLowerCase() } });
      if (exEmail) return res.status(409).json({ error:'Cet email est déjà utilisé' });
    }
    const dejaAdherent = await prisma.adherentUnarci.findFirst({ where:{ nomComplet:String(nomComplet).trim(), statut:{ in:['INSCRIT','ACTIF'] } } });
    if (dejaAdherent) return res.status(409).json({ error:'Une adhésion est déjà en cours pour ce nom' });

    const { distributeurId, conseillerId } = await ensureUnarciInfra();

    // Compte CLIENT (inactif jusqu'à validation du paiement)
    const parts = String(nomComplet).trim().split(/\s+/);
    const prenom = parts[0];
    const nom    = parts.slice(1).join(' ').toUpperCase() || parts[0].toUpperCase();
    const telRaw = String(telephone).trim();
    const emailFinal = email
      ? String(email).trim().toLowerCase()
      : `${telDigits}@semence-noemail.ci`;
    const pwd   = generatePassword();
    const appUrl = process.env.FRONTEND_URL || 'https://app.semenceep.ci';

    const countClients = await prisma.client.count();
    const codeClient   = generateCodeActeur('CLI', countClients + 1);
    const numeroCompte = `SE-${generateRef('UNARCI').replace('-','').slice(-8)}`;

    const montant  = parseInt(cfg.UNARCI_ADHESION_MONTANT || UNARCI_CONST.MONTANT_DEFAUT) || 10000;
    const numeroPaie = cfg.UNARCI_PAIE_NUMERO || UNARCI_CONST.PAIE_NUMERO_DEFAUT;

    const adhesionRef = generateRef('UNARCI');

    const adhesion = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: emailFinal, telephone: telRaw,
          passwordHash: await bcrypt.hash(pwd, 12),
          nom, prenom, role:'CLIENT', actif:false,
        },
      });
      await tx.client.create({ data:{ code:codeClient, region:String(region).trim(), ville:String(ville || '').trim(), commune:req.body.commune || '', conseillerId, userId:user.id } });
      await tx.compte.create({ data:{ numeroCompte, rib:`RI-${numeroCompte}`, type:'ORDINAIRE', userId:user.id } });
      return tx.adherentUnarci.create({
        data: {
          reference: adhesionRef,
          userId: user.id, distributeurId, conseillerId,
          montantAdhesion: montant, numeroPaie,
          pays: req.body.pays || 'CI', region:String(region).trim(), ville:String(ville || '').trim(),
          village: req.body.village || null, campement: req.body.campement || null,
          nomComplet: String(nomComplet).trim(),
          nomPere: req.body.nomPere || null, nomMere: req.body.nomMere || null,
          numeroCni: req.body.numeroCni || null, numeroPasseport: req.body.numeroPasseport || null, numeroPermis: req.body.numeroPermis || null,
          situation: req.body.situation || null,
          nomConjoint: req.body.nomConjoint || null, naissanceConjoint: req.body.naissanceConjoint || null,
          nombreEnfantsCharge: parseInt(req.body.nombreEnfantsCharge || '0') || 0,
          nomAyantDroit: req.body.nomAyantDroit || null, naissanceAyantDroit: req.body.naissanceAyantDroit || null,
          nomArtiste: req.body.nomArtiste || null, debutCarriere: req.body.debutCarriere || null, corpsMetier: req.body.corpsMetier || null,
          typeStructure: req.body.typeStructure || null, nomStructure: req.body.nomStructure || null,
          representantLegal: req.body.representantLegal || null, dateCreationStructure: req.body.dateCreationStructure || null,
          specialites: req.body.specialites || null,
          urgenceNom: req.body.urgenceNom || null, urgenceContacts: req.body.urgenceContacts || null, urgenceFiliation: req.body.urgenceFiliation || null,
        },
      });
    });

    // SMS automatique : invitation à valider par le numéro de paie LCP
    const smsResult = await sendSms({
      to: telRaw,
      message: tpl.unarciAdhesion(`${prenom} ${nom}`, numeroCompte, telRaw, pwd, montant, numeroPaie, appUrl),
      userId: adhesion.userId,
    }).catch(() => null);
    await prisma.adherentUnarci.update({ where:{ id:adhesion.id }, data:{ smsEnvoye:!!smsResult?.success } });

    await prisma.auditLog.create({
      data: { action:'ADHESION_UNARCI', entite:'AdherentUnarci', entiteId:adhesion.id, actorId:adhesion.userId, details:{ reference:adhesionRef, codeClient, numeroCompte, montant } },
    }).catch(() => {});

    return res.status(201).json({
      success:true,
      message:'Adhésion UNARCI enregistrée ! Validez votre paiement pour activer votre compte.',
      data: { reference:adhesionRef, numeroCompte, codeClient, montant, numeroPaie, smsEnvoye:!!smsResult?.success },
    });
  } catch (err: any) {
    console.error('[adherer]', err);
    if (err.code === 'P2002') return res.status(409).json({ error:'Un enregistrement avec ces informations existe déjà' });
    return res.status(500).json({ error:`Erreur serveur : ${err.message}` });
  }
}

// ─── Config publique (montant + numéro de paie) ───────────────────────
export async function configUnarci(req: Request, res: Response) {
  const cfg = await unarciConfig();
  return res.json({
    data: {
      actif: cfg.UNARCI_ACTIF === 'true',
      montant: parseInt(cfg.UNARCI_ADHESION_MONTANT || UNARCI_CONST.MONTANT_DEFAUT) || 10000,
      numeroPaie: cfg.UNARCI_PAIE_NUMERO || UNARCI_CONST.PAIE_NUMERO_DEFAUT,
    },
  });
}

// ─── AGENCE : liste des adhérents ─────────────────────────────────────
export async function listerAdherents(req: Request, res: Response) {
  try {
    const role = req.user!.role;
    const { statut, search } = req.query;

    let distId: string | undefined;
    if (role === 'DISTRIBUTEUR_AGREE' || role === 'DISTRIBUTEUR_INTERNE') {
      const d = await prisma.distributeur.findFirst({ where:{ userId:req.user!.userId } });
      const cfg = await unarciConfig();
      if (!d || (cfg.UNARCI_DIST_ID && d.id !== cfg.UNARCI_DIST_ID))
        return res.status(403).json({ error:'Accès réservé à l\'agence UNARCI' });
      distId = d.id;
    }

    const where: any = {};
    if (distId) where.distributeurId = distId;
    if (statut) where.statut = statut;
    if (search) {
      where.OR = [
        { nomComplet: { contains: String(search), mode:'insensitive' } },
        { reference: { contains: String(search), mode:'insensitive' } },
        { user: { OR:[ { telephone:{ contains:String(search) } }, { email:{ contains:String(search), mode:'insensitive' } } ] } },
      ];
    }

    const [total, adherents] = await Promise.all([
      prisma.adherentUnarci.count({ where }),
      prisma.adherentUnarci.findMany({
        where, orderBy:{ createdAt:'desc' }, take: 200,
        include: {
          user: { select:{ telephone:true, email:true, actif:true, compte:{ select:{ numeroCompte:true, statut:true } } } },
        },
      }),
    ]);

    return res.json({ data: adherents.map(a => ({ ...a, montantAdhesion:Number(a.montantAdhesion) })), pagination:{ total } });
  } catch (err:any) { return res.status(500).json({ error:err.message }); }
}

// ─── AGENCE : valider le paiement + activer le compte ─────────────────
export async function activerAdherent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const adhesion = await prisma.adherentUnarci.findUnique({ where:{ id } });
    if (!adhesion) return res.status(404).json({ error:'Adhésion introuvable' });

    if (req.user!.role === 'DISTRIBUTEUR_AGREE' || req.user!.role === 'DISTRIBUTEUR_INTERNE') {
      const d = await prisma.distributeur.findFirst({ where:{ userId:req.user!.userId } });
      if (d?.id !== adhesion.distributeurId)
        return res.status(403).json({ error:'Cette adhésion ne dépend pas de votre agence' });
    }
    if (adhesion.statut === 'ACTIF')
      return res.status(400).json({ error:'Cette adhésion est déjà activée' });
    if (adhesion.statut === 'REJETE')
      return res.status(400).json({ error:'Cette adhésion a été rejetée' });

    await prisma.$transaction([
      prisma.user.update({ where:{ id:adhesion.userId }, data:{ actif:true } }),
      prisma.compte.update({ where:{ userId:adhesion.userId }, data:{ statut:'ACTIF' } }),
      prisma.adherentUnarci.update({ where:{ id }, data:{ statut:'ACTIF', activateAt:new Date() } }),
    ]);

    const user = await prisma.user.findUnique({ where:{ id:adhesion.userId } });
    if (user) sendSms({ to:user.telephone, message:`UNARCI LCP: Felicitations ${user.prenom} ${user.nom}! Votre adhesion est validee et votre compte est actif. Bonne epargne!`, userId:user.id }).catch(() => {});

    await prisma.auditLog.create({
      data:{ action:'ACTIVATION_ADHESION_UNARCI', entite:'AdherentUnarci', entiteId:adhesion.id, actorId:req.user!.userId, details:{ reference:adhesion.reference } },
    }).catch(() => {});

    return res.json({ success:true, message:'Paiement validé — compte activé', data:{ id:adhesion.id, reference:adhesion.reference } });
  } catch (err:any) { return res.status(500).json({ error:err.message }); }
}

// ─── AGENCE : statistiques ────────────────────────────────────────────
export async function statsAdherents(req: Request, res: Response) {
  try {
    const role = req.user!.role;
    let distId: string | undefined;
    if (role === 'DISTRIBUTEUR_AGREE' || role === 'DISTRIBUTEUR_INTERNE') {
      const d = await prisma.distributeur.findFirst({ where:{ userId:req.user!.userId } });
      const cfg = await unarciConfig();
      if (!d || (cfg.UNARCI_DIST_ID && d.id !== cfg.UNARCI_DIST_ID))
        return res.status(403).json({ error:'Accès réservé à l\'agence UNARCI' });
      distId = d.id;
    }
    const where: any = {};
    if (distId) where.distributeurId = distId;

    const [total, inscrits, actifs, rejetes] = await Promise.all([
      prisma.adherentUnarci.count({ where }),
      prisma.adherentUnarci.count({ where:{ ...where, statut:'INSCRIT' } }),
      prisma.adherentUnarci.count({ where:{ ...where, statut:'ACTIF' } }),
      prisma.adherentUnarci.count({ where:{ ...where, statut:'REJETE' } }),
    ]);
    return res.json({ data:{ total, inscrits, actifs, rejetes } });
  } catch (err:any) { return res.status(500).json({ error:err.message }); }
}
