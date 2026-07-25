// backend/src/routes/rapport.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { genererRapportMensuel, listerRapports, exporterDonnees } from '../controllers/rapport.controller';

const router = Router();
router.use(authenticate);

router.post('/mensuel',  authorize('SUPER_ADMIN','MASTER','RAPPORTS_EXPORTER'), genererRapportMensuel);
router.get('/',          authorize('SUPER_ADMIN','MASTER','RAPPORTS_VOIR'),     listerRapports);
router.get('/exporter',  authorize('SUPER_ADMIN','MASTER','RAPPORTS_EXPORTER'), exporterDonnees);

export default router;
