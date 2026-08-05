// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/routes/epargne.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  souscrire,
  mesPlans,
  getPlan,
  debloquerBonus,
  tousLesPlans,
  statsBonus,
} from '../controllers/epargne.controller';

const router = Router();
router.use(authenticate);

// ─── Routes CLIENT ────────────────────────────────────────────────────
// Souscrire à un plan d'épargne
router.post('/souscrire',    authorize('CLIENT'), souscrire);
// Voir mes plans
router.get('/mes-plans',     authorize('CLIENT'), mesPlans);
// Voir un plan détaillé (propriétaire CLIENT ou staff)
router.get('/plan/:id',      authorize('CLIENT','MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE'), getPlan);
// Déclencher le bonus à l'échéance (propriétaire CLIENT ou admin)
router.post('/bonus/:planId', authorize('CLIENT','MASTER'), debloquerBonus);

// ─── Routes ADMIN ─────────────────────────────────────────────────────
// Tous les plans (Master)
router.get('/admin/plans',   authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE'), tousLesPlans);
// Statistiques bonus
router.get('/admin/stats',   authorize('MASTER'), statsBonus);

export default router;
