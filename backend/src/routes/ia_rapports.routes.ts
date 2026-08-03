// backend/src/routes/ia_rapports.routes.ts
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { genererAnalyseIA, questionIA, historiqueAnalyses } from '../controllers/ia_rapports.controller';

const router = Router();
router.use(authenticate);

const ACCES = ['SUPER_ADMIN','MASTER','DISTRIBUTEUR_INTERNE','RAPPORTS_VOIR'];

router.post('/analyser',  authorize(...ACCES), genererAnalyseIA);
router.post('/question',  authorize(...ACCES), questionIA);
router.get('/historique', authorize(...ACCES), historiqueAnalyses);

export default router;
