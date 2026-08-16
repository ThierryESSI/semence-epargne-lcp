// backend/src/routes/sms_entrant.routes.ts
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { sendSms, tpl } from '../utils/sms';
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

// ─── Test SMS libre (SUPER_ADMIN / MASTER) ──────────────────────
router.post('/envoyer', authenticate, authorize('SUPER_ADMIN','MASTER'), async (req: Request, res: Response) => {
  try {
    const { telephone, message, template, vars } = req.body;
    if (!telephone || (!message && !template))
      return res.status(400).json({ error:'telephone et message (ou template) requis' });

    let smsText = message;
    if (template && !message) {
      const fn = (tpl as any)[template];
      if (typeof fn !== 'function')
        return res.status(400).json({ error:`Template "${template}" inconnu. Disponibles : ${Object.keys(tpl).join(', ')}` });
      smsText = fn(...(vars || []));
    }

    const spkey = process.env.SMS_SPKEY || '';
    const numeroNormalise = telephone.replace(/\D/g, '').startsWith('225')
      ? telephone.replace(/\D/g, '')
      : telephone.replace(/\D/g, '').startsWith('0') && telephone.replace(/\D/g, '').length === 10
        ? '225' + telephone.replace(/\D/g, '')
        : '225' + telephone.replace(/\D/g, '');

    console.log(`[SMS TEST] → Dest: ${telephone} (normalisé: ${numeroNormalise}) | SPKEY ${spkey ? 'configurée (' + spkey.slice(0,6) + '...)' : 'MANQUANTE'} | Msg: ${smsText?.slice(0,80)}...`);

    const result = await sendSms({ to: telephone, message: smsText! });

    console.log(`[SMS TEST] Résultat: success=${result.success} raw=${result.raw} error=${result.error}`);

    return res.json({ success: result.success, raw: result.raw, error: result.error, message: smsText, debug: { spkeyPresent: !!spkey, numeroNormalise } });
  } catch (err: any) { return res.status(500).json({ error: err.message }); }
});

export default router;
