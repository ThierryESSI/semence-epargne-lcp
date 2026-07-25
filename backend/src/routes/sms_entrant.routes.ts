// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/routes/sms_entrant.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { webhookSmsEntrant, testerWebhook, historiqueRechargesSMS } from '../controllers/sms_entrant.controller';

const router = Router();

// ─── Webhook public — appelé par SpecialSMS (pas d'auth JWT) ──────────
// SpecialSMS POST vers : https://ton-api.railway.app/api/sms/entrant
// Sécurisé par le header X-Webhook-Secret
router.post('/entrant', webhookSmsEntrant);

// ─── Routes admin (authentifiées) ────────────────────────────────────
router.post('/test',       authenticate, authorize('MASTER'), testerWebhook);
router.get('/historique',  authenticate, authorize('MASTER', 'DISTRIBUTEUR_INTERNE'), historiqueRechargesSMS);

export default router;
