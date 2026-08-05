// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// ============================================================
// backend/src/utils/rateLimits.ts
// Garde anti-force-brute en mémoire pour les codes de validation
// de carte / OTP. Nota : à remplacer par un stockage partagé
// (Redis) dès que l'API est déployée sur plusieurs instances.
const FENETRE_MS = 15 * 60 * 1000;
const MAX_ECHECS = 5;

const echecs = new Map<string, { count: number; resetAt: number }>();

export function codeAutorise(cle: string): boolean {
  const e = echecs.get(cle);
  if (!e || Date.now() > e.resetAt) return true;
  return e.count < MAX_ECHECS;
}

export function codeEchec(cle: string) {
  const e = echecs.get(cle);
  if (!e || Date.now() > e.resetAt) {
    echecs.set(cle, { count: 1, resetAt: Date.now() + FENETRE_MS });
  } else {
    e.count += 1;
  }
}

export function codeSucces(cle: string) {
  echecs.delete(cle);
}

// Nettoie périodiquement les entrées expirées (évite la fuite mémoire)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of echecs) {
    if (now > v.resetAt) echecs.delete(k);
  }
}, 10 * 60 * 1000).unref();
