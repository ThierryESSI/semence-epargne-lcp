// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/client/ClientRapports.tsx
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, StatCard, Spinner } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ClientRapports() {
  const [compte, setCompte] = useState<any>(null);
  const [txData, setTxData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/comptes/solde'),
      api.get('/transactions?limit=100'),
    ]).then(([c, t]) => {
      setCompte(c.data.data);
      setTxData(t.data.data || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const totalEpargne = txData.filter(t => t.statut === 'SUCCES').reduce((s, t) => s + Number(t.montantNet || 0), 0);
  const totalFrais   = txData.filter(t => t.statut === 'SUCCES').reduce((s, t) => s + Number(t.frais || 0), 0);
  const nbTx         = txData.filter(t => t.statut === 'SUCCES').length;

  // Regrouper par mois
  const byMonth: Record<string, number> = {};
  txData.filter(t => t.statut === 'SUCCES').forEach(t => {
    const m = new Date(t.createdAt).toLocaleDateString('fr-CI', { month: 'short', year: '2-digit' });
    byMonth[m] = (byMonth[m] || 0) + Number(t.montantNet || 0);
  });
  const chartData = Object.entries(byMonth).map(([mois, montant]) => ({ mois, montant }));

  return (
    <div>
      <PageHeader title="Mes Rapports" subtitle="Récapitulatif de votre épargne" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard label="Solde actuel" value={formatMontant(compte?.solde || 0)} icon="wallet" />
        <StatCard label="Total épargné" value={formatMontant(totalEpargne)} icon="trending" />
        <StatCard label="Transactions réussies" value={nbTx} icon="check" iconColor={C.green} />
      </div>

      {chartData.length > 0 && (
        <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 22, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Évolution de mon épargne</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8ede9" />
              <XAxis dataKey="mois" tick={{ fontSize: 12, fill: C.textMuted }} />
              <YAxis tick={{ fontSize: 11, fill: C.textMuted }} tickFormatter={v => formatMontant(v)} />
              <Tooltip formatter={(v: any) => formatMontant(v)} />
              <Bar dataKey="montant" fill={C.green} radius={[4, 4, 0, 0]} name="Épargne" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Détail compte */}
      <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Informations du compte</h3>
        {[
          { label: 'N° Compte', value: compte?.numeroCompte || '—' },
          { label: 'Type de compte', value: compte?.type?.replace(/_/g, ' ') || '—' },
          { label: 'Statut', value: compte?.statut || '—' },
          { label: 'Devise', value: 'FCFA (XOF)' },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: `1px solid ${C.borderLight}` }}>
            <span style={{ color: C.textMuted, fontSize: 14 }}>{r.label}</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
