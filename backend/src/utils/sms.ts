// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/utils/sms.ts — SpecialSMS (specialsms.net)
const SMS_API_URL = 'https://www.specialsms.net/mysmsplus/envoyersms.php';
const SMS_SPKEY   = process.env.SMS_SPKEY || '6d4cf5214b24b3150476a2a8aae0c06f1ebc7edf';

function normaliserNumero(tel: string): string {
  const clean = tel.replace(/\s+/g, '').replace(/^\+/, '');
  if (clean.startsWith('225')) return clean;
  if (clean.startsWith('0') && clean.length === 10) return '225' + clean.slice(1);
  if (clean.length === 8) return '225' + clean;
  return clean;
}

interface SmsPayload { to: string; message: string; userId?: string; transactionId?: string; }

export async function sendSms(payload: SmsPayload): Promise<{ success: boolean; raw?: string; error?: string }> {
  const numero = normaliserNumero(payload.to);
  const params = new URLSearchParams({
    Spkey: SMS_SPKEY, expediteur: 'LCP', destinataire: numero, message: payload.message,
  });
  try {
    const response = await fetch(`${SMS_API_URL}?${params}`, {
      method: 'GET', headers: { 'Accept': 'text/plain' },
      signal: AbortSignal.timeout(10_000),
    });
    const raw     = await response.text();
    const success = response.ok && raw.trim().startsWith('1');
    if (!success) console.error(`[SMS] Échec → ${numero} — ${raw}`);
    else          console.log(`[SMS] ✓ Envoyé → ${numero}`);
    return { success, raw };
  } catch (err: any) {
    console.error(`[SMS] Erreur → ${numero}: ${err?.message}`);
    return { success: false, error: err?.message };
  }
}

export async function sendSmsBulk(destinataires: string[], message: string) {
  let succes = 0, echecs = 0;
  for (const to of destinataires) {
    const r = await sendSms({ to, message });
    r.success ? succes++ : echecs++;
    await new Promise(r => setTimeout(r, 300));
  }
  return { succes, echecs };
}

export const tpl = {
  compteOuvert: (nom: string, num: string, tel: string, pwd: string, url: string) =>
    `SEMENCE EPARGNE LCP
Bonjour ${nom}!
Compte: ${num}
Tel: ${tel}
Mdp: ${pwd}
Acces: ${url}?app=1
Installez l'app.`,
  compteActive:  (nom: string) =>
    `SEMENCE EPARGNE: Bonjour ${nom}, votre compte est actif. Bonne epargne!`,
  depotSucces:   (montant: number, frais: number, solde: number) =>
    `SEMENCE EPARGNE: Depot ${montant.toLocaleString('fr-CI')} FCFA. Frais: ${frais} FCFA. Solde: ${solde.toLocaleString('fr-CI')} FCFA.`,
  depotEchec:    (raison: string) =>
    `SEMENCE EPARGNE: Echec transaction. ${raison}. Contactez votre conseiller.`,
  code2FA:       (code: string) =>
    `SEMENCE EPARGNE: Code: ${code}. Valable 5 min. Ne le communiquez jamais.`,
  alerteConnexion: (heure: string) =>
    `SEMENCE EPARGNE: Connexion detectee le ${heure}. Si ce n'est pas vous, appelez +225 27 35 96 05 99.`,
  bonusVerse:    (nom: string, taux: string, bonus: number, solde: number) =>
    `SEMENCE EPARGNE LCP: Felicitations ${nom}! Bonus ${taux} verse: +${bonus.toLocaleString('fr-CI')} FCFA. Solde: ${solde.toLocaleString('fr-CI')} FCFA.`,
  planActive:    (nom: string, palier: string, taux: string, echeance: string, nbVers: number) =>
    `SEMENCE EPARGNE LCP: Plan epargne ${palier} active! Bonus: ${taux} le ${echeance}. Condition: ${nbVers} versements min + aucun retrait.`,
};

// Templates ajoutés v6
// (déjà exportés dans le tpl existant - ajouter manuellement si besoin)
// tpl.virementEnvoye, tpl.virementRecu sont dans virements.controller.ts
