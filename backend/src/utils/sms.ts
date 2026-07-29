// backend/src/utils/sms.ts — SpecialSMS (specialsms.net)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI

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

  // SpecialSMS attend un POST avec Spkey, Sptel, Spmsg
  const body = new URLSearchParams({
    Spkey: SMS_SPKEY,
    Sptel: numero,
    Spmsg: payload.message,
  });

  try {
    const response = await fetch(SMS_API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'text/plain' },
      body:    body.toString(),
      signal:  AbortSignal.timeout(10_000),
    });

    const raw     = await response.text();
    const success = response.ok;

    if (success) console.log(`[SMS] OK → ${numero}`);
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

// Templates SMS
export const tpl = {
  compteOuvert: (nom: string, num: string, tel: string, pwd: string, url: string) =>
    `SEMENCE EPARGNE LCP\nBonjour ${nom}!\nCompte: ${num}\nTel: ${tel}\nMdp: ${pwd}\nAcces: ${url}`,

  compteActive: (nom: string) =>
    `SEMENCE EPARGNE: Bonjour ${nom}, votre compte est actif. Bonne epargne!`,

  depotSucces: (montant: number, frais: number, solde: number) =>
    `SEMENCE EPARGNE: Depot ${fCFA(montant)}. Frais: ${fCFA(frais)}. Solde: ${fCFA(solde)}.`,

  depotEchec: (raison: string) =>
    `SEMENCE EPARGNE: Echec transaction. ${raison}. Contactez votre conseiller.`,

  code2FA: (code: string) =>
    `SEMENCE EPARGNE: Code OTP: ${code}. Valable 10 min. Ne le communiquez jamais.`,

  alerteConnexion: (heure: string) =>
    `SEMENCE EPARGNE: Connexion detectee le ${heure}. Si ce n'est pas vous, appelez +225 27 35 96 05 99.`,

  bonusVerse: (nom: string, taux: string, bonus: number, solde: number) =>
    `SEMENCE EPARGNE: Felicitations ${nom}! Bonus ${taux} verse: +${fCFA(bonus)}. Solde: ${fCFA(solde)}.`,

  planActive: (nom: string, palier: string, taux: string, echeance: string, nbVers: number) =>
    `SEMENCE EPARGNE: Plan ${palier} active! Bonus ${taux} le ${echeance}. Minimum ${nbVers} versements sans retrait.`,
};

function fCFA(n: number): string {
  return new Intl.NumberFormat('fr-CI').format(Math.round(n)) + ' F';
}
