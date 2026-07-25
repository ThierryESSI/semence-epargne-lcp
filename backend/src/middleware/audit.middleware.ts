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
            details: { method: req.method, url: req.originalUrl, body: req.body },
            ipAddress: req.ip,
          }
        }).catch(() => {}); // ne jamais bloquer sur l'audit
      }
    });
    next();
  };
}
