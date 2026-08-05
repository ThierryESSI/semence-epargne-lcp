// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/controllers/epargne.controller.ts
import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { creerPlanEpargne, verifierEtCalculerBonus, calculerProgression, PALIERS } from '../services/epargne.service';
import { PalierBonus } from '@prisma/client';
import { sendSms, tpl } from '../utils/sms'; // [FIX] tpl importé

// ─── CLIENT : Souscrire ───────────────────────────────────────────────
export async function souscrire(req: Request, res: Response) {
  try {
    const { palier } = req.body;
    if (!palier || !Object.keys(PALIERS).includes(palier))
      return res.status(400).json({ error:'Palier invalide', disponibles:Object.keys(PALIERS) });
    const compte = await prisma.compte.findUnique({ where:{ userId:req.user!.userId } });
    if (!compte) return res.status(404).json({ error:'Compte introuvable' });
    if (compte.statut !== 'ACTIF') return res.status(403).json({ error:'Compte inactif' });
    const plan   = await creerPlanEpargne(compte.id, palier as PalierBonus);
    const config = PALIERS[palier as PalierBonus];
    const user   = await prisma.user.findUnique({ where:{ id:req.user!.userId } });
    if (user) {
      sendSms({ to:user.telephone, message:tpl.planActive(user.prenom, config.dureeLabel, config.tauxLabel, new Date(plan.dateEcheance).toLocaleDateString('fr-CI'), config.versementsMin), userId:user.id }).catch(()=>{});
    }
    return res.status(201).json({ success:true, message:`Plan ${config.dureeLabel} activé !`, data:{ planId:plan.id, palier:config.label, taux:config.tauxLabel, dateDebut:plan.dateDebut, dateEcheance:plan.dateEcheance, versementsRequis:config.versementsMin, soldeDepart:Number(plan.soldeDepart), bonusEstime:Math.floor(Number(plan.soldeDepart)*config.taux) } });
  } catch(err:any) { return res.status(400).json({ error:err.message }); }
}

// ─── CLIENT : Mes plans ────────────────────────────────────────────────
export async function mesPlans(req: Request, res: Response) {
  try {
    const compte = await prisma.compte.findUnique({ where:{ userId:req.user!.userId } });
    if (!compte) return res.status(404).json({ error:'Compte introuvable' });
    const plans = await prisma.planEpargne.findMany({ where:{ compteId:compte.id }, include:{ versements:{ orderBy:{ numeroVersement:'asc' } } }, orderBy:{ createdAt:'desc' } });
    return res.json({ data:plans.map(p=>({ ...p, soldeDepart:Number(p.soldeDepart), soldeActuel:Number(p.soldeActuel), bonusTaux:Number(p.bonusTaux), bonusMontant:p.bonusMontant?Number(p.bonusMontant):null, montantTotalVerse:Number(p.montantTotalVerse), config:PALIERS[p.palier], progression:p.statut==='EN_COURS'?calculerProgression(p):null })) });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

// ─── CLIENT : Plan détaillé ────────────────────────────────────────────
// [FIX] getPlan ajouté (manquait et causait crash au démarrage)
// [SECURITE] Contrôle de propriété : un CLIENT ne voit que ses propres plans
export async function getPlan(req: Request, res: Response) {
  try {
    const plan = await prisma.planEpargne.findUnique({ where:{ id:req.params.id }, include:{ versements:{ orderBy:{ numeroVersement:'asc' } }, compte:{ include:{ user:{ select:{ nom:true,prenom:true,telephone:true } } } } } });
    if (!plan) return res.status(404).json({ error:'Plan introuvable' });
    if (req.user!.role === 'CLIENT') {
      const compte = await prisma.compte.findUnique({ where:{ userId:req.user!.userId } });
      if (!compte || plan.compteId !== compte.id)
        return res.status(403).json({ error:'Accès refusé : ce plan ne vous appartient pas' });
    }
    return res.json({ data:{ ...plan, soldeDepart:Number(plan.soldeDepart), soldeActuel:Number(plan.soldeActuel), bonusTaux:Number(plan.bonusTaux), bonusMontant:plan.bonusMontant?Number(plan.bonusMontant):null, montantTotalVerse:Number(plan.montantTotalVerse), config:PALIERS[plan.palier], progression:plan.statut==='EN_COURS'?calculerProgression(plan):null } });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

// ─── Débloquer bonus ────────────────────────────────────────────────────
// [SECURITE] Un CLIENT ne peut débloquer que son propre plan (le claim
// atomique contre le double bonus est assuré dans verifierEtCalculerBonus)
export async function debloquerBonus(req: Request, res: Response) {
  try {
    const { planId } = req.params;
    const plan = await prisma.planEpargne.findUnique({ where:{ id:planId }, select:{ compteId:true } });
    if (!plan) return res.status(404).json({ error:'Plan introuvable' });
    if (req.user!.role === 'CLIENT') {
      const compte = await prisma.compte.findUnique({ where:{ userId:req.user!.userId } });
      if (!compte || plan.compteId !== compte.id)
        return res.status(403).json({ error:'Accès refusé : ce plan ne vous appartient pas' });
    }
    const result = await verifierEtCalculerBonus(planId);
    if (!result.eligible) return res.status(400).json({ error:result.raison, eligible:false });
    const planFull = await prisma.planEpargne.findUnique({ where:{ id:planId }, include:{ compte:{ include:{ user:true } } } });
    if (planFull?.compte?.user) {
      const u = planFull.compte.user;
      sendSms({ to:u.telephone, message:tpl.bonusVerse(u.prenom, result.taux, result.bonusMontant, result.soldeAvecBonus), userId:u.id }).catch(()=>{});
    }
    return res.json({ success:true, ...result });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

// ─── ADMIN : Tous les plans ─────────────────────────────────────────────
export async function tousLesPlans(req: Request, res: Response) {
  try {
    const statut = req.query.statut as string|undefined;
    const page   = Math.max(1, parseInt(req.query.page as string||'1'));
    const limit  = Math.min(100, parseInt(req.query.limit as string||'20'));
    const where:any = {};
    if (statut) where.statut = statut;
    const [total, plans] = await Promise.all([
      prisma.planEpargne.count({ where }),
      prisma.planEpargne.findMany({ where, skip:(page-1)*limit, take:limit, orderBy:{ createdAt:'desc' }, include:{ compte:{ include:{ user:{ select:{ nom:true,prenom:true,telephone:true } } } }, versements:true } })
    ]);
    return res.json({ data:plans.map(p=>({ ...p, soldeDepart:Number(p.soldeDepart), soldeActuel:Number(p.soldeActuel), bonusTaux:Number(p.bonusTaux), bonusMontant:p.bonusMontant?Number(p.bonusMontant):null, montantTotalVerse:Number(p.montantTotalVerse), config:PALIERS[p.palier], progression:p.statut==='EN_COURS'?calculerProgression(p):null })), pagination:{ total, page, limit, pages:Math.ceil(total/limit) } });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}

// ─── ADMIN : Stats bonus ────────────────────────────────────────────────
export async function statsBonus(req: Request, res: Response) {
  try {
    const dans7j = new Date(); dans7j.setDate(dans7j.getDate()+7);
    const [enCours, eligibles, bonifies, interrompus, expires, totalBonus, prochaines] = await Promise.all([
      prisma.planEpargne.count({ where:{ statut:'EN_COURS' } }),
      prisma.planEpargne.count({ where:{ statut:'ELIGIBLE' } }),
      prisma.planEpargne.count({ where:{ statut:'BONIFIE' } }),
      prisma.planEpargne.count({ where:{ statut:'INTERROMPU' } }),
      prisma.planEpargne.count({ where:{ statut:'EXPIRE' } }), // [FIX] ajouté
      prisma.planEpargne.aggregate({ where:{ statut:'BONIFIE' }, _sum:{ bonusMontant:true } }),
      prisma.planEpargne.count({ where:{ statut:'EN_COURS', dateEcheance:{ lte:dans7j } } }),
    ]);
    return res.json({ data:{ enCours, eligibles, bonifies, interrompus, expires, totalBonusVerses:Number(totalBonus._sum.bonusMontant||0), prochainesEcheances:prochaines } });
  } catch(err:any) { return res.status(500).json({ error:err.message }); }
}
