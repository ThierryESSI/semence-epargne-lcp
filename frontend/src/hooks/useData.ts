// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/hooks/useData.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

// Hook générique pour fetcher n'importe quel endpoint
export function useApi<T>(url: string | null, deps: any[] = []) {
  const [data, setData]     = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url);
      setData(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [url, ...deps]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// Hook paginé
export function usePaginated<T>(baseUrl: string, params: Record<string, any> = {}) {
  const [items, setItems]     = useState<T[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), limit: '20', ...params });
      if (search) q.set('search', search);
      const res = await api.get(`${baseUrl}?${q}`);
      setItems(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, page, search, JSON.stringify(params)]);

  useEffect(() => { load(); }, [load]);

  return { items, pagination, loading, page, setPage, search, setSearch, refetch: load };
}

// Hook stats dashboard
export function useDashboardStats() {
  return useApi<any>('/admin/stats');
}
