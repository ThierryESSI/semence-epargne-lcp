// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/routes/auth.routes.ts
import { Router } from 'express';
import { login, refreshToken, getMe, changePassword, forceChangePassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/refresh', refreshToken);
router.get('/me', authenticate, getMe);
router.put('/password', authenticate, changePassword);
router.put('/force-password', authenticate, forceChangePassword);

export default router;
