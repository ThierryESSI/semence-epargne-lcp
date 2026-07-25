// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/routes/conseillers.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { creerConseiller, listerConseillers, getConseiller } from '../controllers/conseillers.controller';

const router = Router();
router.use(authenticate);
router.post('/', authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE'), creerConseiller);
router.get('/',  authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE'), listerConseillers);
router.get('/:id', authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE','CONSEILLER'), getConseiller);
export default router;
