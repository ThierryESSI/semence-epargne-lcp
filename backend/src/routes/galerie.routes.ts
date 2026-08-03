// backend/src/routes/galerie.routes.ts
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { upload } from '../utils/upload';
import { listerPhotos, ajouterPhoto, modifierPhoto, supprimerPhoto } from '../controllers/galerie.controller';

const router = Router();

router.get('/',        listerPhotos);
router.post('/',       authenticate, authorize('SUPER_ADMIN','MASTER'), upload.single('image'), ajouterPhoto);
router.patch('/:cle',  authenticate, authorize('SUPER_ADMIN','MASTER'), modifierPhoto);
router.delete('/:cle', authenticate, authorize('SUPER_ADMIN','MASTER'), supprimerPhoto);

export default router;
