// backend/src/routes/site_config.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { upload } from '../utils/upload';
import { getConfigsPubliques, getConfigsAdmin, updateConfig, uploadConfigImage } from '../controllers/site_config.controller';

const router = Router();

// Public (page d'accueil)
router.get('/public', getConfigsPubliques);

// Admin
router.get('/',              authenticate, authorize('SUPER_ADMIN','MASTER','CONFIG_VOIR'),     getConfigsAdmin);
router.patch('/:cle',        authenticate, authorize('SUPER_ADMIN','MASTER','CONFIG_MODIFIER'), updateConfig);
router.post('/:cle/image',   authenticate, authorize('SUPER_ADMIN','MASTER','CONFIG_MODIFIER'), upload.single('image'), uploadConfigImage);

export default router;
