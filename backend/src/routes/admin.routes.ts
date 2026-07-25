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
router.use(authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE'));

router.get('/stats',       getStats);
router.get('/audit',       getAuditLogs);
router.get('/config',      getConfig);           // [FIX] route manquante
router.put('/config/:cle', updateConfig);        // [FIX] route manquante

export default router;
