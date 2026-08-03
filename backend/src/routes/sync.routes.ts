// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/routes/sync.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { syncOfflineQueue } from '../controllers/sync.controller';

const router = Router();
// [SÉCURITÉ] Seuls les rôles de terrain/staff peuvent rejouer des opérations offline
router.post('/sync', authenticate, authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE','CONSEILLER'), syncOfflineQueue);
export default router;
