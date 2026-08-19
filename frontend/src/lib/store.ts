// frontend/src/lib/store.ts
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';

interface User {
  id: string; email: string; nom: string; prenom: string;
  role: string; telephone: string; whatsapp?: string;
  notifWhatsapp?: boolean; notifEmail?: boolean;
  mustChangePassword?: boolean;
  permissions?: string[];
  compte?: { numeroCompte: string; rib: string; solde: number; statut: string; type: string; };
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  login: (identifiant: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,

      // Appelé par LoginPage après succès
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        set({ user });
      },

      // Login direct depuis le store (optionnel)
      login: async (identifiant, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { identifiant, password });
          localStorage.setItem('access_token', data.accessToken);
          localStorage.setItem('refresh_token', data.refreshToken);
          set({ user: data.user });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null });
        window.location.href = '/login';
      },

      fetchMe: async () => {
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data.data });
        } catch { /* token expiré → login */ }
      },
    }),
    { name: 'semenceep-auth', partialize: (s) => ({ user: s.user }) }
  )
);
