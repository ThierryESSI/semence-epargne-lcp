// backend/src/controllers/cartes.controller.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { generateRef, generateRefCourt, generateLotRef, generateCode4, hashCode, verifyHashedCode, verifyQrToken } from '../utils/crypto';
import { generateQrAuth, generateQrEpargne } from '../utils/qrcode';

import { notifier, emailTpl } from '../utils/notifications';
import { enregistrerVersement } from '../services/epargne.service';

// Référence courte unique (avec relance en cas de collision)
async function genRefCourtUnique(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const c = generateRefCourt();
    const exists = await prisma.carte.findUnique({ where: { refCourt: c } });
    if (!exists) return c;
  }
  return `CSE-${Date.now().toString(36).toUpperCase()}`;
}

export async function emettreCartes(req: Request, res: Response) {
  const { montant, quantite = 1, distributeurId, lot } = req.body;
  if (!montant || montant < 200) return res.status(400).json({ error: 'Montant minimum : 200 FCFA' });
  if (quantite < 1 || quantite > 500) return res.status(400).json({ error: 'Quantité entre 1 et 500' });

  const lotReference = (lot && String(lot).trim()) || generateLotRef();
  const existeLot = await prisma.lotCarte.findUnique({ where: { reference: lotReference } });
  if (existeLot) return res.status(409).json({ error: `La référence de lot ${lotReference} existe déjà` });

  const lotRecord = await prisma.lotCarte.create({
    data: { reference: lotReference, montant, quantite, distributeurId: distributeurId || null, creePar: req.user!.userId },
  });

  const cartes = [];
  for (let i = 0; i < quantite; i++) {
    const reference      = generateRef('CARTE');
    const refCourt       = await genRefCourtUnique();
    const codeValidation = generateCode4();
    const codeHash       = hashCode(codeValidation);
    const carte = await prisma.carte.create({
      data: { reference, refCourt, montant, qrCodeAuth:'', qrCodeEpargne:'', codeValidation:codeHash, distributeurId: distributeurId || null, lotId: lotRecord.id }
    });
    const { token: qrAuthToken, image: qrAuthImg }       = await generateQrAuth(carte.id, reference);
    const { token: qrEpargneToken, image: qrEpargneImg } = await generateQrEpargne(carte.id, montant, reference);
    await prisma.carte.update({ where:{ id:carte.id }, data:{ qrCodeAuth:qrAuthToken, qrCodeEpargne:qrEpargneToken } });
    cartes.push({ id:carte.id, reference, refCourt, montant, codeValidation, qrAuthImage:qrAuthImg, qrEpargneImage:qrEpargneImg });
  }
  await prisma.auditLog.create({ data:{ action:'EMISSION_CARTES', entite:'Carte', entiteId:lotRecord.id, actorId:req.user!.userId, details:{ lot:lotReference, montant, quantite, distributeurId } } });
  return res.status(201).json({ success:true, data:cartes, lot:{ id:lotRecord.id, reference:lotReference, montant, quantite } });
}

// Liste des lots de cartes avec statistiques
export async function listerLots(req: Request, res: Response) {
  const page   = parseInt(req.query.page as string || '1');
  const limit  = parseInt(req.query.limit as string || '20');
  const [total, lots] = await Promise.all([
    prisma.lotCarte.count(),
    prisma.lotCarte.findMany({ skip:(page-1)*limit, take:limit, orderBy:{ createdAt:'desc' } }),
  ]);
  const stats = await prisma.carte.groupBy({
    by: ['lotId', 'statut'],
    where: { lotId: { in: lots.map(l => l.id) } },
    _count: { _all: true },
  });
  const parLot: Record<string, Record<string, number>> = {};
  for (const s of stats) {
    if (!s.lotId) continue;
    parLot[s.lotId] = parLot[s.lotId] || {};
    parLot[s.lotId][s.statut] = s._count._all;
  }
  const data = lots.map(l => {
    const st = parLot[l.id] || {};
    return { ...l, montant: Number(l.montant), totalCartes: (st.DISPONIBLE||0)+(st.VENDUE||0)+(st.UTILISEE||0)+(st.ANNULEE||0)+(st.EN_COURS_ACTIVATION||0), disponibles: st.DISPONIBLE||0, utilisees: st.UTILISEE||0, annulees: st.ANNULEE||0 };
  });
  return res.json({ data, pagination:{ total, page, limit, pages:Math.ceil(total/limit) } });
}

// Griller un lot entier en cas de fraude (annule toutes les cartes non utilisées)
export async function grillerLot(req: Request, res: Response) {
  const { id } = req.params;
  const motif = (req.body && req.body.motif) || null;
  const lot = await prisma.lotCarte.findUnique({ where:{ id } });
  if (!lot) return res.status(404).json({ error:'Lot introuvable' });
  if (lot.statut === 'GRILLE') return res.status(409).json({ error:'Ce lot est déjà grillé' });

  const [, maj] = await prisma.$transaction([
    prisma.lotCarte.update({ where:{ id }, data:{ statut:'GRILLE', grillePar:req.user!.userId, grilleAt:new Date(), motif } }),
    prisma.carte.updateMany({ where:{ lotId:id, statut:{ in:['DISPONIBLE','VENDUE','EN_COURS_ACTIVATION'] } }, data:{ statut:'ANNULEE', activationLock:false, activationLockAt:null } }),
  ]);

  const utilisees = await prisma.carte.count({ where:{ lotId:id, statut:'UTILISEE' } });
  await prisma.auditLog.create({ data:{ action:'GRILLAGE_LOT', entite:'LotCarte', entiteId:id, actorId:req.user!.userId, details:{ lot:lot.reference, motif, annulees:maj.count, utilisees } } });
  return res.json({ success:true, message:`Lot ${lot.reference} grillé : ${maj.count} carte(s) annulée(s)`, data:{ annulees:maj.count, utilisees } });
}

export async function verifierCarte(req: Request, res: Response) {
  const { qrToken } = req.body;
  if (!qrToken) return res.status(400).json({ error:'qrToken requis' });
  const { valid, payload } = verifyQrToken(qrToken);
  if (!valid || payload?.type !== 'AUTH') return res.json({ authentique:false, message:'❌ Carte non authentique ou contrefaite !' });
  const carte = await prisma.carte.findUnique({ where:{ id:payload.carteId }, select:{ id:true, reference:true, montant:true, statut:true } });
  if (!carte) return res.json({ authentique:false, message:'Carte introuvable dans le système' });
  if (carte.statut === 'UTILISEE') return res.json({ authentique:false, message:'Cette carte a déjà été utilisée' });
  if (carte.statut === 'ANNULEE')  return res.json({ authentique:false, message:'Cette carte a été annulée' });
  return res.json({ authentique:true, message:'✅ Carte authentique — vous pouvez procéder', data:{ reference:carte.reference, montant:Number(carte.montant), statut:carte.statut } });
}

export async function activerCarte(req: Request, res: Response) {
  const { qrEpargneToken, codeValidation } = req.body;
  if (!qrEpargneToken || !codeValidation) return res.status(400).json({ error:'qrEpargneToken et codeValidation requis' });

  const { valid, payload } = verifyQrToken(qrEpargneToken);
  if (!valid || payload?.type !== 'EPARGNE') return res.status(400).json({ error:'QR Code épargne invalide' });

  // ── [SÉCURITÉ] Verrou atomique anti-double-activation ─────────────
  // Étape 1 : tenter de poser le verrou uniquement si la carte est libre
  const verrouillage = await prisma.carte.updateMany({
    where: {
      id:             payload.carteId,
      statut:         { in: ['DISPONIBLE', 'VENDUE'] },
      activationLock: false, // ← carte pas déjà en cours d'activation
    },
    data: {
      activationLock:   true,
      activationLockAt: new Date(),
      statut:           'EN_COURS_ACTIVATION',
    }
  });

  if (verrouillage.count === 0) {
    // Le updateMany n'a rien touché → carte déjà utilisée, annulée, ou en cours
    const carte = await prisma.carte.findUnique({ where:{ id:payload.carteId }, select:{ statut:true } });
    if (!carte) return res.status(404).json({ error:'Carte introuvable' });
    if (carte.statut === 'UTILISEE')              return res.status(409).json({ error:'Cette carte a déjà été utilisée' });
    if (carte.statut === 'ANNULEE')               return res.status(409).json({ error:'Cette carte a été annulée' });
    if (carte.statut === 'EN_COURS_ACTIVATION')   return res.status(409).json({ error:'Activation déjà en cours. Veuillez patienter.' });
    return res.status(409).json({ error:'Carte non disponible' });
  }

  // ── Étape 2 : valider le reste et créditer ────────────────────────
  try {
    const carte = await prisma.carte.findUnique({ where:{ id:payload.carteId } });
    if (!carte) throw new Error('Carte introuvable après verrouillage');

    if (!verifyHashedCode(codeValidation, carte.codeValidation)) {
      // Libérer le verrou si code invalide
      await prisma.carte.update({ where:{ id:carte.id }, data:{ activationLock:false, activationLockAt:null, statut:'VENDUE' } });
      await prisma.auditLog.create({ data:{ action:'ECHEC_CODE_VALIDATION', entite:'Carte', entiteId:carte.id, actorId:req.user!.userId } });
      return res.status(400).json({ error:'Code de validation incorrect. Vérifiez le verso de votre carte.' });
    }

    const compte = await prisma.compte.findUnique({ where:{ userId:req.user!.userId } });
    if (!compte) throw new Error('Compte introuvable');
    if (compte.statut !== 'ACTIF') { await prisma.carte.update({ where:{ id:carte.id }, data:{ activationLock:false, activationLockAt:null, statut:'VENDUE' } }); return res.status(403).json({ error:'Votre compte n\'est pas actif' }); }

    const [cfgFrais, cfgLcp] = await Promise.all([
      prisma.config.findUnique({ where:{ cle:'FRAIS_TAUX' } }),
      prisma.config.findUnique({ where:{ cle:'PART_LCP' } }),
    ]);
    const tauxFrais = parseFloat(cfgFrais?.valeur || '0.01');
    const tauxLcp   = parseFloat(cfgLcp?.valeur   || '0.006');
    const mnt  = Number(carte.montant);
    const frais     = Math.ceil(mnt * tauxFrais);
    const partLcp   = Math.round(mnt * tauxLcp);
    const partDist  = frais - partLcp;
    const net       = mnt - frais;

    // Transaction atomique — marquer UTILISEE en même temps que le crédit
    const [transaction] = await prisma.$transaction([
      prisma.transaction.create({ data:{ reference:`TXN-${Date.now()}`, type:'DEPOT_CARTE', montant:mnt, frais, montantNet:net, statut:'SUCCES', compteId:compte.id, carteId:carte.id, description:`Dépôt carte ${carte.reference}`, metadata:{ canal:'APP', partLcp, partDist } } }),
      prisma.compte.update({ where:{ id:compte.id }, data:{ solde:{ increment:net } } }),
      // Marque UTILISEE + libère le verrou atomiquement
      prisma.carte.update({ where:{ id:carte.id }, data:{ statut:'UTILISEE', activationLock:false, activationLockAt:null, usedAt:new Date(), usedByCompteId:compte.id } }),
    ]);

    await enregistrerVersement(compte.id, net, transaction.id).catch(() => {});

    await prisma.auditLog.create({ data:{ action:'DEPOT_CARTE', entite:'Transaction', entiteId:transaction.id, actorId:req.user!.userId, details:{ carteRef:carte.reference, mnt, frais, net } } });

    const compteUpdated = await prisma.compte.findUnique({ where:{ id:compte.id } });
    const nouveauSolde  = Number(compteUpdated?.solde);
    const user = await prisma.user.findUnique({ where:{ id:req.user!.userId } });

    // [FIX] Notification multi-canal SANS répartition des frais côté client
    if (user) {
      const msgSms = `LCP SEMENCE: Recharge OK ${user.prenom}!\nCarte: ${carte.reference}\n+${fmt(net)} credite.\nSolde: ${fmt(nouveauSolde)}.\nRef: ${transaction.reference}`;
      const tplEmail = emailTpl.depotSucces(`${user.prenom} ${user.nom}`, transaction.reference, mnt, net, nouveauSolde);
      notifier({
        userId:        user.id,
        telephone:     user.telephone,
        whatsapp:      user.whatsapp,
        email:         user.email?.includes('@semence-noemail.ci') ? null : user.email,
        notifWhatsapp: user.notifWhatsapp,
        notifEmail:    user.notifEmail,
        messageSms:    msgSms,
        sujetEmail:    tplEmail.sujet,
        htmlEmail:     tplEmail.html,
        transactionId: transaction.id,
      }).catch(() => {});
    }

    // [FIX] Réponse client SANS répartition des frais (supprimée comme demandé)
    return res.json({
      success:       true,
      message:       'Épargne créditée avec succès !',
      data: {
        transactionRef: transaction.reference,
        montant:        mnt,
        frais,
        montantNet:     net,
        nouveauSolde,
        // partLcp/partDist supprimés de la réponse client
      }
    });

  } catch (err: any) {
    // En cas d'erreur : libérer le verrou
    await prisma.carte.updateMany({ where:{ id:payload.carteId, statut:'EN_COURS_ACTIVATION' }, data:{ activationLock:false, activationLockAt:null, statut:'VENDUE' } }).catch(() => {});
    console.error('[activerCarte]', err);
    return res.status(500).json({ error:`Erreur lors de l'activation : ${err.message}` });
  }
}

function fmt(n: number) { return new Intl.NumberFormat('fr-CI').format(Math.round(n)) + ' F'; }

export async function attribuerCarte(req: Request, res: Response) {
  const { distributeurId, conseillerId } = req.body;
  const carte = await prisma.carte.findUnique({ where:{ id:req.params.id } });
  if (!carte) return res.status(404).json({ error:'Carte introuvable' });
  if (carte.statut !== 'DISPONIBLE') return res.status(409).json({ error:'Carte non disponible' });
  await prisma.carte.update({ where:{ id:carte.id }, data:{ distributeurId:distributeurId||carte.distributeurId, conseillerId:conseillerId||carte.conseillerId, statut:'VENDUE' } });
  return res.json({ success:true, message:'Carte attribuée avec succès' });
}

export async function listerCartes(req: Request, res: Response) {
  const page   = parseInt(req.query.page as string || '1');
  const limit  = parseInt(req.query.limit as string || '20');
  const statut = req.query.statut as string | undefined;
  const lot    = req.query.lot as string | undefined;
  const where: any = {};
  if (statut) where.statut = statut;
  if (lot)    where.lotId  = lot;
  if (req.user!.role === 'DISTRIBUTEUR_INTERNE' || req.user!.role === 'DISTRIBUTEUR_AGREE') {
    const d = await prisma.distributeur.findFirst({ where:{ userId:req.user!.userId } });
    if (d) where.distributeurId = d.id;
  } else if (req.user!.role === 'CONSEILLER') {
    const c = await prisma.conseiller.findFirst({ where:{ userId:req.user!.userId } });
    if (c) where.conseillerId = c.id;
  }
  const [total, cartes] = await Promise.all([
    prisma.carte.count({ where }),
    prisma.carte.findMany({ where, skip:(page-1)*limit, take:limit, orderBy:{ createdAt:'desc' }, select:{ id:true, reference:true, refCourt:true, montant:true, statut:true, createdAt:true, usedAt:true, lot:{ select:{ reference:true, statut:true } } } })
  ]);
  return res.json({ data:cartes, pagination:{ total, page, limit, pages:Math.ceil(total/limit) } });
}
