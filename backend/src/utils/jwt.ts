// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// backend/src/utils/jwt.ts
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

const ACCESS_SECRET: string  = process.env.JWT_SECRET!;
const REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!;
const EXPIRES  = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// [SÉCURITÉ] Vérification au démarrage : les secrets critiques doivent être définis.
// Sans cette vérification, jwt.sign(payload, undefined) utilise un secret vide,
// ce qui permet à n'importe qui de forger des tokens JWT valides.
if (!ACCESS_SECRET) {
  console.error('[FATAL] JWT_SECRET n\'est pas défini dans les variables d\'environnement.');
  console.error('  → Définissez JWT_SECRET dans votre fichier .env ou dans Railway.');
  process.exit(1);
}
if (ACCESS_SECRET.length < 32) {
  console.error('[FATAL] JWT_SECRET doit faire au moins 32 caractères (recommandé: 64+).');
  process.exit(1);
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  telephone: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: EXPIRES } as any);
}

export function signRefreshToken(payload: Pick<JwtPayload, 'userId'>): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES } as any);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}
