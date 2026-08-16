// backend/src/utils/sms.ts — SpecialSMS (specialsms.net)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import prisma from './prisma';
import { fCFA } from './format';

const SMS_API_URL = process.env.SMS_API_URL || 'https://www.specialsms.net/mysmsplus/envoyersms.php';
const SMS_SPKEY   = process.env.SMS_SPKEY   || '';

// Normalise le numéro au format international CI (225XXXXXXXX)
function normaliserNumero(tel: string): string {
  const clean = tel.replace(/\D/g, '');
  if (clean.startsWith('225')) return clean;
  if (clean.startsWith('0') && clean.length === 10) return '225' + clean.slice(1);
  if (clean.length === 8) return '225' + clean;
  return clean;
}

interface SmsPayload {
  to:              string;
  message:         string;
  userId?:         string;
  transactionId?:  string;
}

export async function sendSms(
  payload: SmsPayload
): Promise<{ success: boolean; raw?: string; error?: string }> {

  if (!SMS_SPKEY) {
    console.warn('[SMS] SMS_SPKEY non configuré — SMS non envoyé');
    return { success: false, error: 'SMS_SPKEY manquant' };
  }

  const numero = normaliserNumero(payload.to);

  // SpecialSMS attend un POST avec spkey, sptel, spmsg (minuscules — PHP $_POST est sensible à la casse)
  const body = new URLSearchParams({
    spkey: SMS_SPKEY,
    sptel: numero,
    spmsg: payload.message,
  });

  try {
    const response = await fetch(SMS_API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/plain' },
      body:    body.toString(),
      signal:  AbortSignal.timeout(10_000),
    });

    const raw     = await response.text();
    // SpecialSMS renvoie HTTP 200 même en échec (ex: « crédits insuffisants »).
    // On considère l'envoi réussi seulement si le corps ne contient aucun
    // marqueur d'erreur connu.
    const echec = !response.ok
      || /insuffisant|balance|invalide|echec|échec|erreur|non envoyé|ne peut (?:etre|être) envoyé|clé vide|non effectue/i.test(raw);

    const success = !echec;

    if (success) console.log(`[SMS] OK → ${numero} — ${raw}`);
    else         console.error(`[SMS] Echec → ${numero} — ${raw}`);

    return { success, raw };
  } catch (err: any) {
    console.error(`[SMS] Erreur reseau → ${numero}: ${err?.message}`);
    return { success: false, error: err?.message };
  }
}

// Envoi en masse avec délai entre chaque SMS
export async function sendSmsBulk(destinataires: string[], message: string) {
  let succes = 0, echecs = 0;
  for (const to of destinataires) {
    const r = await sendSms({ to, message });
    r.success ? succes++ : echecs++;
    await new Promise(res => setTimeout(res, 300)); // 300ms entre chaque envoi
  }
  return { succes, echecs };
}

// Templates SMS avec variables configurables via SiteConfig
// Les templates lus en base remplacent les placeholders {var} par les valeurs.
// Si aucun template n'est configuré en base, le template par défaut est utilisé.

type TemplateVars = Record<string, string | number>;

function appliquerTemplate(cle: string, defaut: string, vars: TemplateVars): string {
  // Le template est chargé en lazy (1 appel par cycle de vie, cache léger)
  if (!(globalThis as any).__smsTplCache) (globalThis as any).__smsTplCache = {} as Record<string, string | null>;
  const cache = (globalThis as any).__smsTplCache as Record<string, string | null>;

  if (!(cle in cache)) {
    cache[cle] = null;
    // Lecture synchrone via prisma raw pour éviter un async dans les templates
    prisma.siteConfig.findUnique({ where:{ cle } }).then(cfg => {
      if (cfg?.valeur) cache[cle] = cfg.valeur;
    }).catch(() => {});
  }

  const tpl = cache[cle] || defaut;
  return Object.entries(vars).reduce((msg, [k, v]) => msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)), tpl);
}

export const tpl = {
  compteOuvert: (nom: string, num: string, tel: string, pwd: string, url: string) =>
    appliquerTemplate('SMS_TPL_COMPTE_OUVERT',
      `SEMENCE EPARGNE LCP\nBonjour ${nom}!\nCompte: ${num}\nTel: ${tel}\nMdp: ${pwd}\nAcces: ${url}`,
      { nom, numero: num, tel, pwd, url }),

  compteActive: (nom: string) =>
    appliquerTemplate('SMS_TPL_COMPTE_ACTIF',
      `SEMENCE EPARGNE: Bonjour ${nom}, votre compte est actif. Bonne epargne!`,
      { nom }),

  compteClientAjoute: (nom: string, codeClient: string, numeroCompte: string) =>
    `SEMENCE EPARGNE LCP\nBonjour ${nom}!\nVotre compte ${numeroCompte} est desormais actif en tant que CLIENT (${codeClient}).\nConnectez-vous avec votre numero habituel.`,

  depotSucces: (montant: number, frais: number, solde: number) =>
    appliquerTemplate('SMS_TPL_DEPOT_OK',
      `SEMENCE EPARGNE: Depot ${fCFA(montant)}. Frais: ${fCFA(frais)}. Solde: ${fCFA(solde)}.`,
      { montant: fCFA(montant), frais: fCFA(frais), solde: fCFA(solde) }),

  depotEchec: (raison: string) =>
    `SEMENCE EPARGNE: Echec transaction. ${raison}. Contactez votre conseiller.`,

  code2FA: (code: string) =>
    `SEMENCE EPARGNE: Code OTP: ${code}. Valable 10 min. Ne le communiquez jamais.`,

  alerteConnexion: (heure: string) =>
    `SEMENCE EPARGNE: Connexion detectee le ${heure}. Si ce n'est pas vous, appelez +225 27 35 96 05 99.`,

  bonusVerse: (nom: string, taux: string, bonus: number, solde: number) =>
    appliquerTemplate('SMS_TPL_BONUS',
      `SEMENCE EPARGNE: Felicitations ${nom}! Bonus ${taux} verse: +${fCFA(bonus)}. Solde: ${fCFA(solde)}.`,
      { nom, taux, bonus: fCFA(bonus), solde: fCFA(solde) }),

  planActive: (nom: string, palier: string, taux: string, echeance: string, nbVers: number) =>
    appliquerTemplate('SMS_TPL_PLAN',
      `SEMENCE EPARGNE: Plan ${palier} active! Bonus ${taux} le ${echeance}. Minimum ${nbVers} versements sans retrait.`,
      { nom, palier, taux, echeance, nbVers }),

  unarciAdhesion: (nom: string, numeroCompte: string, tel: string, pwd: string, montant: number, numeroPaie: string, url: string) =>
    appliquerTemplate('SMS_TPL_ADHESION',
      `UNARCI LCP\nBonjour ${nom}!\nAdhesion enregistree.\nCompte: ${numeroCompte}\nTel: ${tel}\nMdp: ${pwd}\nAcces: ${url}\nValidez en payant ${fCFA(montant)} par mobile money au ${numeroPaie}.`,
      { nom, prenom: nom.split(' ')[0], numeroCompte, tel, pwd, montant: fCFA(montant), numeroPaie, url }),
};
