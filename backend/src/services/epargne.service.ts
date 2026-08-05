// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/services/epargne.service.ts
import prisma from '../utils/prisma';
import { PalierBonus } from '@prisma/client';
import { generateRef } from '../utils/crypto';

export const PALIERS = {
  TROIS_MOIS:  { label:'3 mois',  dureeJours:90,  taux:0.035, tauxLabel:'3,5%', versementsMin:2,  dureeLabel:'3 mois'  },
  SIX_MOIS:    { label:'6 mois',  dureeJours:180, taux:0.08,  tauxLabel:'8%',   versementsMin:3,  dureeLabel:'6 mois'  },
  DOUZE_MOIS:  { label:'12 mois', dureeJours:365, taux:0.17,  tauxLabel:'17%',  versementsMin:6,  dureeLabel:'12 mois' },
};

export async function creerPlanEpargne(compteId: string, palier: PalierBonus) {
  const config = PALIERS[palier];

  // [SÉCURITÉ] Anti-course : deux souscriptions simultanées sur le même compte
  // ne doivent pas créer deux plans actifs (vérification + création atomiques).
  return prisma.$transaction(async (tx) => {
    const compte = await tx.compte.findUnique({ where: { id: compteId } });
    if (!compte) throw new Error('Compte introuvable');
    if (compte.statut !== 'ACTIF') throw new Error('Compte inactif');
    const planActif = await tx.planEpargne.findFirst({ where: { compteId, statut: 'EN_COURS' } });
    if (planActif) throw new Error('Un plan épargne est déjà en cours sur ce compte');
    const dateDebut = new Date();
    const dateEcheance = new Date();
    dateEcheance.setDate(dateEcheance.getDate() + config.dureeJours);

    // [ALIGNEMENT] Le taux est piloté par l'admin (Paramètres → Taux bonus) via SiteConfig,
    // avec repli sur les valeurs par défaut si non configuré.
    const cleTaux = { TROIS_MOIS: 'BONUS_3M_TAUX', SIX_MOIS: 'BONUS_6M_TAUX', DOUZE_MOIS: 'BONUS_12M_TAUX' }[palier];
    const cfgTaux = cleTaux ? await tx.siteConfig.findUnique({ where: { cle: cleTaux } }) : null;
    const taux = cfgTaux && parseFloat(cfgTaux.valeur) > 0 ? parseFloat(cfgTaux.valeur) : config.taux;

    return tx.planEpargne.create({
      data: { compteId, palier, statut: 'EN_COURS', dateDebut, dateEcheance,
        soldeDepart: compte.solde, soldeActuel: compte.solde, bonusTaux: taux,
        nbVersementsRequis: config.versementsMin, nbVersementsEffectues: 0, montantTotalVerse: 0 }
    });
  });
}

export async function enregistrerVersement(compteId: string, montant: number, transactionId?: string) {
  // [SÉCURITÉ] Compteurs incrémentés atomiquement dans la même transaction :
  // deux dépôts concurrents ne se perdent plus de mise à jour (nbVersementsEffectues).
  return prisma.$transaction(async (tx) => {
    const plan = await tx.planEpargne.findFirst({ where: { compteId, statut: 'EN_COURS' } });
    if (!plan) return null;
    const numero = (await tx.versementEpargne.count({ where: { planId: plan.id } })) + 1;
    const versement = await tx.versementEpargne.create({
      data: { planId: plan.id, transactionId, montant, numeroVersement: numero }
    });
    await tx.planEpargne.update({
      where: { id: plan.id },
      data: {
        nbVersementsEffectues: { increment: 1 },
        montantTotalVerse:     { increment: montant },
        soldeActuel:           { increment: montant },
      }
    });
    return versement;
  });
}

export async function signalerRetrait(compteId: string) {
  const plan = await prisma.planEpargne.findFirst({ where: { compteId, statut: 'EN_COURS' } });
  if (!plan) return null;
  await prisma.planEpargne.update({ where: { id: plan.id }, data: { statut: 'INTERROMPU', dateDernierRetrait: new Date() } });
  return plan;
}

export type ResultatBonus =
  | { eligible: true; bonusMontant: number; soldeAvecBonus: number; taux: string; palier: string }
  | { eligible: false; raison: string };

export async function verifierEtCalculerBonus(planId: string): Promise<ResultatBonus> {
  const plan = await prisma.planEpargne.findUnique({ where: { id: planId }, include: { compte: true } });
  if (!plan) throw new Error('Plan introuvable');
  if (plan.statut !== 'EN_COURS') return { eligible: false, raison: `Plan ${plan.statut}` };
  const now = new Date();
  if (now < plan.dateEcheance) {
    const jours = Math.ceil((plan.dateEcheance.getTime() - now.getTime()) / 86400000);
    return { eligible: false, raison: `Échéance dans ${jours} jour(s)` };
  }
  if (plan.dateDernierRetrait) {
    await prisma.planEpargne.update({ where: { id: planId }, data: { statut: 'INTERROMPU' } });
    return { eligible: false, raison: 'Un retrait a été effectué pendant la période' };
  }
  if (plan.nbVersementsEffectues < plan.nbVersementsRequis) {
    await prisma.planEpargne.update({ where: { id: planId }, data: { statut: 'EXPIRE' } });
    return { eligible: false, raison: `Versements insuffisants : ${plan.nbVersementsEffectues}/${plan.nbVersementsRequis}` };
  }
  const solde = Number(plan.soldeActuel);
  const bonusMontant = Math.floor(solde * Number(plan.bonusTaux));
  const soldeAvecBonus = solde + bonusMontant;
  const config = PALIERS[plan.palier];
  // [SECURITE] Claim atomique : le premier appelant passe le plan en BONIFIE,
  // les appels concurrents reçoivent « Bonus déjà versé » (élimine le double bonus).
  return prisma.$transaction(async (tx) => {
    const claim = await tx.planEpargne.updateMany({
      where: { id: planId, statut: 'EN_COURS' },
      data: { statut: 'BONIFIE', bonusMontant, bonusVerse: true },
    });
    if (claim.count === 0) return { eligible: false, raison: 'Bonus déjà versé' };
    await tx.transaction.create({ data: { reference: generateRef('BONUS'), type: 'BONUS_EPARGNE', montant: bonusMontant, frais: 0, montantNet: bonusMontant, statut: 'SUCCES', compteId: plan.compteId, description: `Bonus SEMENCE ${config.tauxLabel}` } });
    await tx.compte.update({ where: { id: plan.compteId }, data: { solde: { increment: bonusMontant } } });
    return { eligible: true, bonusMontant, soldeAvecBonus, taux: config.tauxLabel, palier: config.label };
  });
}

export function calculerProgression(plan: any) {
  const now = new Date();
  const debut = new Date(plan.dateDebut);
  const echeance = new Date(plan.dateEcheance);
  const totalMs = echeance.getTime() - debut.getTime();
  const ecoulMs = Math.min(now.getTime() - debut.getTime(), totalMs);
  const progTemps = Math.round((ecoulMs / totalMs) * 100);
  const progVers  = Math.min(Math.round((plan.nbVersementsEffectues / plan.nbVersementsRequis) * 100), 100);
  const joursRest = Math.max(0, Math.ceil((echeance.getTime() - now.getTime()) / 86400000));
  const bonusEstime = Math.floor(Number(plan.soldeActuel) * Number(plan.bonusTaux));
  return {
    progressionTemps: progTemps, progressionVersements: progVers, joursRestants: joursRest, bonusEstime,
    conditionVersementsOK: plan.nbVersementsEffectues >= plan.nbVersementsRequis,
    conditionRetraitOK: !plan.dateDernierRetrait,
    eligible: progTemps >= 100 && plan.nbVersementsEffectues >= plan.nbVersementsRequis && !plan.dateDernierRetrait,
  };
}
