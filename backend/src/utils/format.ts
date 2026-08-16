// backend/src/utils/format.ts
// Fonctions de formatage partagées (montant CFA, pagination, etc.)

export function fCFA(n: number): string {
  return new Intl.NumberFormat('fr-CI').format(Math.round(n)) + ' F';
}

export function parsePage(raw: string | undefined): number {
  const n = parseInt(raw || '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function parseLimit(raw: string | undefined, max = 100): number {
  const n = parseInt(raw || '20', 10);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.min(n, max);
}
