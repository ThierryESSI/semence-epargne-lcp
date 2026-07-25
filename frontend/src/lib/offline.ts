// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/lib/offline.ts
// ─────────────────────────────────────────────────────────────────────────────
// MOTEUR OFFLINE — SEMENCE EPARGNE
// ─────────────────────────────────────────────────────────────────────────────
// Principe :
//   1. Toutes les opérations (dépôt carte, ouverture compte, activation)
//      sont d'abord stockées dans IndexedDB (base locale du navigateur).
//   2. Si internet est disponible → envoi immédiat au serveur.
//   3. Si hors-ligne → stockage en file d'attente (queue) avec statut PENDING.
//   4. Un service de synchronisation vérifie toutes les 30 secondes si
//      internet est rétabli et rejoue les opérations en attente.
//   5. Chaque opération est idempotente : même rejouée deux fois, elle ne
//      produit pas de doublon (grâce à l'ID unique côté serveur).
// ─────────────────────────────────────────────────────────────────────────────

export type OpType = 'DEPOT_CARTE' | 'OUVERTURE_COMPTE' | 'ACTIVATION_COMPTE';
export type OpStatus = 'PENDING' | 'SYNCED' | 'FAILED';

export interface OfflineOp {
  id:         string;       // UUID unique généré côté client
  type:       OpType;
  createdAt:  string;       // ISO — horodatage de l'opération
  payload:    any;          // données de l'opération
  status:     OpStatus;
  attempts:   number;       // nb de tentatives de sync
  lastError?: string;
  syncedAt?:  string;
}

// ─── Base de données IndexedDB ────────────────────────────────────────────────
const DB_NAME    = 'SemenceEpargne';
const DB_VERSION = 1;
const STORE      = 'offlineQueue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db    = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('status',    'status',    { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result);
    req.onerror   = e => reject((e.target as IDBOpenDBRequest).error);
  });
}

// ─── CRUD sur la queue ────────────────────────────────────────────────────────
export async function enqueue(op: Omit<OfflineOp, 'id' | 'createdAt' | 'status' | 'attempts'>): Promise<OfflineOp> {
  const full: OfflineOp = {
    ...op,
    id:        crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status:    'PENDING',
    attempts:  0,
  };
  const db = await openDB();
  await new Promise<void>((res, rej) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add(full);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
  db.close();
  return full;
}

export async function getPending(): Promise<OfflineOp[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readonly');
    const index = tx.objectStore(STORE).index('status');
    const req   = index.getAll('PENDING');
    req.onsuccess = () => { db.close(); resolve(req.result as OfflineOp[]); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

export async function getAll(): Promise<OfflineOp[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => { db.close(); resolve((req.result as OfflineOp[]).sort((a,b) => b.createdAt.localeCompare(a.createdAt))); };
    req.onerror   = () => { db.close(); reject(req.error); };
  });
}

export async function updateOp(op: OfflineOp): Promise<void> {
  const db = await openDB();
  await new Promise<void>((res, rej) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(op);
    req.onsuccess = () => res();
    req.onerror   = () => rej(req.error);
  });
  db.close();
}

export async function countPending(): Promise<number> {
  const pending = await getPending();
  return pending.length;
}

// ─── Détection de la connectivité ─────────────────────────────────────────────
export function isOnline(): boolean {
  return navigator.onLine;
}

// ─── Synchronisation ──────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 5;

export async function syncQueue(token: string): Promise<{ synced: number; failed: number; errors: string[] }> {
  if (!isOnline()) return { synced: 0, failed: 0, errors: ['Hors-ligne'] };

  const pending = await getPending();
  if (pending.length === 0) return { synced: 0, failed: 0, errors: [] };

  // Regrouper en batches de 20
  const batches: OfflineOp[][] = [];
  for (let i = 0; i < pending.length; i += 20) batches.push(pending.slice(i, i + 20));

  let totalSynced = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  for (const batch of batches) {
    try {
      const res = await fetch('/api/sync', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ operations: batch }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // Mettre à jour chaque opération selon le résultat
      for (const result of data.results) {
        const op = batch.find(o => o.id === result.id);
        if (!op) continue;
        if (result.success) {
          await updateOp({ ...op, status: 'SYNCED', syncedAt: new Date().toISOString() });
          totalSynced++;
        } else {
          const attempts = op.attempts + 1;
          await updateOp({ ...op, attempts, lastError: result.error, status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING' });
          totalFailed++;
          errors.push(`[${op.type}] ${result.error}`);
        }
      }
    } catch (err: any) {
      // Erreur réseau — incrémenter attempts sans passer en FAILED
      for (const op of batch) {
        const attempts = op.attempts + 1;
        await updateOp({ ...op, attempts, lastError: err.message, status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING' });
      }
      totalFailed += batch.length;
      errors.push(`Réseau : ${err.message}`);
    }
  }

  return { synced: totalSynced, failed: totalFailed, errors };
}

// ─── Service de synchronisation automatique ───────────────────────────────────
let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let onSyncCallback: ((result: { synced: number; failed: number; pending: number }) => void) | null = null;

export function startAutoSync(getToken: () => string | null, onSync?: typeof onSyncCallback) {
  if (syncIntervalId) return; // déjà démarré
  onSyncCallback = onSync || null;

  const run = async () => {
    const token = getToken();
    if (!token || !isOnline()) return;
    const result = await syncQueue(token);
    if (result.synced > 0 || result.failed > 0) {
      const pending = await countPending();
      onSyncCallback?.({ ...result, pending });
    }
  };

  // Sync immédiate au démarrage, puis toutes les 30 secondes
  run();
  syncIntervalId = setInterval(run, 30_000);

  // Sync aussi dès que la connexion revient
  window.addEventListener('online', run);
}

export function stopAutoSync() {
  if (syncIntervalId) { clearInterval(syncIntervalId); syncIntervalId = null; }
  window.removeEventListener('online', () => {});
}
