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
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/upload';

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

// [SÉCURITÉ/DOUBLON] Normalise un nom pour comparaison : minuscules,
// sans accents, espaces réduits → « KOUASSI JEAN » == « kouassi   jean »
function normaliserNom(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// [DOUBLON] Vérifie qu'aucune adhésion active n'existe déjà pour les mêmes
// données d'identité. Doit être appelée DANS la transaction pour éviter la
// double-soumission concurrente.
async function verifierDoublon(tx: any, body: any): Promise<string | null> {
  const telephone = String(body.telephone || '');
  const numeroCni = String(body.numeroCni || '').trim().toUpperCase();
  const numeroPasseport = String(body.numeroPasseport || '').trim().toUpperCase();
  const numeroPermis = String(body.numeroPermis || '').trim().toUpperCase();
  const nomN = normaliserNom(body.nomComplet);

  if (telephone) {
    const doublonTel = await tx.user.findFirst({ where: { telephone: { in: candidatsTel(telephone) } } });
    // Un CLIENT existant = doublon. Un employé (conseiller, distributeur,
    // admin) PEUT aussi devenir adhérent UNARCI : on l'autorise et on
    // réutilisera son compte (1 personne = 1 compte).
    if (doublonTel && doublonTel.role === 'CLIENT')
      return 'Un compte client existe déjà avec ce numéro de téléphone';
  }
  if (numeroCni) {
    const d = await tx.adherentUnarci.findFirst({ where: { numeroCni } });
    if (d) return 'Ce numéro de CNI est déjà utilisé pour une autre adhésion';
  }
  if (numeroPasseport) {
    const d = await tx.adherentUnarci.findFirst({ where: { numeroPasseport } });
    if (d) return 'Ce numéro de passeport est déjà utilisé pour une autre adhésion';
  }
  if (numeroPermis) {
    const d = await tx.adherentUnarci.findFirst({ where: { numeroPermis } });
    if (d) return 'Ce numéro de permis est déjà utilisé pour une autre adhésion';
  }
  // Nom complet (insensible aux accents/casse/espaces), parmi les adhésions
  // non rejetées : on n'autorise qu'UNE adhésion active par personne.
  const memeNom = await tx.adherentUnarci.findMany({
    where: { statut: { in: ['INSCRIT', 'ACTIF'] } },
    select: { nomComplet: true },
  });
  if (memeNom.some((a: any) => normaliserNom(a.nomComplet) === nomN))
    return 'Une adhésion est déjà en cours pour ce nom';
  return null;
}

// ─── PUBLIC : soumettre le formulaire d'adhésion (multipart) ─────────
export async function adherer(req: Request, res: Response) {
  try {
    const cfg = await unarciConfig();
    if (cfg.UNARCI_ACTIF !== 'true')
      return res.status(403).json({ error:'Les adhésions UNARCI sont momentanément fermées' });

    const body = req.body;
    const files = (req as any).files || {};
    const photo = files.photo?.[0] as Express.Multer.File | undefined;
    const recto = files.pieceRecto?.[0] as Express.Multer.File | undefined;
    const verso = files.pieceVerso?.[0] as Express.Multer.File | undefined;

    const { nomComplet, telephone } = body;
    if (!nomComplet || !telephone)
      return res.status(400).json({ error:'Nom complet et téléphone requis' });
    if (!body.region) return res.status(400).json({ error:'La région est requise' });
    const telDigits = String(telephone).replace(/\D/g, '');
    if (telDigits.length < 8) return res.status(400).json({ error:'Numéro de téléphone invalide' });

    // [DOUBLON] Pré-vérification rapide (bon UX : ne pas uploader de fichiers
    // inutilement). La vérification décisive est refaite DANS la transaction.
    const preDoublon = await verifierDoublon(prisma, body);
    if (preDoublon) return res.status(409).json({ error: preDoublon });
    if (body.email) {
      const exEmail = await prisma.user.findUnique({ where:{ email:String(body.email).trim().toLowerCase() } });
      if (exEmail && exEmail.role === 'CLIENT') return res.status(409).json({ error:'Cet email est déjà utilisé' });
    }

    const { distributeurId, conseillerId } = await ensureUnarciInfra();

    // Upload des pièces AVANT la création en base (limite les orphelins :
    // si la création échoue, on supprime les fichiers déjà uploadés).
    const pieces = { photo: null as any, recto: null as any, verso: null as any };
    try {
      const idSuffix = generateRef('ADH').replace(/-/g, '');
      if (photo) pieces.photo = await uploadToCloudinary(photo.buffer, { folder: 'unarci', publicId: `${idSuffix}-photo` });
      if (recto) pieces.recto = await uploadToCloudinary(recto.buffer, { folder: 'unarci', publicId: `${idSuffix}-recto` });
      if (verso) pieces.verso = await uploadToCloudinary(verso.buffer, { folder: 'unarci', publicId: `${idSuffix}-verso` });
    } catch (err: any) {
      for (const p of Object.values(pieces)) if (p?.publicId) await deleteFromCloudinary(p.publicId).catch(() => {});
      return res.status(500).json({ error:'Erreur lors de l\'upload des pièces. Vérifiez les formats (JPEG, PNG, PDF, max 5 Mo).' });
    }

    // Compte CLIENT (inactif jusqu'à validation du paiement)
    const parts = String(nomComplet).trim().split(/\s+/);
    const prenom = parts[0];
    const nom    = parts.slice(1).join(' ').toUpperCase() || parts[0].toUpperCase();
    const telRaw = String(telephone).trim();
    const emailFinal = body.email
      ? String(body.email).trim().toLowerCase()
      : `${telDigits}@semence-noemail.ci`;
    const pwd   = generatePassword();
    const appUrl = process.env.FRONTEND_URL || 'https://app.semenceep.ci';

    const codeClient   = generateCodeActeur('CLI');
    const numeroCompte = `SE-${generateRef('UNARCI').replace('-','').slice(-8)}`;
    let numeroCompteFinal = numeroCompte;
    let codeClientFinal   = codeClient;

    const montant  = parseInt(cfg.UNARCI_ADHESION_MONTANT || UNARCI_CONST.MONTANT_DEFAUT) || 10000;
    const numeroPaie = cfg.UNARCI_PAIE_NUMERO || UNARCI_CONST.PAIE_NUMERO_DEFAUT;

    const adhesionRef = generateRef('UNARCI');

    let adhesion;
    let existant: any = null;
    try {
      adhesion = await prisma.$transaction(async (tx) => {
        // [DOUBLON] Vérification décisive dans la transaction (anti-course)
        const doublon = await verifierDoublon(tx, body);
        if (doublon) throw new DoublonAdhesion(doublon);

        // [EMPLOYÉ-CLIENT] 1 personne = 1 compte : un employé (conseiller,
        // distributeur, admin) peut aussi adhérer UNARCI. On réutilise alors
        // son profil et son compte au lieu de créer des doublons.
        const telCandidats  = candidatsTel(telRaw);
        const emailCandidat = body.email ? String(body.email).trim().toLowerCase() : null;
        existant = await tx.user.findFirst({
          where: {
            OR: [
              ...(telCandidats.length ? [{ telephone:{ in: telCandidats } }] : []),
              ...(emailCandidat ? [{ email: emailCandidat }] : []),
            ],
          },
        });

        let userId: string;
        if (existant) {
          if (existant.role === 'CLIENT')
            throw new DoublonAdhesion('Un compte client existe déjà avec ces informations (téléphone ou email)');
          userId = existant.id;
          const compteExistant = await tx.compte.findFirst({ where:{ userId } });
          if (compteExistant) numeroCompteFinal = compteExistant.numeroCompte;
        } else {
          const user = await tx.user.create({
            data: {
              email: emailFinal, telephone: telRaw,
              passwordHash: await bcrypt.hash(pwd, 12),
              nom, prenom, role:'CLIENT', actif:false,
            },
          });
          userId = user.id;
        }

        const dejaClient = await tx.client.findFirst({ where:{ userId } });
        if (!dejaClient) {
          await tx.client.create({ data:{ code:codeClient, region:String(body.region).trim(), ville:String(body.ville || '').trim(), commune:body.commune || '', conseillerId, userId } });
        } else {
          codeClientFinal = dejaClient.code;
        }
        const compteExiste = await tx.compte.findFirst({ where:{ userId } });
        if (!compteExiste) {
          await tx.compte.create({ data:{ numeroCompte:numeroCompteFinal, rib:`RI-${numeroCompteFinal}`, type:'ORDINAIRE', userId } });
        }
        return tx.adherentUnarci.create({
          data: {
            reference: adhesionRef,
            userId, distributeurId, conseillerId,
            montantAdhesion: montant, numeroPaie,
            pays: body.pays || 'CI', region:String(body.region).trim(), ville:String(body.ville || '').trim(),
            village: body.village || null, campement: body.campement || null,
            nomComplet: String(nomComplet).trim(),
            nomPere: body.nomPere || null, nomMere: body.nomMere || null,
            numeroCni: String(body.numeroCni || '').trim().toUpperCase() || null,
            numeroPasseport: String(body.numeroPasseport || '').trim().toUpperCase() || null,
            numeroPermis: String(body.numeroPermis || '').trim().toUpperCase() || null,
            situation: body.situation || null,
            nomConjoint: body.nomConjoint || null, naissanceConjoint: body.naissanceConjoint || null,
            nombreEnfantsCharge: parseInt(body.nombreEnfantsCharge || '0') || 0,
            nomAyantDroit: body.nomAyantDroit || null, naissanceAyantDroit: body.naissanceAyantDroit || null,
            nomArtiste: body.nomArtiste || null, debutCarriere: body.debutCarriere || null, corpsMetier: body.corpsMetier || null,
            typeStructure: body.typeStructure || null, nomStructure: body.nomStructure || null,
            representantLegal: body.representantLegal || null, dateCreationStructure: body.dateCreationStructure || null,
            specialites: body.specialites || null,
            urgenceNom: body.urgenceNom || null, urgenceContacts: body.urgenceContacts || null, urgenceFiliation: body.urgenceFiliation || null,
            photoUrl: pieces.photo?.url || null, photoPublicId: pieces.photo?.publicId || null,
            pieceRectoUrl: pieces.recto?.url || null, pieceRectoPublicId: pieces.recto?.publicId || null,
            pieceVersoUrl: pieces.verso?.url || null, pieceVersoPublicId: pieces.verso?.publicId || null,
          },
        });
      });
    } catch (err: any) {
      // Nettoyage : suppression des fichiers si l'écriture en base a échoué
      for (const p of Object.values(pieces)) if (p?.publicId) await deleteFromCloudinary(p.publicId).catch(() => {});
      if (err instanceof DoublonAdhesion) return res.status(409).json({ error: err.message });
      throw err;
    }

    // SMS automatique : invitation à valider par le numéro de paie LCP
    const smsResult = await sendSms({
      to: telRaw,
      message: tpl.unarciAdhesion(`${prenom} ${nom}`, numeroCompteFinal, telRaw, pwd, montant, numeroPaie, appUrl),
      userId: adhesion.userId,
    }).catch(() => null);
    await prisma.adherentUnarci.update({ where:{ id:adhesion.id }, data:{ smsEnvoye:!!smsResult?.success } });

    await prisma.auditLog.create({
      data: { action:'ADHESION_UNARCI', entite:'AdherentUnarci', entiteId:adhesion.id, actorId:adhesion.userId, details:{ reference:adhesionRef, codeClient:codeClientFinal, numeroCompte:numeroCompteFinal, montant, compteReutilise:!!existant, photo:!!photo, pieceRecto:!!recto, pieceVerso:!!verso } },
    }).catch(() => {});

    return res.status(201).json({
      success:true,
      message:'Adhésion UNARCI enregistrée ! Validez votre paiement pour activer votre compte.',
      data: {
        reference: adhesionRef, numeroCompte: numeroCompteFinal, codeClient: codeClientFinal, montant, numeroPaie, compteReutilise:!!existant,
        smsEnvoye:!!smsResult?.success,
        pieces: { photoUrl: pieces.photo?.url || null, pieceRectoUrl: pieces.recto?.url || null, pieceVersoUrl: pieces.verso?.url || null },
      },
    });
  } catch (err: any) {
    console.error('[adherer]', err);
    if (err.code === 'P2002') return res.status(409).json({ error:'Un enregistrement avec ces informations existe déjà' });
    return res.status(500).json({ error:`Erreur serveur : ${err.message}` });
  }
}

class DoublonAdhesion extends Error {}

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

// ─── AGENCE : vérification d'accès (agence UNARCI ou admin) ───────────
// Retourne l'id distributeur si l'acteur est habilité, sinon null (refus).
async function agenceAutorisee(role: string, actorUserId: string): Promise<string | null> {
  if (role === 'MASTER' || role === 'SUPER_ADMIN') return '*';
  if (role === 'DISTRIBUTEUR_AGREE' || role === 'DISTRIBUTEUR_INTERNE') {
    const d = await prisma.distributeur.findFirst({ where: { userId: actorUserId } });
    const cfg = await unarciConfig();
    if (!d || (cfg.UNARCI_DIST_ID && d.id !== cfg.UNARCI_DIST_ID)) return null;
    return d.id;
  }
  return null;
}

// ─── Fiche adhérent : requête réutilisable + mise en forme ─────────────
const ADHERENT_INCLUDE = {
  user: {
    select: {
      id: true, telephone: true, email: true, actif: true, createdAt: true,
      compte:  { select:{ numeroCompte:true, rib:true, statut:true } },
      clients: { select:{ code:true } },
    },
  },
  distributeur: { select:{ code:true, nomEntreprise:true, ville:true } },
  conseiller:   { select:{ code:true, user:{ select:{ nom:true, prenom:true } } } },
} as const;

function adherentFiche(a: any) {
  const user    = a.user || {};
  const compte  = user.compte || null;
  const client  = user.clients?.[0] || null;
  return {
    id: a.id,
    reference: a.reference,
    statut: a.statut,
    montantAdhesion: Number(a.montantAdhesion),
    numeroPaie: a.numeroPaie,
    smsEnvoye: a.smsEnvoye,
    nomComplet: a.nomComplet,
    telephone: user.telephone || null,
    email: user.email || null,
    pieces: { photo:a.photoUrl||null, pieceRecto:a.pieceRectoUrl||null, pieceVerso:a.pieceVersoUrl||null },
    region: a.region, ville: a.ville, village: a.village, campement: a.campement,
    situation: a.situation,
    numeroCni: a.numeroCni, numeroPasseport: a.numeroPasseport, numeroPermis: a.numeroPermis,
    nomConjoint: a.nomConjoint, naissanceConjoint: a.naissanceConjoint,
    nombreEnfantsCharge: a.nombreEnfantsCharge,
    nomAyantDroit: a.nomAyantDroit, naissanceAyantDroit: a.naissanceAyantDroit,
    nomArtiste: a.nomArtiste, debutCarriere: a.debutCarriere, corpsMetier: a.corpsMetier,
    typeStructure: a.typeStructure, nomStructure: a.nomStructure,
    representantLegal: a.representantLegal, dateCreationStructure: a.dateCreationStructure, specialites: a.specialites,
    urgenceNom: a.urgenceNom, urgenceContacts: a.urgenceContacts, urgenceFiliation: a.urgenceFiliation,
    compte: compte ? { numeroCompte:compte.numeroCompte, rib:compte.rib, statut:compte.statut } : null,
    client: client ? { code:client.code } : null,
    provenance: {
      distributeur: a.distributeur ? { code:a.distributeur.code, nomEntreprise:a.distributeur.nomEntreprise, ville:a.distributeur.ville } : null,
      conseiller: a.conseiller ? { code:a.conseiller.code, nom:a.conseiller.user?.nom||null, prenom:a.conseiller.user?.prenom||null } : null,
    },
    createdAt: a.createdAt,
    activateAt: a.activateAt,
    rejeteAt: a.rejeteAt,
  };
}

// ─── AGENCE : liste des adhérents ─────────────────────────────────────
export async function listerAdherents(req: Request, res: Response) {
  try {
    const distId = await agenceAutorisee(req.user!.role, req.user!.userId);
    if (distId === null)
      return res.status(403).json({ error:'Accès réservé à l\'agence UNARCI' });
    const { statut, search } = req.query;

    const where: any = {};
    if (distId !== '*') where.distributeurId = distId;
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

// ─── AGENCE : fiche d'une adhésion (provenance + compte + pièces) ─────
export async function getAdherent(req: Request, res: Response) {
  try {
    const distId = await agenceAutorisee(req.user!.role, req.user!.userId);
    if (distId === null)
      return res.status(403).json({ error:'Accès réservé à l\'agence UNARCI' });

    const adhesion = await prisma.adherentUnarci.findUnique({
      where: { id: req.params.id },
      include: ADHERENT_INCLUDE,
    });
    if (!adhesion) return res.status(404).json({ error:'Adhésion introuvable' });
    if (distId !== '*' && adhesion.distributeurId !== distId)
      return res.status(403).json({ error:'Cette adhésion ne dépend pas de votre agence' });

    return res.json({ data: adherentFiche(adhesion) });
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

// ─── AGENCE : recherche par id / référence / téléphone / email / nom /
// code client / numéro de compte / RIB / CNI ───────────────────────────
// Répond au besoin de traçabilité de provenance : à partir d'un identifiant,
// on retrouve l'adhérent et TOUTE sa chaîne (agence/distributeur/région/
// conseiller + compte/RIB).
export async function rechercherAdherent(req: Request, res: Response) {
  try {
    const distId = await agenceAutorisee(req.user!.role, req.user!.userId);
    if (distId === null)
      return res.status(403).json({ error:'Accès réservé à l\'agence UNARCI' });

    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error:'Paramètre q requis' });

    const where: any = {
      OR: [
        { id: q },
        { reference: q },
        { nomComplet: { contains:q, mode:'insensitive' } },
        ...(q.length >= 4 ? [{ numeroCni:q }, { numeroPasseport:q }, { numeroPermis:q }] : []),
        { user: {
          OR: [
            { telephone: { contains:q } },
            { email: { contains:q, mode:'insensitive' } },
            { nom: { contains:q, mode:'insensitive' } },
            { prenom: { contains:q, mode:'insensitive' } },
            { clients: { some: { code: { contains:q, mode:'insensitive' } } } },
            { compte: { OR:[ { numeroCompte:{ contains:q } }, { rib:{ contains:q } } ] } },
          ],
        } },
      ],
    };
    if (distId !== '*') where.distributeurId = distId;

    const adherents = await prisma.adherentUnarci.findMany({
      where, include: ADHERENT_INCLUDE, take: 50, orderBy:{ createdAt:'desc' },
    });

    return res.json({ data: adherents.map(adherentFiche), total: adherents.length });
  } catch (err:any) { return res.status(500).json({ error:err.message }); }
}

// ─── AGENCE : rejeter une adhésion (fraude, pièce invalide, doublon) ───
export async function rejeterAdherent(req: Request, res: Response) {
  try {
    const distId = await agenceAutorisee(req.user!.role, req.user!.userId);
    if (distId === null)
      return res.status(403).json({ error:'Accès réservé à l\'agence UNARCI' });

    const adhesion = await prisma.adherentUnarci.findUnique({ where:{ id:req.params.id } });
    if (!adhesion) return res.status(404).json({ error:'Adhésion introuvable' });
    if (distId !== '*' && adhesion.distributeurId !== distId)
      return res.status(403).json({ error:'Cette adhésion ne dépend pas de votre agence' });
    if (adhesion.statut === 'REJETE')
      return res.status(400).json({ error:'Cette adhésion est déjà rejetée' });
    if (adhesion.statut === 'ACTIF')
      return res.status(400).json({ error:'Une adhésion active ne peut pas être rejetée. Supprimez-la si nécessaire.' });

    const motif = String(req.body.motif || '').trim().slice(0, 300) || null;

    await prisma.$transaction([
      prisma.adherentUnarci.update({ where:{ id:adhesion.id }, data:{ statut:'REJETE', rejeteAt:new Date() } }),
      prisma.user.update({ where:{ id:adhesion.userId }, data:{ actif:false } }),
    ]);

    await prisma.auditLog.create({
      data:{ action:'REJET_ADHESION_UNARCI', entite:'AdherentUnarci', entiteId:adhesion.id, actorId:req.user!.userId, details:{ reference:adhesion.reference, motif } },
    }).catch(() => {});

    const user = await prisma.user.findUnique({ where:{ id:adhesion.userId } });
    if (user) sendSms({ to:user.telephone, message:`UNARCI LCP: Votre adhesion a ete rejetee${motif ? ` (${motif})` : ''}. Contactez l'agence UNARCI pour plus d'informations.`, userId:user.id }).catch(() => {});

    return res.json({ success:true, message:'Adhésion rejetée', data:{ id:adhesion.id, reference:adhesion.reference, statut:'REJETE', rejeteAt:new Date() } });
  } catch (err:any) { return res.status(500).json({ error:err.message }); }
}

// ─── AGENCE : suppression définitive (tests, doublons, erronées) ──────
// Supprime les pièces Cloudinary, l'adhésion, et nettoie le profil créé
// (user + compte + client) s'il n'a aucune autre adhésion. Un employé
// réutilisé (1 personne = 1 compte) est conservé.
export async function supprimerAdherent(req: Request, res: Response) {
  try {
    const distId = await agenceAutorisee(req.user!.role, req.user!.userId);
    if (distId === null)
      return res.status(403).json({ error:'Accès réservé à l\'agence UNARCI' });

    const adhesion = await prisma.adherentUnarci.findUnique({ where:{ id:req.params.id } });
    if (!adhesion) return res.status(404).json({ error:'Adhésion introuvable' });
    if (distId !== '*' && adhesion.distributeurId !== distId)
      return res.status(403).json({ error:'Cette adhésion ne dépend pas de votre agence' });

    for (const pid of [adhesion.photoPublicId, adhesion.pieceRectoPublicId, adhesion.pieceVersoPublicId])
      if (pid) await deleteFromCloudinary(pid).catch(() => {});

    const autresAdhesions = await prisma.adherentUnarci.count({ where:{ userId:adhesion.userId, id:{ not:adhesion.id } } });
    const clients         = await prisma.client.findMany({ where:{ userId:adhesion.userId } });
    const user            = await prisma.user.findUnique({ where:{ id:adhesion.userId } });
    const profilOrphelin  = user && user.role === 'CLIENT' && autresAdhesions === 0 && clients.length <= 1;

    await prisma.$transaction(async (tx) => {
      await tx.adherentUnarci.delete({ where:{ id:adhesion.id } });
      if (profilOrphelin) {
        for (const c of clients) await tx.client.delete({ where:{ id:c.id } });
        await tx.compte.deleteMany({ where:{ userId:user.id } });
        await tx.user.delete({ where:{ id:user.id } });
      }
    });

    await prisma.auditLog.create({
      data:{ action:'SUPPRESSION_ADHESION_UNARCI', entite:'AdherentUnarci', entiteId:adhesion.id, actorId:req.user!.userId, details:{ reference:adhesion.reference, profilSupprime:profilOrphelin } },
    }).catch(() => {});

    return res.json({ success:true, message:'Adhésion supprimée', data:{ id:adhesion.id, reference:adhesion.reference, profilSupprime:profilOrphelin } });
  } catch (err:any) { return res.status(500).json({ error:err.message }); }
}
