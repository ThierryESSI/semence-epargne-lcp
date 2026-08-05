// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/controllers/sms_entrant.controller.ts
// Activation de carte par SMS — zone rurale GSM
// Format : RECHARGE [N°COMPTE] [REF-CARTE] [CODE4]
import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { verifyHashedCode, generateRef } from '../utils/crypto';
import { sendSms } from '../utils/sms';
import { sendWhatsApp } from '../utils/notifications';
import { enregistrerVersement } from '../services/epargne.service';

// [SÉCURITÉ] Fail-closed : pas de secret par défaut. Si SMS_WEBHOOK_SECRET
// n'est pas défini, le webhook refuse les requêtes (évite un secret connu).
const WEBHOOK_SECRET = process.env.SMS_WEBHOOK_SECRET;
function fmt(n: number) { return new Intl.NumberFormat('fr-CI').format(Math.round(n)) + ' F'; }

// Garde anti-force-brute : max 5 codes erronés par carte sur une fenêtre de 15 min
const tentativeEchecs = new Map<string, { count: number; resetAt: number }>();
function carteCodeAutorise(carteId: string): boolean {
  const e = tentativeEchecs.get(carteId);
  if (!e || Date.now() > e.resetAt) return true;
  return e.count < 5;
}
function carteCodeEchec(carteId: string) {
  const e = tentativeEchecs.get(carteId);
  if (!e || Date.now() > e.resetAt) {
    tentativeEchecs.set(carteId, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
  } else {
    e.count += 1;
  }
}
function carteCodeSucces(carteId: string) { tentativeEchecs.delete(carteId); }

// [FIX1] Fonction unique de normalisation — supprime doublons normaliserTel/telNormalize
function normalizeTel(tel: string): string {
  // Retourne les 8 derniers chiffres significatifs pour comparaison
  return tel.replace(/\D/g, '').replace(/^225/, '').replace(/^0/, '').slice(-8);
}

function normaliserTelEnvoi(tel: string): string {
  const clean = tel.replace(/\s+/g, '').replace(/^\+/, '');
  if (clean.startsWith('225'))   return '+' + clean;
  if (clean.startsWith('00225')) return '+' + clean.slice(2);
  if (clean.length === 10)       return '+225' + clean.slice(0);  // 07XXXXXXXX
  if (clean.length === 8)        return '+225' + clean;
  return '+' + clean;
}

// [FIX2] Validation numéro CI : 07, 05, 01, 25, 27 + 8 chiffres = 10 chiffres total
function validerTelCI(tel: string): boolean {
  const clean = tel.replace(/\D/g, '');
  // Avec indicatif 225 : 22507XXXXXXXX (13 chiffres)
  const local = clean.startsWith('225') ? clean.slice(3) : clean;
  if (local.length !== 10) return false;
  const prefixes = ['07','05','01','25','27'];
  return prefixes.some(p => local.startsWith(p));
}

interface ParsedSMS { commande: string; numeroCompte: string; refCarte: string; code: string; }

function parserSMS(body: string): ParsedSMS | null {
  const cleaned = body.trim().toUpperCase().replace(/\s+/g, ' ');
  const parts   = cleaned.split(' ');
  if (parts.length < 4) return null;
  const cmd = parts[0];
  if (!['RECHARGE', 'R', 'EPARGNE'].includes(cmd)) return null;
  return { commande: cmd, numeroCompte: parts[1], refCarte: parts[2], code: parts[3] };
}

async function smsErreur(tel: string, msg: string, aide = true) {
  const texteAide = aide ? `
Format: RECHARGE [N-COMPTE] [REF-CARTE] [CODE4]
Ex: RECHARGE SE-A1B2 CSE-8C0G 5781` : '';
  await sendSms({ to: tel, message: `LCP SEMENCE: ${msg}${texteAide}` }).catch(() => {});
}

export async function webhookSmsEntrant(req: Request, res: Response) {
  const secret = req.headers['x-webhook-secret'] || req.query.secret;
  if (secret !== WEBHOOK_SECRET) {
    console.warn('[SMS Entrant] Webhook secret invalide');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const expediteur: string = req.body.expediteur || req.body.from || req.body.sender || '';
  const message:    string = req.body.message    || req.body.text || req.body.sms    || '';
  if (!expediteur || !message) return res.status(400).json({ error: 'expediteur et message requis' });

  const telNormalise = normaliserTelEnvoi(expediteur);
  console.log(`[SMS Entrant] De: ${telNormalise} → "${message}"`);

  // Répondre immédiatement à SpecialSMS (éviter timeout webhook)
  res.status(200).json({ received: true });

  traiterSmsRecharge(telNormalise, message).catch(err =>
    console.error('[SMS Entrant] Erreur traitement:', err?.message)
  );
}

// Alerte au MASTER/équipe à chaque recharge — numéro dédié configurable
// dans Paramètres → Canal SMS zone rurale → ALERTE_RECHARGE_TEL
async function alerterRechargeSMS(canal: string, compte: any, refCarte: string, montant: number, net: number, solde: number, reference: string) {
  try {
    const cfg = await prisma.siteConfig.findUnique({ where: { cle: 'ALERTE_RECHARGE_TEL' } });
    const tel = cfg?.valeur?.trim();
    if (!tel) return;
    const message = `LCP SEMENCE: RECHARGE ${canal} — ${compte.user.prenom} ${compte.user.nom}
Compte: ${compte.numeroCompte}
Carte: ${refCarte}
Montant: ${fmt(montant)}
Net: ${fmt(net)}
Solde: ${fmt(solde)}
Ref: ${reference}`;
    sendSms({ to: tel, message }).catch(() => {});
    sendWhatsApp(tel, message).catch(() => {});
    console.log(`[SMS Entrant] Alerte ${canal} envoyée → ${tel}`);
  } catch (err: any) {
    console.error('[SMS Entrant] Erreur alerte:', err?.message);
  }
}

async function traiterSmsRecharge(telExpéditeur: string, message: string, canal = 'SMS') {
  const parsed = parserSMS(message);
  if (!parsed) {
    await smsErreur(telExpéditeur, 'Format invalide. Envoyez RECHARGE suivi de vos informations.');
    return;
  }
  const { numeroCompte, refCarte, code } = parsed;

  const compte = await prisma.compte.findUnique({
    where: { numeroCompte },
    include: { user: { select: { id:true, nom:true, prenom:true, telephone:true } } }
  });
  if (!compte) { await smsErreur(telExpéditeur, `Compte ${numeroCompte} introuvable.`); return; }

  // [FIX1] Comparaison normalisée — évite mismatch +225 vs 07
  if (normalizeTel(compte.user.telephone) !== normalizeTel(telExpéditeur)) {
    await smsErreur(telExpéditeur, `Ce numero n\'est pas autorise a recharger le compte ${numeroCompte}.`, false);
    await prisma.auditLog.create({ data: { action:'SMS_RECHARGE_TENTATIVE_FRAUDE', entite:'Compte', entiteId:compte.id, actorId:compte.userId, details:{ telExpéditeur } } });
    return;
  }
  if (compte.statut !== 'ACTIF') {
    await smsErreur(telExpéditeur, `Votre compte est ${compte.statut}. Contactez LCP: 2735960599.`, false);
    return;
  }

  // Recherche : référence complète OU référence courte exacte (pas de correspondance partielle)
  const carte = await prisma.carte.findFirst({
    where: {
      OR: [
        { reference: refCarte },
        { refCourt: refCarte },
      ]
    }
  });
  if (!carte) { await smsErreur(telExpéditeur, `Carte ${refCarte} introuvable. Verifiez la reference (CSE-XXXXXXXX).`); return; }
  if (carte.statut === 'UTILISEE') { await smsErreur(telExpéditeur, `Carte ${refCarte} deja utilisee.`, false); return; }
  if (carte.statut === 'ANNULEE')  { await smsErreur(telExpéditeur, `Carte ${refCarte} annulee. Contactez LCP: 2735960599.`, false); return; }
  if (carte.lotId) {
    const lot = await prisma.lotCarte.findUnique({ where: { id: carte.lotId }, select: { statut: true } });
    if (lot && lot.statut === 'GRILLE') { await smsErreur(telExpéditeur, `Carte ${refCarte} rattachee a un lot grille pour fraude. Contactez LCP: 2735960599.`, false); return; }
  }

  if (code.length !== 4 || !/^\d{4}$/.test(code)) {
    await smsErreur(telExpéditeur, 'Code invalide. Le code fait 4 chiffres numeriques.'); return;
  }
  if (!carteCodeAutorise(carte.id)) {
    await smsErreur(telExpéditeur, 'Trop de tentatives de code. Reessayez dans 15 minutes.', false);
    return;
  }
  if (!verifyHashedCode(code, carte.codeValidation)) {
    carteCodeEchec(carte.id);
    await prisma.auditLog.create({ data: { action:'SMS_RECHARGE_CODE_INVALIDE', entite:'Carte', entiteId:carte.id, actorId:compte.userId, details:{ telExpéditeur, refCarte } } });
    await smsErreur(telExpéditeur, `Code incorrect pour la carte ${refCarte}. Verifiez le verso.`); return;
  }
  carteCodeSucces(carte.id);

  const [cfgFrais, cfgLcp] = await Promise.all([
    prisma.siteConfig.findUnique({ where: { cle: 'FRAIS_TAUX' } }),
    prisma.siteConfig.findUnique({ where: { cle: 'PART_LCP' } }),
  ]);
  const tauxFrais = parseFloat(cfgFrais?.valeur || '0.01');
  const tauxLcp   = parseFloat(cfgLcp?.valeur   || '0.006');
  const montant   = Number(carte.montant);
  const frais     = Math.ceil(montant * tauxFrais);
  const partLcp   = Math.round(montant * tauxLcp);
  const partDist  = frais - partLcp;
  const net       = montant - frais;

  // [SÉCURITÉ] Consommation atomique de la carte — élimine la double-dépense
  // (deux SMS concurrents : seul le premier remporte le updateMany conditionnel)
  let transaction;
  try {
    transaction = await prisma.$transaction(async (tx) => {
      const claim = await tx.carte.updateMany({
        where: { id: carte.id, statut: { in: ['DISPONIBLE', 'VENDUE'] } },
        data: { statut: 'UTILISEE', usedAt: new Date(), usedByCompteId: compte.id },
      });
      if (claim.count !== 1) return null; // carte déjà consommée par un autre canal
      const t = await tx.transaction.create({ data: { reference:generateRef('TXN'), type:'DEPOT_CARTE', montant, frais, montantNet:net, statut:'SUCCES', compteId:compte.id, carteId:carte.id, description:`Recharge ${canal} — carte ${carte.reference}`, metadata:{ canal, telExpéditeur, partLcp, partDist } } });
      await tx.compte.update({ where:{ id:compte.id }, data:{ solde:{ increment:net } } });
      return t;
    });
  } catch (err: any) {
    // Rembobiner le statut si la transaction a échoué après le claim
    await prisma.carte.updateMany({ where:{ id:carte.id, statut:'UTILISEE', usedByCompteId:compte.id }, data:{ statut:'DISPONIBLE', usedAt:null, usedByCompteId:null } }).catch(() => {});
    throw err;
  }
  if (!transaction) {
    await smsErreur(telExpéditeur, `Carte ${refCarte} non disponible ou deja utilisee.`, false);
    return;
  }

  await enregistrerVersement(compte.id, net, transaction.id).catch(() => {});

  const compteUpdated = await prisma.compte.findUnique({ where:{ id:compte.id } });
  const nouveauSolde  = Number(compteUpdated?.solde || 0);

  await prisma.auditLog.create({ data: { action:'SMS_RECHARGE_SUCCES', entite:'Transaction', entiteId:transaction.id, actorId:compte.userId, details:{ canal, montant, frais, net, refCarte, telExpéditeur } } });
  console.log(`[SMS Entrant] ✅ ${compte.user.prenom} ${compte.user.nom} +${fmt(net)} | Solde: ${fmt(nouveauSolde)}`);

  // [ALERTE] Prévenir le numéro dédié (MASTER/équipe) via SMS + WhatsApp
  await alerterRechargeSMS(canal, compte, refCarte, montant, net, nouveauSolde, transaction.reference);

  await sendSms({ to:telExpéditeur, message:`LCP SEMENCE: Recharge OK ${compte.user.prenom} ${compte.user.nom}!
Carte: ${refCarte}
+${fmt(net)} credite.
Solde: ${fmt(nouveauSolde)}.
Ref: ${transaction.reference}`, userId:compte.userId, transactionId:transaction.id }).catch(() => {});
}

export async function testerWebhook(req: Request, res: Response) {
  const { telephone, message } = req.body;
  if (!telephone || !message) return res.status(400).json({ error: 'telephone et message requis' });
  try {
    await traiterSmsRecharge(normaliserTelEnvoi(telephone), message);
    return res.json({ success:true, message:'SMS traité. Vérifiez les logs.' });
  } catch (err:any) { return res.status(500).json({ error:err.message }); }
}

export async function historiqueRechargesSMS(req: Request, res: Response) {
  try {
    const page  = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where:{ action:{ startsWith:'SMS_RECHARGE' } } }),
      prisma.auditLog.findMany({ where:{ action:{ startsWith:'SMS_RECHARGE' } }, orderBy:{ createdAt:'desc' }, skip:(page-1)*limit, take:limit }),
    ]);
    return res.json({ data:logs, pagination:{ total, page, limit, pages:Math.ceil(total/limit) } });
  } catch (err:any) { return res.status(500).json({ error:err.message }); }
}


// ═══════════════════════════════════════════════════════════════════
// OPTION C — WhatsApp Business API entrant
// Webhook reçu de Meta WhatsApp Business API
// URL à configurer dans Meta : https://api.semenceep.ci/api/sms/whatsapp
// ═══════════════════════════════════════════════════════════════════

// Vérification token Meta (obligatoire pour valider le webhook)
export async function whatsappVerify(req: Request, res: Response) {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected  = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === expected) {
    console.log('[WhatsApp] Webhook verifie avec succes');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Token invalide' });
}

// Réception d'un message WhatsApp entrant
export async function whatsappEntrant(req: Request, res: Response) {
  // Repondre immediatement a Meta (eviter timeout 20s)
  res.status(200).json({ status: 'ok' });

  // [SÉCURITÉ] Authentification du webhook avant tout traitement
  if (!whatsappWebhookAutorise(req)) {
    console.error('[WhatsApp Entrant] Webhook NON AUTHENTIFIE — requete rejetee. Configurez WHATSAPP_APP_SECRET (Railway + Meta) ou WHATSAPP_WEBHOOK_SECRET.');
    return;
  }

  try {
    const body = req.body;

    // Extraire le message et l'expediteur depuis le format Meta
    const entry    = body?.entry?.[0];
    const changes  = entry?.changes?.[0];
    const value    = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    const msg      = messages[0];
    const expediteur = msg.from;           // Format: 2250712345678
    const texte    = msg.text?.body || '';

    if (!expediteur || !texte) return;

    console.log(`[WhatsApp Entrant] De: +${expediteur} → "${texte}"`);

    // Meme logique de traitement que le SMS GSM
    const telFormat = '+' + expediteur;
    await traiterSmsRecharge(telFormat, texte, 'WHATSAPP');

  } catch (err: any) {
    console.error('[WhatsApp Entrant] Erreur:', err?.message);
  }
}

// Authentification du webhook WhatsApp : signature HMAC Meta (recommandé)
// ou en secours un secret simple (header x-webhook-secret). Fail-closed.
function whatsappWebhookAutorise(req: Request): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (appSecret) {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!signature) return false;
    const raw = (req as any).rawBody ?? JSON.stringify(req.body ?? {});
    const attendu = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(attendu, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (secret) {
    return (req.headers['x-webhook-secret'] || req.query.secret) === secret;
  }
  return false;
}
