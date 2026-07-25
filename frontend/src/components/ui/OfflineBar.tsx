// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/components/ui/OfflineBar.tsx
import { useEffect, useState, useCallback } from 'react';
import { isOnline, countPending, syncQueue, getAll, OfflineOp } from '../../lib/offline';
import { formatDate } from '../../lib/utils';
import { Wifi, WifiOff, RefreshCw, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function OfflineBar() {
  const [online, setOnline]         = useState(isOnline());
  const [pending, setPending]       = useState(0);
  const [syncing, setSyncing]       = useState(false);
  const [lastSync, setLastSync]     = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory]       = useState<OfflineOp[]>([]);
  const [syncMsg, setSyncMsg]       = useState('');

  const refresh = useCallback(async () => {
    const n = await countPending();
    setPending(n);
    if (showHistory) {
      const all = await getAll();
      setHistory(all);
    }
  }, [showHistory]);

  useEffect(() => {
    refresh();
    const onOnline  = () => { setOnline(true);  refresh(); };
    const onOffline = () => { setOnline(false); refresh(); };
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    const iv = setInterval(refresh, 10_000);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); clearInterval(iv); };
  }, [refresh]);

  async function handleSync() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    setSyncing(true); setSyncMsg('');
    try {
      const result = await syncQueue(token);
      setLastSync(new Date().toLocaleTimeString('fr-CI'));
      setSyncMsg(`✅ ${result.synced} synchronisée(s)${result.failed > 0 ? ` — ⚠️ ${result.failed} échec(s)` : ''}`);
    } catch {
      setSyncMsg('❌ Erreur de synchronisation');
    } finally {
      setSyncing(false);
      await refresh();
    }
  }

  async function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next) { const all = await getAll(); setHistory(all); }
  }

  const statusIcon  = online ? <Wifi size={14} className="text-green-400" /> : <WifiOff size={14} className="text-red-400" />;
  const statusColor = online ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  const statusText  = online ? 'En ligne' : 'Hors ligne';

  if (online && pending === 0 && !lastSync) return null; // rien à afficher si tout va bien

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full">
      {/* Barre principale */}
      <div className={`rounded-xl border shadow-lg p-3 ${statusColor}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {statusIcon}
            <span className="text-xs font-semibold text-gray-700">{statusText}</span>
            {pending > 0 && (
              <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">
                {pending} en attente
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {pending > 0 && online && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1 bg-[#1B4F8A] text-white text-xs px-3 py-1.5 rounded-lg hover:bg-blue-800 disabled:opacity-60 font-medium"
              >
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Sync...' : 'Synchroniser'}
              </button>
            )}
            <button onClick={toggleHistory} className="text-gray-500 hover:text-gray-700">
              {showHistory ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
            </button>
          </div>
        </div>

        {syncMsg && (
          <p className="text-xs mt-2 text-gray-600 font-medium">{syncMsg}</p>
        )}
        {lastSync && !syncMsg && (
          <p className="text-xs mt-1 text-gray-400">Dernière sync : {lastSync}</p>
        )}

        {/* Historique des opérations */}
        {showHistory && (
          <div className="mt-3 border-t pt-3 max-h-64 overflow-y-auto space-y-2">
            <p className="text-xs font-semibold text-gray-600 mb-2">File d'attente hors-ligne :</p>
            {history.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">Aucune opération en attente</p>
            ) : (
              history.map(op => (
                <div key={op.id} className="flex items-start gap-2 bg-white rounded-lg p-2 border text-xs">
                  {op.status === 'SYNCED'  && <CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" />}
                  {op.status === 'PENDING' && <Clock       size={14} className="text-orange-500 shrink-0 mt-0.5" />}
                  {op.status === 'FAILED'  && <XCircle     size={14} className="text-red-500 shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-700 truncate">{op.type.replace(/_/g,' ')}</p>
                    <p className="text-gray-400">{formatDate(op.createdAt)}</p>
                    {op.lastError && <p className="text-red-500 truncate">{op.lastError}</p>}
                    {op.attempts > 0 && op.status !== 'SYNCED' && (
                      <p className="text-gray-400">{op.attempts} tentative(s)</p>
                    )}
                  </div>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                    op.status === 'SYNCED' ? 'bg-green-100 text-green-700' :
                    op.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {op.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
