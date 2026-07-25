// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  const classes = inputs.filter(Boolean).join(' ');
  return classes;
}

export const formatMontant = (v: number | string) =>
  new Intl.NumberFormat('fr-CI', { minimumFractionDigits:0, maximumFractionDigits:0 }).format(Number(v)) + ' F';

export const formatDate = (d: string | Date, fmt = 'dd/MM/yyyy HH:mm') =>
  format(new Date(d), fmt, { locale: fr });

export const statutColor: Record<string, string> = {
  ACTIF:       'bg-green-100 text-green-800',
  EN_ATTENTE:  'bg-yellow-100 text-yellow-800',
  SUSPENDU:    'bg-red-100 text-red-800',
  CLOTURE:     'bg-gray-100 text-gray-800',
  SUCCES:      'bg-green-100 text-green-800',
  EN_COURS:    'bg-blue-100 text-blue-800',
  ECHEC:       'bg-red-100 text-red-800',
  DISPONIBLE:  'bg-green-100 text-green-800',
  VENDUE:      'bg-blue-100 text-blue-800',
  UTILISEE:    'bg-gray-100 text-gray-800',
  ANNULEE:     'bg-red-100 text-red-800',
};

export const roleLabel: Record<string, string> = {
  MASTER:               'Master LCP',
  DISTRIBUTEUR_INTERNE: 'Distributeur Interne',
  DISTRIBUTEUR_AGREE:   'Distributeur Agréé',
  CONSEILLER:           'Conseiller Clientèle',
  CLIENT:               'Client',
};
