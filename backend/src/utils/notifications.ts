// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/utils/notifications.ts
// Envoi multi-canal : SMS + WhatsApp + Email
import { sendSms } from './sms';
import prisma from './prisma';

// ── WhatsApp via WhatsApp Business API (Meta) ou Twilio ──────────────
// On utilise une API tierce simple (ex: callmebot.com pour démarrage,
// ou WhatsApp Business API en production)
export async function sendWhatsApp(telephone: string, message: string): Promise<boolean> {
  const wa = telephone.replace(/\D/g,'').replace(/^0/,'225');
  const apiKey = process.env.WHATSAPP_API_KEY;
  const apiUrl = process.env.WHATSAPP_API_URL; // ex: https://api.callmebot.com/whatsapp.php

  if (!apiKey || !apiUrl) {
    console.warn('[WhatsApp] API non configurée — SMS de secours envoyé');
    return false;
  }
  try {
    const params = new URLSearchParams({ phone: wa, text: message, apikey: apiKey });
    const res = await fetch(`${apiUrl}?${params}`, { signal: AbortSignal.timeout(10_000) });
    const ok  = res.ok;
    console.log(`[WhatsApp] ${ok ? '✓' : '✗'} → +${wa}`);
    return ok;
  } catch (err: any) {
    console.error(`[WhatsApp] Erreur → ${err?.message}`);
    return false;
  }
}

// ── Email via Nodemailer / Resend / SMTP ──────────────────────────────
async function sendEmail(email: string, sujet: string, html: string): Promise<boolean> {
  const smtpUrl  = process.env.SMTP_URL;      // smtp://user:pass@host:port
  const fromEmail = process.env.SMTP_FROM || 'noreply@semenceep.ci';

  if (!smtpUrl) {
    console.warn('[Email] SMTP non configuré');
    return false;
  }
  try {
    // Nodemailer dynamique
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport(smtpUrl);
    await transporter.sendMail({ from: `LCP SEMENCE <${fromEmail}>`, to: email, subject: sujet, html });
    console.log(`[Email] ✓ → ${email}`);
    return true;
  } catch (err: any) {
    console.error(`[Email] Erreur → ${err?.message}`);
    return false;
  }
}

// ── Notification unifiée — envoie sur tous les canaux activés ─────────
export interface NotifPayload {
  userId:        string;
  telephone:     string;
  whatsapp?:     string | null;
  email?:        string | null;
  notifSms?:     boolean;
  notifWhatsapp?: boolean;
  notifEmail?:   boolean;
  messageSms:    string;
  sujetEmail?:   string;
  htmlEmail?:    string;
  transactionId?: string;
}

export async function notifier(payload: NotifPayload) {
  const resultats: string[] = [];

  // SMS (toujours envoyé)
  if (payload.notifSms !== false) {
    const ok = await sendSms({ to: payload.telephone, message: payload.messageSms, userId: payload.userId, transactionId: payload.transactionId }).then(r => r.success).catch(() => false);
    resultats.push(ok ? 'SMS:OK' : 'SMS:ERR');
  }

  // WhatsApp (si activé et numéro disponible)
  if (payload.notifWhatsapp && payload.whatsapp) {
    const ok = await sendWhatsApp(payload.whatsapp, payload.messageSms);
    resultats.push(ok ? 'WA:OK' : 'WA:ERR');
  }

  // Email (si activé et email disponible + sujet + html)
  if (payload.notifEmail && payload.email && payload.sujetEmail && payload.htmlEmail) {
    const ok = await sendEmail(payload.email, payload.sujetEmail, payload.htmlEmail);
    resultats.push(ok ? 'EMAIL:OK' : 'EMAIL:ERR');
  }

  console.log(`[Notif] ${payload.userId} — ${resultats.join(' | ')}`);
}

// ── Templates email HTML ──────────────────────────────────────────────
export const emailTpl = {
  depotSucces: (nom: string, ref: string, montant: number, net: number, solde: number) => ({
    sujet: `✅ Recharge confirmée — ${formatF(net)}`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e4ebe5;border-radius:12px;overflow:hidden">
  <div style="background:#1a2e1c;padding:20px;text-align:center">
    <h2 style="color:#f4a11d;margin:0">🌱 SEMENCE ÉPARGNE</h2>
    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0;font-size:13px">Le Crédit Panafricain</p>
  </div>
  <div style="padding:24px">
    <h3 style="color:#2d6a4f">Bonjour ${nom},</h3>
    <p>Votre recharge a été <strong>créditée avec succès</strong> !</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#d8f3dc"><td style="padding:8px;font-weight:bold">Réf. transaction</td><td style="padding:8px;font-family:monospace">${ref}</td></tr>
      <tr><td style="padding:8px">Montant carte</td><td style="padding:8px">${formatF(montant)}</td></tr>
      <tr style="background:#f4f6f4"><td style="padding:8px">Net crédité</td><td style="padding:8px;font-weight:bold;color:#2d6a4f">${formatF(net)}</td></tr>
      <tr><td style="padding:8px">Nouveau solde</td><td style="padding:8px;font-weight:900;font-size:18px;color:#2d6a4f">${formatF(solde)}</td></tr>
    </table>
    <p style="color:#6b7c6d;font-size:12px">Le Crédit Panafricain · +225 27 35 96 05 99 · infos@semenceep.ci</p>
  </div>
</div>`
  }),

  virementEnvoye: (nom: string, ref: string, montant: number, destNom: string, solde: number) => ({
    sujet: `💸 Virement de ${formatF(montant)} effectué`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e4ebe5;border-radius:12px;overflow:hidden">
  <div style="background:#1a2e1c;padding:20px;text-align:center">
    <h2 style="color:#f4a11d;margin:0">🌱 SEMENCE ÉPARGNE</h2>
  </div>
  <div style="padding:24px">
    <h3 style="color:#2d6a4f">Bonjour ${nom},</h3>
    <p>Votre virement a été <strong>effectué avec succès</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#d8f3dc"><td style="padding:8px;font-weight:bold">Réf.</td><td style="padding:8px;font-family:monospace">${ref}</td></tr>
      <tr><td style="padding:8px">Montant envoyé</td><td style="padding:8px;font-weight:bold;color:#e63946">-${formatF(montant)}</td></tr>
      <tr style="background:#f4f6f4"><td style="padding:8px">Destinataire</td><td style="padding:8px">${destNom}</td></tr>
      <tr><td style="padding:8px">Nouveau solde</td><td style="padding:8px;font-weight:900;font-size:18px;color:#2d6a4f">${formatF(solde)}</td></tr>
    </table>
  </div>
</div>`
  }),

  virementRecu: (nom: string, ref: string, montant: number, sourceNom: string, solde: number) => ({
    sujet: `💸 Vous avez reçu ${formatF(montant)}`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e4ebe5;border-radius:12px;overflow:hidden">
  <div style="background:#1a2e1c;padding:20px;text-align:center">
    <h2 style="color:#f4a11d;margin:0">🌱 SEMENCE ÉPARGNE</h2>
  </div>
  <div style="padding:24px">
    <h3 style="color:#2d6a4f">Bonjour ${nom},</h3>
    <p>Vous avez reçu un virement de <strong>${sourceNom}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#d8f3dc"><td style="padding:8px;font-weight:bold">Réf.</td><td style="padding:8px;font-family:monospace">${ref}</td></tr>
      <tr><td style="padding:8px">Montant reçu</td><td style="padding:8px;font-weight:bold;color:#2d6a4f">+${formatF(montant)}</td></tr>
      <tr style="background:#f4f6f4"><td style="padding:8px">De</td><td style="padding:8px">${sourceNom}</td></tr>
      <tr><td style="padding:8px">Nouveau solde</td><td style="padding:8px;font-weight:900;font-size:18px;color:#2d6a4f">${formatF(solde)}</td></tr>
    </table>
  </div>
</div>`
  }),

  compteOuvert: (nom: string, num: string, rib: string, tel: string, pwd: string) => ({
    sujet: '🌱 Votre compte SEMENCE ÉPARGNE est ouvert',
    html: `
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e4ebe5;border-radius:12px;overflow:hidden">
  <div style="background:#1a2e1c;padding:20px;text-align:center">
    <h2 style="color:#f4a11d;margin:0">🌱 SEMENCE ÉPARGNE</h2>
    <p style="color:rgba(255,255,255,0.7);margin:4px 0 0">Le Crédit Panafricain (LCP)</p>
  </div>
  <div style="padding:24px">
    <h3 style="color:#2d6a4f">Bienvenue ${nom} !</h3>
    <p>Votre compte Semence Épargne a été créé avec succès.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="background:#d8f3dc"><td style="padding:8px;font-weight:bold">N° de compte</td><td style="padding:8px;font-family:monospace">${num}</td></tr>
      <tr><td style="padding:8px">RIB LCP</td><td style="padding:8px;font-family:monospace">${rib}</td></tr>
      <tr style="background:#f4f6f4"><td style="padding:8px">Téléphone</td><td style="padding:8px">${tel}</td></tr>
      <tr><td style="padding:8px;color:#e63946;font-weight:bold">Mot de passe temp.</td><td style="padding:8px;font-weight:bold">${pwd}</td></tr>
    </table>
    <p style="background:#fff8e7;padding:12px;border-radius:8px;font-size:13px;color:#a16207">⚠️ Changez votre mot de passe dès la première connexion.</p>
    <p style="color:#6b7c6d;font-size:12px">LCP · +225 27 35 96 05 99 · infos@semenceep.ci</p>
  </div>
</div>`
  }),
};

function formatF(n: number) { return new Intl.NumberFormat('fr-CI').format(Math.round(n)) + ' F'; }
