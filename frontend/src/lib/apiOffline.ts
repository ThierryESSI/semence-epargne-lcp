// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/lib/apiOffline.ts
// Wrapper qui tente l'appel API en ligne, et si hors-ligne,
// enregistre l'opération dans la queue IndexedDB.

import { api } from './api';
import { enqueue, isOnline, OfflineOp } from './offline';

interface DepotCartePayload {
  qrEpargneToken: string;
  codeValidation:  string;
}

interface OuvertureComptePayload {
  nom: string; prenom: string; email: string; telephone: string; password: string;
  region: string; ville: string; commune: string;
  typeCompte?: string; conseillerId?: string;
}

interface ActivationComptePayload {
  userId: string;
}

// ─── Dépôt carte ──────────────────────────────────────────────────────────────
export async function depotCarteOffline(payload: DepotCartePayload): Promise<{
  online: boolean;
  success: boolean;
  data?: any;
  error?: string;
  offlineId?: string;
}> {
  if (isOnline()) {
    try {
      const { data } = await api.post('/cartes/activer', payload);
      return { online: true, success: true, data: data.data };
    } catch (err: any) {
      // Si l'erreur n'est pas réseau (ex : carte déjà utilisée) → ne pas mettre en queue
      const status = err.response?.status;
      if (status && status < 500) {
        return { online: true, success: false, error: err.response?.data?.error || 'Erreur' };
      }
      // Erreur serveur → basculer en offline
    }
  }

  // Mode offline → enregistrer dans la queue
  const op = await enqueue({ type: 'DEPOT_CARTE', payload });
  return {
    online:    false,
    success:   true, // "succès local" — sera confirmé à la sync
    offlineId: op.id,
    data:      { offlineQueued: true, offlineId: op.id, message: 'Opération enregistrée. Elle sera envoyée dès le retour de la connexion.' }
  };
}

// ─── Ouverture compte ─────────────────────────────────────────────────────────
export async function ouvertureCompteOffline(payload: OuvertureComptePayload): Promise<{
  online: boolean;
  success: boolean;
  data?: any;
  error?: string;
  offlineId?: string;
}> {
  if (isOnline()) {
    try {
      const { data } = await api.post('/comptes/ouvrir', payload);
      return { online: true, success: true, data: data.data };
    } catch (err: any) {
      const status = err.response?.status;
      if (status && status < 500) {
        return { online: true, success: false, error: err.response?.data?.error || 'Erreur' };
      }
    }
  }

  const op = await enqueue({ type: 'OUVERTURE_COMPTE', payload });
  return {
    online:    false,
    success:   true,
    offlineId: op.id,
    data:      { offlineQueued: true, offlineId: op.id, message: 'Compte enregistré localement. Synchronisation au retour de la connexion.' }
  };
}

// ─── Activation compte ────────────────────────────────────────────────────────
export async function activationCompteOffline(payload: ActivationComptePayload): Promise<{
  online: boolean;
  success: boolean;
  data?: any;
  error?: string;
}> {
  if (isOnline()) {
    try {
      const { data } = await api.post('/comptes/activer', payload);
      return { online: true, success: true, data: data };
    } catch (err: any) {
      const status = err.response?.status;
      if (status && status < 500) {
        return { online: true, success: false, error: err.response?.data?.error || 'Erreur' };
      }
    }
  }

  const op = await enqueue({ type: 'ACTIVATION_COMPTE', payload });
  return { online: false, success: true, data: { offlineQueued: true, offlineId: op.id } };
}
