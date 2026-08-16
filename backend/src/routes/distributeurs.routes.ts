// backend/src/routes/distributeurs.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { creerDistributeur, listerDistributeurs, getDistributeur } from '../controllers/distributeurs.controller';

const router = Router();
router.use(authenticate);
// Seul le MASTER (et SUPER_ADMIN) crée les distributeurs
router.post('/', authorize('MASTER','SUPER_ADMIN'), creerDistributeur);
router.get('/',  authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE','CONSEILLER','DISTRIBUTEURS_VOIR'), listerDistributeurs);
router.get('/:id', authorize('MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE','CONSEILLER','DISTRIBUTEURS_DETAILS'), getDistributeur);
export default router;
