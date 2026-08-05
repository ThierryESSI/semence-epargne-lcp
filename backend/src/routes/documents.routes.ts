// backend/src/routes/documents.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { upload } from '../utils/upload';
import { uploadDocument, getDocuments, deleteDocument } from '../controllers/documents.controller';

const router = Router();
router.use(authenticate);

router.post('/:userId',   authorize('MASTER','DISTRIBUTEUR_INTERNE','CONSEILLER','CLIENT','CLIENTS_AJOUTER','CLIENTS_MODIFIER'), upload.single('file'), uploadDocument);
router.get('/:userId',    authorize('MASTER','DISTRIBUTEUR_INTERNE','CONSEILLER','CLIENT','CLIENTS_VOIR'), getDocuments);
router.delete('/:id',     authorize('MASTER','ADMINS_SUPPRIMER','CLIENTS_SUPPRIMER'), deleteDocument);

export default router;
