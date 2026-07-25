// backend/src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../utils/prisma';

declare global {
  namespace Express {
    interface Request {
      user?: { userId:string; email:string; role:string; telephone:string; permissions:string[] };
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token d\'authentification requis' });
  const token   = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload)
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  const user = await prisma.user.findUnique({
    where:  { id: payload.userId },
    select: { id: true, actif: true, permissions: true }
  });
  if (!user || !user.actif)
    return res.status(403).json({ error: 'Compte inactif ou introuvable' });
  req.user = {
    userId:      payload.userId,
    email:       payload.email,
    role:        payload.role,
    telephone:   payload.telephone,
    permissions: user.permissions as string[],
  };
  next();
}

// Autorise par rôle OU par permission granulaire
// Exemples : authorize('MASTER')  /  authorize('CLIENTS_VOIR')  /  authorize('MASTER','CLIENTS_VOIR')
export function authorize(...rolesOrPerms: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    const { role, permissions } = req.user;
    // SUPER_ADMIN bypass total
    if (role === 'SUPER_ADMIN') return next();
    // Vérifier rôle ou permission
    if (rolesOrPerms.includes(role) || rolesOrPerms.some(p => permissions?.includes(p)))
      return next();
    return res.status(403).json({ error: `Accès refusé. Requis : ${rolesOrPerms.join(', ')}` });
  };
}
