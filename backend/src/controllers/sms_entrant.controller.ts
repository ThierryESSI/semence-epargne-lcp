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
import prisma from '../utils/prisma';
import { verifyHashedCode } from '../utils/crypto';
import { sendSms } from '../utils/sms';
import { enregistrerVersement } from '../services/epargne.service';

const WEBHOOK_SECRET = process.env.SMS_WEBHOOK_SECRET || 'lcp_sms_secret_2026';
function fmt(n: number) { return new Intl.NumberFormat('fr-CI').format(Math.round(n)) + ' F'; }

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
  const texteAide = aide ? '\nFormat: RECHARGE [N-COMPTE] [REF-CARTE] [CODE4]\nEx: RECHARGE SE-A1B2 CSEM-8C0G 5781' : '';
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

async function traiterSmsRecharge(telExpéditeur: string, message: string) {
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

  const carte = await prisma.carte.findFirst({
    where: { OR: [{ reference: refCarte }, { reference: { contains: refCarte } }] }
  });
  if (!carte) { await smsErreur(telExpéditeur, `Carte ${refCarte} introuvable. Verifiez la reference.`); return; }
  if (carte.statut === 'UTILISEE') { await smsErreur(telExpéditeur, `Carte ${refCarte} deja utilisee.`, false); return; }
  if (carte.statut === 'ANNULEE')  { await smsErreur(telExpéditeur, `Carte ${refCarte} annulee. Contactez LCP: 2735960599.`, false); return; }

  if (code.length !== 4 || !/^\d{4}$/.test(code)) {
    await smsErreur(telExpéditeur, 'Code invalide. Le code fait 4 chiffres numeriques.'); return;
  }
  if (!verifyHashedCode(code, carte.codeValidation)) {
    await prisma.auditLog.create({ data: { action:'SMS_RECHARGE_CODE_INVALIDE', entite:'Carte', entiteId:carte.id, actorId:compte.userId, details:{ telExpéditeur, refCarte } } });
    await smsErreur(telExpéditeur, `Code incorrect pour la carte ${refCarte}. Verifiez le verso.`); return;
  }

  const [cfgFrais, cfgLcp] = await Promise.all([
    prisma.config.findUnique({ where: { cle: 'FRAIS_TAUX' } }),
    prisma.config.findUnique({ where: { cle: 'PART_LCP' } }),
  ]);
  const tauxFrais = parseFloat(cfgFrais?.valeur || '0.01');
  const tauxLcp   = parseFloat(cfgLcp?.valeur   || '0.006');
  const montant   = Number(carte.montant);
  const frais     = Math.ceil(montant * tauxFrais);
  const partLcp   = Math.round(montant * tauxLcp);
  const partDist  = frais - partLcp;
  const net       = montant - frais;

  const [transaction] = await prisma.$transaction([
    prisma.transaction.create({ data: { reference:`TXN-SMS-${Date.now()}`, type:'DEPOT_CARTE', montant, frais, montantNet:net, statut:'SUCCES', compteId:compte.id, carteId:carte.id, description:`Recharge SMS — carte ${carte.reference}`, metadata:{ canal:'SMS', telExpéditeur, partLcp, partDist } } }),
    prisma.compte.update({ where:{ id:compte.id }, data:{ solde:{ increment:net } } }),
    prisma.carte.update({ where:{ id:carte.id }, data:{ statut:'UTILISEE', usedAt:new Date(), usedByCompteId:compte.id } }),
  ]);

  await enregistrerVersement(compte.id, net, transaction.id).catch(() => {});

  const compteUpdated = await prisma.compte.findUnique({ where:{ id:compte.id } });
  const nouveauSolde  = Number(compteUpdated?.solde || 0);

  await prisma.auditLog.create({ data: { action:'SMS_RECHARGE_SUCCES', entite:'Transaction', entiteId:transaction.id, actorId:compte.userId, details:{ canal:'SMS', montant, frais, net, refCarte, telExpéditeur } } });
  console.log(`[SMS Entrant] ✅ ${compte.user.prenom} ${compte.user.nom} +${fmt(net)} | Solde: ${fmt(nouveauSolde)}`);

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
