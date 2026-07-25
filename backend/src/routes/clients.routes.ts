// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/routes/clients.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { listerClients, getClient } from '../controllers/clients.controller';

const router = Router();
router.use(authenticate);
router.get('/', authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE','CONSEILLER'), listerClients);
router.get('/:id', authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE','CONSEILLER'), getClient);
export default router;
