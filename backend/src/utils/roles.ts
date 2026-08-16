// backend/src/utils/roles.ts
const ROLE_RANK: Record<string, number> = {
  CLIENT: 1,
  CONSEILLER: 2,
  DISTRIBUTEUR_AGREE: 3,
  DISTRIBUTEUR_INTERNE: 3,
  MASTER: 4,
  SUPER_ADMIN: 5,
};

// Retourne le rôle le plus élevé entre deux rôles
export function upgradeRole(current: string, target: string): string {
  return (ROLE_RANK[target] || 0) > (ROLE_RANK[current] || 0) ? target : current;
}

// Fusionne les permissions sans doublon
export function mergePermissions(existing: string[] = [], added: string[] = []): string[] {
  return Array.from(new Set([...existing, ...added]));
}

export const PERMISSIONS_DISTRIBUTEUR = [
  'DISTRIBUTEURS_VOIR',
  'DISTRIBUTEURS_DETAILS',
  'CONSEILLERS_VOIR',
  'CONSEILLERS_DETAILS',
  'CONSEILLERS_AJOUTER',
  'CONSEILLERS_MODIFIER',
  'CARTES_VOIR',
  'CARTES_ATTRIBUER',
  'CLIENTS_VOIR',
  'CLIENTS_DETAILS',
  'CLIENTS_AJOUTER',
  'CLIENTS_MODIFIER',
  'TRANSACTIONS_VOIR',
  'VIREMENTS_VOIR',
  'VIREMENTS_VALIDER',
  'EPARGNE_VOIR',
];

export const PERMISSIONS_CONSEILLER = [
  'CONSEILLERS_VOIR',
  'CONSEILLERS_DETAILS',
  'DISTRIBUTEURS_VOIR',
  'DISTRIBUTEURS_DETAILS',
  'CLIENTS_VOIR',
  'CLIENTS_DETAILS',
  'CLIENTS_AJOUTER',
  'CLIENTS_MODIFIER',
  'CARTES_VOIR',
  'CARTES_ATTRIBUER',
  'TRANSACTIONS_VOIR',
  'EPARGNE_VOIR',
];
