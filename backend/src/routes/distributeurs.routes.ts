// backend/src/routes/distributeurs.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { creerDistributeur, listerDistributeurs, getDistributeur } from '../controllers/distributeurs.controller';

const router = Router();
router.use(authenticate);
router.post('/', authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE'), creerDistributeur);
router.get('/',  authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE'), listerDistributeurs);
router.get('/:id', authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE'), getDistributeur);
export default router;
