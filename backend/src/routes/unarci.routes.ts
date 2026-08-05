// backend/src/routes/unarci.routes.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { adherer, configUnarci, listerAdherents, activerAdherent, statsAdherents } from '../controllers/unarci.controller';

const router = Router();

// Limite stricte sur l'inscription publique (anti-spam)
const adhesionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});

// ─── Public ──────────────────────────────────────────────────────────
router.get('/config',  configUnarci);
router.post('/adhesion', adhesionLimiter, adherer);

// ─── Agence UNARCI (authentifiée) ────────────────────────────────────
router.use('/agence', authenticate);
router.get('/agence/adherents', authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE'), listerAdherents);
router.get('/agence/stats',     authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE'), statsAdherents);
router.post('/agence/activer/:id', authorize('MASTER','SUPER_ADMIN','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE'), activerAdherent);

export default router;
