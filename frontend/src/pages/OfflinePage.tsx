// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/OfflinePage.tsx
// Page de gestion de la file d'attente hors-ligne
// Visible depuis le menu quand des opérations sont en attente

import { useEffect, useState } from 'react';
import { getAll, syncQueue, countPending, OfflineOp } from '../lib/offline';
import { formatDate, formatMontant } from '../lib/utils';
import { Card, PageHeader, Button, Spinner } from '../components/ui/index';
import { RefreshCw, CheckCircle, XCircle, Clock, WifiOff, Wifi, Trash2 } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  DEPOT_CARTE:        '💳 Dépôt carte Semence Épargne',
  OUVERTURE_COMPTE:   '👤 Ouverture de compte client',
  ACTIVATION_COMPTE:  '✅ Activation de compte',
};

export default function OfflinePage() {
  const [ops, setOps]           = useState<OfflineOp[]>([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);
  const [online, setOnline]     = useState(navigator.onLine);
  const [syncResult, setSyncResult] = useState<any>(null);

  async function refresh() {
    const all = await getAll();
    setOps(all);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const onOnline  = () => { setOnline(true);  refresh(); };
    const onOffline = () => { setOnline(false); refresh(); };
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  async function handleSync() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    setSyncing(true); setSyncResult(null);
    try {
      const result = await syncQueue(token);
      setSyncResult(result);
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  const pending = ops.filter(o => o.status === 'PENDING').length;
  const synced  = ops.filter(o => o.status === 'SYNCED').length;
  const failed  = ops.filter(o => o.status === 'FAILED').length;

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="File d'attente hors-ligne"
        subtitle="Opérations enregistrées en mode hors-ligne en attente de synchronisation"
        action={
          online && pending > 0 ? (
            <Button onClick={handleSync} loading={syncing}>
              <RefreshCw size={15} className="inline mr-2" />
              Synchroniser maintenant ({pending})
            </Button>
          ) : undefined
        }
      />

      {/* Statut connexion */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${online ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        {online
          ? <><Wifi size={20} className="text-green-600" /><span className="text-green-700 font-semibold">Connecté à internet</span></>
          : <><WifiOff size={20} className="text-red-600" /><span className="text-red-700 font-semibold">Hors-ligne — les opérations seront envoyées au retour de la connexion</span></>
        }
      </div>

      {/* Résultat de la dernière sync */}
      {syncResult && (
        <div className={`p-4 rounded-xl border ${syncResult.synced > 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className="font-semibold text-gray-700 mb-1">Résultat de la synchronisation :</p>
          <p className="text-sm text-green-700">✅ {syncResult.synced} opération(s) synchronisée(s)</p>
          {syncResult.failed > 0 && <p className="text-sm text-red-600">❌ {syncResult.failed} échec(s)</p>}
          {syncResult.errors?.map((e: string, i: number) => (
            <p key={i} className="text-xs text-red-500 mt-1">{e}</p>
          ))}
        </div>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-orange-500">{pending}</p>
          <p className="text-sm text-gray-500 mt-1">En attente</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-green-500">{synced}</p>
          <p className="text-sm text-gray-500 mt-1">Synchronisées</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-red-500">{failed}</p>
          <p className="text-sm text-gray-500 mt-1">Échouées</p>
        </Card>
      </div>

      {/* Liste des opérations */}
      <Card>
        <h2 className="font-semibold text-gray-800 mb-4">
          Toutes les opérations ({ops.length})
        </h2>

        {ops.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p>Aucune opération hors-ligne enregistrée</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ops.map(op => (
              <div key={op.id} className={`rounded-xl border p-4 ${
                op.status === 'SYNCED'  ? 'bg-green-50  border-green-100'  :
                op.status === 'FAILED'  ? 'bg-red-50    border-red-100'    :
                                          'bg-orange-50 border-orange-100'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Icône statut */}
                    <div className="mt-0.5 shrink-0">
                      {op.status === 'SYNCED'  && <CheckCircle size={20} className="text-green-500" />}
                      {op.status === 'PENDING' && <Clock       size={20} className="text-orange-500" />}
                      {op.status === 'FAILED'  && <XCircle     size={20} className="text-red-500"    />}
                    </div>

                    {/* Détails */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">
                        {TYPE_LABELS[op.type] || op.type}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Enregistré le {formatDate(op.createdAt)}
                      </p>

                      {/* Payload résumé */}
                      {op.type === 'DEPOT_CARTE' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Code validation : •••• (confidentiel)
                        </p>
                      )}
                      {op.type === 'OUVERTURE_COMPTE' && op.payload?.nom && (
                        <p className="text-xs text-gray-500 mt-1">
                          Client : {op.payload.prenom} {op.payload.nom} — {op.payload.telephone}
                        </p>
                      )}

                      {/* Erreur */}
                      {op.lastError && (
                        <p className="text-xs text-red-500 mt-1 truncate">
                          ⚠️ {op.lastError}
                        </p>
                      )}

                      {/* Tentatives */}
                      {op.attempts > 0 && op.status !== 'SYNCED' && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {op.attempts} tentative(s) / 5 max
                        </p>
                      )}

                      {op.syncedAt && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Synchronisé le {formatDate(op.syncedAt)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Badge statut */}
                  <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${
                    op.status === 'SYNCED'  ? 'bg-green-100  text-green-700'  :
                    op.status === 'FAILED'  ? 'bg-red-100    text-red-700'    :
                                              'bg-orange-100 text-orange-700'
                  }`}>
                    {op.status === 'SYNCED'  ? '✅ Sync' :
                     op.status === 'FAILED'  ? '❌ Échec' :
                                               '⏳ En attente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Info pédagogique */}
      <Card className="bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2">ℹ️ Comment fonctionne le mode hors-ligne ?</h3>
        <div className="text-sm text-blue-700 space-y-1">
          <p>• Quand vous n'avez pas internet, toutes vos saisies sont sauvegardées sur votre appareil.</p>
          <p>• Dès que la connexion revient, la synchronisation se déclenche automatiquement (toutes les 30 secondes).</p>
          <p>• Vous pouvez aussi forcer la synchronisation avec le bouton « Synchroniser maintenant ».</p>
          <p>• Chaque opération est protégée contre les doublons : même envoyée deux fois, elle ne sera traitée qu'une seule fois.</p>
          <p>• Après 5 tentatives échouées, une opération passe en statut « Échec » — contactez l'administrateur.</p>
        </div>
      </Card>
    </div>
  );
}
