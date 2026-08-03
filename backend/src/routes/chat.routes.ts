// backend/src/routes/chat.routes.ts
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { getMessages, envoyerMessage, conversationsNonLues } from '../controllers/chat.controller';

const router = Router();
router.use(authenticate);

router.get('/non-lus', authorize('MASTER','CONSEILLER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE'), conversationsNonLues);
router.get('/:clientId/messages',  getMessages);
router.post('/:clientId/messages', envoyerMessage);

export default router;
