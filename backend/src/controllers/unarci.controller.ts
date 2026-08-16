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
import PDFDocument from 'pdfkit';
import prisma from '../utils/prisma';
import { generateRef, generateCodeActeur, generateTempPassword } from '../utils/crypto';
import { sendSms, tpl } from '../utils/sms';
import { ensureUnarciInfra, unarciConfig, UNARCI_CONST } from '../utils/unarci';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/upload';
import { fCFA, parsePage, parseLimit } from '../utils/format';

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
    const pwd   = generateTempPassword();
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
  if (role === 'CONSEILLER') {
    const c = await prisma.conseiller.findFirst({ where: { userId: actorUserId } });
    if (!c) return null;
    const cfg = await unarciConfig();
    if (!cfg.UNARCI_DIST_ID || c.distributeurId !== cfg.UNARCI_DIST_ID) return null;
    return c.distributeurId;
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
    piecesStatut: a.piecesStatut || 'EN_ATTENTE',
    piecesMotif: a.piecesMotif || null,
    piecesVerifieesAt: a.piecesVerifieesAt || null,
    relanceCount: a.relanceCount || 0,
    relanceAt: a.relanceAt || null,
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
    const page  = parsePage(req.query.page as string);
    const limit = parseLimit(req.query.limit as string, 200);

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
        where, orderBy:{ createdAt:'desc' }, skip:(page-1)*limit, take: limit,
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

    const role = req.user!.role;
    if (role === 'DISTRIBUTEUR_AGREE' || role === 'DISTRIBUTEUR_INTERNE') {
      const d = await prisma.distributeur.findFirst({ where:{ userId:req.user!.userId } });
      if (d?.id !== adhesion.distributeurId)
        return res.status(403).json({ error:'Cette adhésion ne dépend pas de votre agence' });
    } else if (role === 'CONSEILLER') {
      const c = await prisma.conseiller.findFirst({ where:{ userId:req.user!.userId } });
      if (!c || c.distributeurId !== adhesion.distributeurId)
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

// ─── AGENCE : vérification des pièces jointes (conformes / à revoir) ──
export async function validerPieces(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const conformes = req.body.conformes === true || req.body.conformes === 'true';
    const motif = String(req.body.motif || '').trim().slice(0, 300) || null;

    const adhesion = await prisma.adherentUnarci.findUnique({ where:{ id } });
    if (!adhesion) return res.status(404).json({ error:'Adhésion introuvable' });

    if (req.user!.role === 'DISTRIBUTEUR_AGREE' || req.user!.role === 'DISTRIBUTEUR_INTERNE') {
      const d = await prisma.distributeur.findFirst({ where:{ userId:req.user!.userId } });
      if (d?.id !== adhesion.distributeurId)
        return res.status(403).json({ error:'Cette adhésion ne dépend pas de votre agence' });
    }
    if (!conformes && !motif)
      return res.status(400).json({ error:'Un motif est requis pour demander des pièces à revoir' });

    const statut = conformes ? 'CONFORMES' : 'A_REVOIR';
    await prisma.adherentUnarci.update({
      where:{ id },
      data:{ piecesStatut: statut, piecesMotif: conformes ? null : motif, piecesVerifieesAt: new Date() },
    });

    await prisma.auditLog.create({
      data:{ action:'VERIFICATION_PIECES_UNARCI', entite:'AdherentUnarci', entiteId:id, actorId:req.user!.userId, details:{ reference:adhesion.reference, statut, motif } },
    }).catch(() => {});

    return res.json({ success:true, data:{ id, piecesStatut: statut, piecesMotif: conformes ? null : motif } });
  } catch (err:any) { return res.status(500).json({ error:err.message }); }
}

// ─── AGENCE : export PDF de la fiche adhérent ─────────────────────────
function construireFichePdf(f: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size:'A4', margin:48, info:{ Title:`Fiche adhérent ${f.reference}`, Author:'Semence Epargne — LCP' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PRIMARY = '#F65A04', DARK = '#0F2E52', MUTED = '#6B7C9A', GREY = '#8a94a6';

    const entete = () => {
      doc.fontSize(18).fillColor(PRIMARY).text('SEMENCE ÉPARGNE', { continued:true }).fillColor(DARK).text('  ·  Le Crédit Panafricain');
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor(MUTED).text('UNARCI — Union Nationale des Artistes de Côte d\'Ivoire');
      doc.fontSize(12).fillColor(DARK).text('FICHE ADHÉRENT', { underline:true });
      doc.moveDown(0.4);
    };
    const section = (t: string) => {
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor(PRIMARY).text(t.toUpperCase());
      doc.moveDown(0.2);
    };
    const ligne = (label: string, value: any) => {
      const v = value === null || value === undefined || value === '' ? '—' : String(value);
      const y = doc.y;
      doc.fontSize(9).fillColor(GREY).text(label + ' :  ', 48, y, { width: 160, continued:true });
      doc.fillColor(DARK).text(v, 48 + 160, y, { width: doc.page.width - 48 - 160 - 40 });
      doc.moveDown(0.25);
    };

    entete();

    doc.fontSize(9).fillColor(MUTED).text(`Référence : ${f.reference}     Inscrit le : ${new Date(f.createdAt).toLocaleDateString('fr-FR')}     Statut : ${f.statut}`);
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor(MUTED).text(`Pièces jointes : ${f.piecesStatut}${f.piecesMotif ? ` — ${f.piecesMotif}` : ''}`);
    doc.moveDown(0.3);

    section('État civil');
    ligne('Nom et prénoms', f.nomComplet);
    ligne('Téléphone', f.telephone);
    ligne('E-mail', f.email);
    ligne('CNI N°', f.numeroCni);
    ligne('Passeport N°', f.numeroPasseport);
    ligne('Permis N°', f.numeroPermis);
    ligne('Situation matrimoniale', f.situation === 'MARIEE' ? 'Marié(e)' : f.situation === 'CELIBATAIRE' ? 'Célibataire' : f.situation);

    section('Localisation');
    ligne('Pays', f.pays);
    ligne('Région', f.region);
    ligne('Ville', f.ville);
    ligne('Village', f.village);
    ligne('Campement', f.campement);

    section('Situation matrimoniale');
    ligne('Conjoint(e)', f.nomConjoint);
    ligne('Naissance conjoint(e)', f.naissanceConjoint);
    ligne('Enfants à charge', f.nombreEnfantsCharge);
    ligne('Ayant droit', f.nomAyantDroit);
    ligne('Naissance ayant droit', f.naissanceAyantDroit);

    section('Vie professionnelle');
    ligne('Nom d\'artiste', f.nomArtiste);
    ligne('Début de carrière', f.debutCarriere);
    ligne('Corps de métier', f.corpsMetier);

    section('Personne morale (groupe ou association)');
    ligne('Type de structure', f.typeStructure);
    ligne('Nom du groupe / association', f.nomStructure);
    ligne('Représentant légal', f.representantLegal);
    ligne('Date de création', f.dateCreationStructure);
    ligne('Spécialités', f.specialites);

    section('Personne à contacter en cas d\'urgence');
    ligne('Nom', f.urgenceNom);
    ligne('Contacts', f.urgenceContacts);
    ligne('Filiation', f.urgenceFiliation);

    section('Compte d\'épargne');
    ligne('Numéro de compte', f.compte?.numeroCompte);
    ligne('RIB', f.compte?.rib);
    ligne('Statut du compte', f.compte?.statut);
    ligne('Code client', f.client?.code);

    section('Provenance');
    ligne('Distributeur', f.provenance?.distributeur ? `${f.provenance.distributeur.code} — ${f.provenance.distributeur.nomEntreprise} (${f.provenance.distributeur.ville})` : null);
    ligne('Conseiller', f.provenance?.conseiller ? `${f.provenance.conseiller.prenom || ''} ${f.provenance.conseiller.nom || ''}`.trim() || f.provenance.conseiller.code : null);

    if (f.pieces?.photo || f.pieces?.pieceRecto || f.pieces?.pieceVerso) {
      section('Pièces jointes (liens)');
      ligne('Photo d\'identité', f.pieces.photo);
      ligne('Pièce recto', f.pieces.pieceRecto);
      ligne('Pièce verso', f.pieces.pieceVerso);
    }

    doc.moveDown(1.5);
    doc.fontSize(8).fillColor(GREY).text('Document généré le ' + new Date().toLocaleString('fr-FR') + ' — Semence Epargne (Le Crédit Panafricain). Vérifier l\'authenticité des pièces avant activation.', { align:'center' });

    doc.end();
  });
}

export async function pdfAdherent(req: Request, res: Response) {
  try {
    const distId = await agenceAutorisee(req.user!.role, req.user!.userId);
    if (distId === null)
      return res.status(403).json({ error:'Accès réservé à l\'agence UNARCI' });

    const adhesion = await prisma.adherentUnarci.findUnique({ where:{ id:req.params.id }, include: ADHERENT_INCLUDE });
    if (!adhesion) return res.status(404).json({ error:'Adhésion introuvable' });
    if (distId !== '*' && adhesion.distributeurId !== distId)
      return res.status(403).json({ error:'Cette adhésion ne dépend pas de votre agence' });

    const pdf = await construireFichePdf(adherentFiche(adhesion));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fiche-adherent-${adhesion.reference}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    return res.send(pdf);
  } catch (err:any) { return res.status(500).json({ error:err.message }); }
}

// ─── RELANCES AUTOMATIQUES paiement en attente ─────────────────────────
// 1ère relance à 48h, 2nde à 7 jours. Appelée périodiquement par server.ts.
// On n'incrémente le compteur que si le SMS part réellement (sinon l'échec
// est retenté au prochain cycle).
export async function relancerAdherents(): Promise<{ premieres: number; secondes: number }> {
  const now = new Date();
  const h48 = new Date(now.getTime() - 48 * 3600 * 1000);
  const d7  = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const cfg = await unarciConfig();
  const numeroPaie = cfg.UNARCI_PAIE_NUMERO || UNARCI_CONST.PAIE_NUMERO_DEFAUT;

  const enAttente = await prisma.adherentUnarci.findMany({
    where: { statut:'INSCRIT', relanceCount:{ lt: 2 } },
    select: { id:true, createdAt:true, relanceCount:true, montantAdhesion:true, user:{ select:{ id:true, telephone:true, prenom:true, nom:true } } },
  });

  let premieres = 0, secondes = 0;
  for (const a of enAttente) {
    if (!a.user?.telephone) continue;
    const inscritLe = a.createdAt;
    let etape = 0;
    if (a.relanceCount === 0 && inscritLe <= h48) etape = 1;
    else if (a.relanceCount === 1 && inscritLe <= d7) etape = 2;
    if (!etape) continue;

    const nom = `${a.user.prenom || ''} ${a.user.nom || ''}`.trim() || 'Cher(e) adhérent(e)';
    const msg = etape === 1
      ? `UNARCI LCP\nBonjour ${nom}!\nVotre adhesion est enregistree mais pas encore validee. Payez ${fCFA(Number(a.montantAdhesion))} par mobile money au ${numeroPaie} pour activer votre compte d'epargne.`
      : `UNARCI LCP\nBonjour ${nom}!\nDernier rappel: validez votre adhesion en payant ${fCFA(Number(a.montantAdhesion))} au ${numeroPaie} aujourd'hui, sinon votre numero de compte sera perdu. Merci.`;

    const r = await sendSms({ to:a.user.telephone, message: msg, userId:a.user.id });
    if (!r.success) continue;

    await prisma.adherentUnarci.update({ where:{ id:a.id }, data:{ relanceCount:{ increment:1 }, relanceAt:new Date() } });
    if (etape === 1) premieres++; else secondes++;
  }
  return { premieres, secondes };
}
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
