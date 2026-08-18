// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/routes/admin.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getStats, getAuditLogs, getConfig, updateConfig } from '../controllers/admin.controller';

const router = Router();
router.use(authenticate);

// [SÉCURITÉ] Config globale (fees, bonus, maintenance) réservée à MASTER/SUPER_ADMIN
router.get('/stats',       authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE'), getStats);
router.get('/audit',       authorize('MASTER'), getAuditLogs);
router.get('/config',      authorize('MASTER'), getConfig);
router.put('/config/:cle', authorize('MASTER'), updateConfig);

export default router;
