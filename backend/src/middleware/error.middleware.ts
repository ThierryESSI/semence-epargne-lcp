// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[ERROR]', err);
  const status = err.status || err.statusCode || 500;
  // [SÉCURITÉ] Ne jamais exposer la stack ni les messages internes en production.
  // Les messages internes peuvent fuiter des chemins, requêtes SQL ou secrets.
  const expose = process.env.NODE_ENV !== 'production';
  const message = expose ? (err.message || 'Erreur serveur interne') : 'Erreur serveur interne';
  res.status(status).json({ error: message, ...(expose && { stack: err.stack }) });
}
