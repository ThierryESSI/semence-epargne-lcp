// backend/src/routes/sms_entrant.routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  webhookSmsEntrant,
  testerWebhook,
  historiqueRechargesSMS,
  whatsappVerify,
  whatsappEntrant,
} from '../controllers/sms_entrant.controller';

const router = Router();

// ─── Option A : Webhook GSM Modem / SpecialSMS ────────────────────
// POST depuis le script Python du modem GSM ou SpecialSMS
router.post('/entrant', webhookSmsEntrant);

// ─── Option C : WhatsApp Business API ────────────────────────────
// GET  — verification Meta (obligatoire une seule fois)
router.get('/whatsapp',  whatsappVerify);
// POST — messages WhatsApp entrants
router.post('/whatsapp', whatsappEntrant);

// ─── Routes admin (authentifiées) ────────────────────────────────
router.post('/test',      authenticate, authorize('MASTER'), testerWebhook);
router.get('/historique', authenticate, authorize('MASTER', 'DISTRIBUTEUR_INTERNE'), historiqueRechargesSMS);

export default router;
