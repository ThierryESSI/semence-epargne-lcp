// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/controllers/sync.controller.ts
// Traite un lot d'opérations effectuées hors-ligne (offline queue)
// Chaque opération est rejouée côté serveur dans l'ordre chronologique.

import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { verifyQrToken, verifyHashedCode, generateCodeActeur, generateRef } from '../utils/crypto';
import { sendSms, tpl } from '../utils/sms';
import { carteAppartientA, clientAppartientA, conseillerAutorise } from '../utils/acces';

interface OfflineOp {
  id:        string;   // UUID généré côté client
  type:      'DEPOT_CARTE' | 'OUVERTURE_COMPTE' | 'ACTIVATION_COMPTE';
  createdAt: string;   // ISO timestamp de l'opération offline
  payload:   any;
}

interface SyncResult {
  id:      string;
  type:    string;
  success: boolean;
  message: string;
  data?:   any;
  error?:  string;
}

export async function syncOfflineQueue(req: Request, res: Response) {
  const { operations }: { operations: OfflineOp[] } = req.body;

  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ error: 'operations[] requis et non vide' });
  }

  // Limiter à 100 opérations par batch
  if (operations.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 opérations par synchronisation' });
  }

  // Trier par date de création (ordre chronologique)
  const sorted = [...operations].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const results: SyncResult[] = [];

  for (const op of sorted) {
    try {
      let result: SyncResult;

      switch (op.type) {

        // ─── Dépôt carte Semence Épargne ───────────────────────────────────
        case 'DEPOT_CARTE':
          result = await syncDepotCarte(op, req.user!.userId, req.user!.role);
          break;

        // ─── Ouverture compte client ────────────────────────────────────────
        case 'OUVERTURE_COMPTE':
          result = await syncOuvertureCompte(op, req.user!.userId, req.user!.role);
          break;

        // ─── Activation compte ──────────────────────────────────────────────
        case 'ACTIVATION_COMPTE':
          result = await syncActivationCompte(op, req.user!.userId, req.user!.role);
          break;

        default:
          result = { id: op.id, type: op.type, success: false, message: '', error: `Type d'opération inconnu : ${op.type}` };
      }

      results.push(result);
    } catch (err: any) {
      results.push({ id: op.id, type: op.type, success: false, message: '', error: err.message || 'Erreur interne' });
    }
  }

  // Log d'audit global
  await prisma.auditLog.create({
    data: {
      action:   'SYNC_OFFLINE',
      entite:   'SyncBatch',
      entiteId: `batch-${Date.now()}`,
      actorId:  req.user!.userId,
      details:  {
        total:   results.length,
        succes:  results.filter(r => r.success).length,
        echecs:  results.filter(r => !r.success).length,
      }
    }
  });

  return res.json({
    success: true,
    total:   results.length,
    succes:  results.filter(r => r.success).length,
    echecs:  results.filter(r => !r.success).length,
    results,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync : Dépôt carte
// ─────────────────────────────────────────────────────────────────────────────
async function syncDepotCarte(op: OfflineOp, actorId: string, actorRole: string): Promise<SyncResult> {
  const { qrEpargneToken, codeValidation } = op.payload;

  // Vérifier que cette opération offline n'a pas déjà été traitée (idempotence)
  const existing = await prisma.auditLog.findFirst({
    where: { details: { path: ['offlineId'], equals: op.id } }
  });
  if (existing) {
    return { id: op.id, type: op.type, success: true, message: 'Déjà synchronisée (doublon ignoré)' };
  }

  const { valid, payload } = verifyQrToken(qrEpargneToken);
  if (!valid || payload?.type !== 'EPARGNE') {
    return { id: op.id, type: op.type, success: false, message: '', error: 'QR Code épargne invalide' };
  }

  const carte = await prisma.carte.findUnique({ where: { id: payload.carteId } });
  if (!carte) return { id: op.id, type: op.type, success: false, message: '', error: 'Carte introuvable' };
  if (carte.statut !== 'DISPONIBLE' && carte.statut !== 'VENDUE') {
    return { id: op.id, type: op.type, success: false, message: '', error: `Carte ${carte.statut} — déjà utilisée ou annulée` };
  }
  // [SÉCURITÉ] La carte doit appartenir au réseau de l'acteur (conseiller/distributeur)
  if (!(await carteAppartientA(carte.id, actorRole, actorId))) {
    return { id: op.id, type: op.type, success: false, message: '', error: 'Cette carte ne fait pas partie de votre réseau' };
  }
  if (!verifyHashedCode(codeValidation, carte.codeValidation)) {
    return { id: op.id, type: op.type, success: false, message: '', error: 'Code de validation incorrect' };
  }

  // [FIX] Le dépôt offline doit créditer le compte du CLIENT (propriétaire de la carte),
  // pas le compte de l'acteur (conseiller/distributeur qui synchronise).
  // Le QR code contient le userId du client propriétaire via payload.userId.
  const clientUserId = payload.userId;
  if (!clientUserId) {
    return { id: op.id, type: op.type, success: false, message: '', error: 'QR Code ne contient pas d\'identifiant client' };
  }
  const compte = await prisma.compte.findUnique({ where: { userId: clientUserId } });
  if (!compte || compte.statut !== 'ACTIF') {
    return { id: op.id, type: op.type, success: false, message: '', error: 'Compte inactif ou introuvable' };
  }

  const [cfgFrais, cfgLcp] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { cle: 'FRAIS_TAUX' } }),
    prisma.siteConfig.findUnique({ where: { cle: 'PART_LCP' } }),
  ]);
  const taux    = parseFloat(cfgFrais?.valeur || '0.01');
  const tauxLcp = parseFloat(cfgLcp?.valeur   || '0.006');
  const mnt     = Number(carte.montant);
  const frais   = Math.ceil(mnt * taux);
  const partLcp = Math.round(mnt * tauxLcp);
  const partDist = frais - partLcp;
  const net     = mnt - frais;

  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        reference:   generateRef('TXN'),
        type:        'DEPOT_CARTE',
        montant:     mnt,
        frais,
        montantNet:  net,
        statut:      'SUCCES',
        compteId:    compte.id,
        carteId:     carte.id,
        description: `Dépôt offline ${carte.reference} — ${new Date(op.createdAt).toLocaleString('fr-CI')}`,
        metadata:    { offlineId: op.id, offlineAt: op.createdAt, partLcp, partDist },
      }
    }),
    prisma.compte.update({ where: { id: compte.id }, data: { solde: { increment: net } } }),
    prisma.carte.update({ where: { id: carte.id }, data: { statut: 'UTILISEE', usedAt: new Date(op.createdAt), usedByCompteId: compte.id } }),
  ]);

  await prisma.auditLog.create({
    data: { action: 'SYNC_DEPOT_CARTE', entite: 'Transaction', entiteId: transaction.id, actorId,
      details: { offlineId: op.id, offlineAt: op.createdAt, carteRef: carte.reference, mnt, frais, net, partLcp, partDist } }
  });

  const updated = await prisma.compte.findUnique({ where: { id: compte.id } });
  const user    = await prisma.user.findUnique({ where: { id: clientUserId }, select: { telephone: true } });
  if (user) sendSms({ to: user.telephone, message: tpl.depotSucces(mnt, frais, Number(updated?.solde)), userId: clientUserId, transactionId: transaction.id }).catch(() => {});

  return {
    id: op.id, type: op.type, success: true,
    message: 'Dépôt synchronisé avec succès',
    data: { transactionRef: transaction.reference, montant: mnt, frais, montantNet: net, nouveauSolde: Number(updated?.solde), repartition: { partLcp, partDist } }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync : Ouverture de compte
// ─────────────────────────────────────────────────────────────────────────────
async function syncOuvertureCompte(op: OfflineOp, actorId: string, actorRole: string): Promise<SyncResult> {
  const { nom, prenom, email, telephone, password, region, ville, commune, typeCompte = 'ORDINAIRE', conseillerId } = op.payload;

  if (!nom || !prenom || !telephone || !password)
    return { id: op.id, type: op.type, success: false, message: '', error: 'Champs requis manquants (nom, prenom, telephone, password)' };
  if (String(password).length < 8)
    return { id: op.id, type: op.type, success: false, message: '', error: 'Mot de passe trop court (min 8 caractères)' };

  // [SÉCURITÉ] Le conseiller cible doit appartenir au réseau de l'acteur
  if (conseillerId && !(await conseillerAutorise(conseillerId, actorRole, actorId)))
    return { id: op.id, type: op.type, success: false, message: '', error: 'Ce conseiller ne fait pas partie de votre réseau' };
  let conseillerFinal = conseillerId;
  if (!conseillerFinal) {
    const premier = await prisma.conseiller.findFirst({ orderBy: { createdAt: 'asc' } });
    conseillerFinal = premier?.id;
  }
  if (!conseillerFinal)
    return { id: op.id, type: op.type, success: false, message: '', error: 'Aucun conseiller disponible' };

  // Idempotence : vérifier si le compte existe déjà (email ou téléphone)
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { telephone }] } });
  if (existing) {
    return { id: op.id, type: op.type, success: true, message: `Compte déjà existant pour ${email} (doublon ignoré)` };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, telephone, passwordHash, nom: nom.toUpperCase(), prenom, role: 'CLIENT', actif: true }
  });

  const codeClient   = generateCodeActeur('CLI');
  const numeroCompte = `SE-${user.id.slice(-8).toUpperCase()}`;

  await prisma.client.create({ data: { code: codeClient, region, ville, commune, conseillerId: conseillerFinal, userId: user.id } });
  await prisma.compte.create({ data: { numeroCompte, rib: `RI-${numeroCompte}`, type: typeCompte as any, userId: user.id } });

  await prisma.auditLog.create({
    data: { action: 'SYNC_OUVERTURE_COMPTE', entite: 'User', entiteId: user.id, actorId,
      details: { offlineId: op.id, offlineAt: op.createdAt, codeClient, numeroCompte } }
  });

  const appUrl = process.env.FRONTEND_URL || 'https://app.semenceep.ci';
  sendSms({ to: telephone, message: tpl.compteOuvert(`${prenom} ${nom}`, numeroCompte, telephone, password, `${appUrl}/client`), userId: user.id }).catch(() => {});

  return { id: op.id, type: op.type, success: true, message: 'Compte synchronisé avec succès', data: { userId: user.id, codeClient, numeroCompte } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync : Activation de compte
// ─────────────────────────────────────────────────────────────────────────────
async function syncActivationCompte(op: OfflineOp, actorId: string, actorRole: string): Promise<SyncResult> {
  const { userId } = op.payload;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { id: op.id, type: op.type, success: false, message: '', error: 'Utilisateur introuvable' };
  // [SÉCURITÉ] Seuls des comptes CLIENT peuvent être activés via la synchronisation
  // (interdit d'activer un MASTER/SUPER_ADMIN par ce canal).
  if (user.role !== 'CLIENT')
    return { id: op.id, type: op.type, success: false, message: '', error: 'Seuls les comptes clients peuvent être activés' };
  // [SÉCURITÉ] Le client doit appartenir au réseau de l'acteur (sauf MASTER/SUPER_ADMIN)
  if (actorRole !== 'MASTER' && actorRole !== 'SUPER_ADMIN' && !(await clientAppartientA(userId, actorRole, actorId)))
    return { id: op.id, type: op.type, success: false, message: '', error: 'Ce client ne fait pas partie de votre réseau' };
  if (user.actif) return { id: op.id, type: op.type, success: true, message: 'Compte déjà actif (doublon ignoré)' };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { actif: true } }),
    prisma.compte.update({ where: { userId }, data: { statut: 'ACTIF' } }),
  ]);

  sendSms({ to: user.telephone, message: tpl.compteActive(`${user.prenom} ${user.nom}`), userId }).catch(() => {});

  return { id: op.id, type: op.type, success: true, message: 'Activation synchronisée' };
}
