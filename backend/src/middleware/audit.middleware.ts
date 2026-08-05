// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/middleware/audit.middleware.ts
import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';

// Champs sensibles à ne jamais logger dans les logs d'audit
const CHAMPS_SENSIBLES = ['password','confirmPassword','codeValidation','codeOTP','otp','pin','secret','token','authorization','code','codeSecret'];

function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  const copy: any = Array.isArray(body) ? [] : {};
  for (const [k, v] of Object.entries(body)) {
    if (CHAMPS_SENSIBLES.includes(k.toLowerCase())) { copy[k] = '***'; continue; }
    copy[k] = (v && typeof v === 'object') ? sanitizeBody(v) : v;
  }
  return copy;
}

export function audit(action: string, entite: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', async () => {
      if (req.user && res.statusCode < 400) {
        await prisma.auditLog.create({
          data: {
            action,
            entite,
            entiteId: req.params.id || 'N/A',
            actorId: req.user!.userId,
            details: { method: req.method, url: req.originalUrl, body: sanitizeBody(req.body) },
            ipAddress: req.ip,
          }
        }).catch(() => {}); // ne jamais bloquer sur l'audit
      }
    });
    next();
  };
}
