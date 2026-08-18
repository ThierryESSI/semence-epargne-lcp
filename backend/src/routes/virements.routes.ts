// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/routes/virements.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { initierVirement, confirmerVirement, annulerVirement, mesVirements, rechercherParRib, tousLesVirements } from '../controllers/virements.controller';

const router = Router();
router.use(authenticate);

// CLIENT
router.post('/initier',               authorize('CLIENT'), initierVirement);
router.post('/confirmer',             authorize('CLIENT'), confirmerVirement);
router.delete('/:virementId/annuler', authorize('CLIENT'), annulerVirement);
router.get('/mes-virements',          authorize('CLIENT'), mesVirements);
router.get('/rib/:rib',               authorize('CLIENT'), rechercherParRib);

// ADMIN
router.get('/admin/tous', authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE'), tousLesVirements);

export default router;
