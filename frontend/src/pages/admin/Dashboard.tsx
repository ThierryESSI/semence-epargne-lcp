// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/admin/Dashboard.tsx
import { C } from '../../lib/design';
import { StatCard, Spinner, PageHeader, Icon, ICONS } from '../../components/ui/DS';
import { useDashboardStats } from '../../hooks/useData';
import { formatMontant, formatDate } from '../../lib/utils';
import { useAuthStore } from '../../lib/store';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from '../../components/ui/DS';

const PIE_COLORS = [C.green, C.gold];

export default function Dashboard() {
  const { user } = useAuthStore();
  const { data, loading } = useDashboardStats();

  if (loading) return <Spinner />;

  const k = data?.kpis || {};
  const evo = data?.evolutionDepots || [];

  const pieData = [
    { name: 'Part LCP (2 parts)', value: Math.round((k.volumeEpargne || 0) * 0.01 * 0.6) },
    { name: 'Part Distributeurs (1 part)', value: Math.round((k.volumeEpargne || 0) * 0.01 * 0.4) },
  ];
  const totalFrais = Math.round((k.volumeEpargne || 0) * 0.01);

  return (
    <div>
      <PageHeader
        title={<><span>Tableau de bord</span></>}
        subtitle="Vue d'ensemble de la plateforme Semence Épargne"
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Épargne" value={formatMontant(k.volumeEpargne || 0)}
          sub={`${k.totalTransactions || 0} comptes actifs`} icon="trending"
          trend={k.totalTransactions > 0 ? '+12% vs mois dernier' : undefined} />
        <StatCard label="Clients" value={k.totalClients ?? '—'}
          sub="Comptes ouverts" icon="clients" iconColor={C.greenLight} />
        <StatCard label="Cartes Émises" value={k.totalCartes ?? '—'}
          sub={`${k.cartesUtilisees || 0} utilisées`} icon="cartes"
          trend={k.tauxUtilisationCartes ? `${k.tauxUtilisationCartes}% utilisées` : undefined} />
        <StatCard label="Distributeurs" value={k.totalDistributeurs ?? '—'}
          sub="Réseau actif" icon="distrib" iconColor={C.gold} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 24 }}>
        {/* Bar chart */}
        <div style={{ background: C.white, borderRadius: 14, padding: 22, border: `1px solid ${C.border}` }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: C.text }}>Évolution des dépôts</h3>
          {evo.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: C.textMuted }}>Aucune donnée disponible</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={evo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ede9" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: C.textMuted }} />
                <YAxis tick={{ fontSize: 11, fill: C.textMuted }} tickFormatter={v => formatMontant(v)} />
                <Tooltip formatter={(v: any) => formatMontant(v)} />
                <Bar dataKey="montant" fill={C.green} radius={[4,4,0,0]} name="Épargne" />
                <Bar dataKey="frais" fill={C.gold} radius={[4,4,0,0]} name="Frais" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie — répartition frais */}
        <div style={{ background: C.white, borderRadius: 14, padding: 22, border: `1px solid ${C.border}` }}>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: C.text }}>Répartition des frais</h3>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.text }}>{formatMontant(totalFrais)}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Total frais collectés (1%)</div>
            {totalFrais > 0 ? (
              <PieChart width={160} height={120} style={{ margin: '0 auto' }}>
                <Pie data={pieData} cx={80} cy={60} innerRadius={35} outerRadius={58} dataKey="value" startAngle={90} endAngle={-270}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
              </PieChart>
            ) : (
              <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textLight, fontSize: 13 }}>Aucun frais collecté</div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
            {pieData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i], flexShrink: 0 }} />
                <span style={{ color: C.textMuted }}>{d.name}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <div style={{ background: C.greenPale, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>LCP (0,6%)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.green }}>{formatMontant(pieData[0].value)}</div>
            </div>
            <div style={{ background: C.goldPale, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#a16207', fontWeight: 600 }}>Distrib. (0,4%)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#a16207' }}>{formatMontant(pieData[1].value)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions récentes */}
      <div style={{ background: C.white, borderRadius: 14, padding: 22, border: `1px solid ${C.border}` }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: C.text }}>Transactions récentes</h3>
        {(!data?.recentTransactions || data.recentTransactions.length === 0) ? (
          <div style={{ textAlign: 'center', padding: 32, color: C.textMuted }}>Aucune transaction pour le moment</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: `1.5px solid ${C.border}` }}>
                {['Réf.', 'Client', 'Montant', 'Frais', 'Net crédité', 'Statut', 'Date'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 12px', color: C.textMuted, fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentTransactions.map((tx: any) => (
                <tr key={tx.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: C.textMuted }}>{tx.reference}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{tx.compte?.user?.prenom} {tx.compte?.user?.nom}</td>
                  <td style={{ padding: '10px 12px' }}>{formatMontant(tx.montant)}</td>
                  <td style={{ padding: '10px 12px', color: C.red, fontWeight: 600 }}>{formatMontant(tx.frais)}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{formatMontant(tx.montantNet)}</td>
                  <td style={{ padding: '10px 12px' }}><Badge v={tx.statut} /></td>
                  <td style={{ padding: '10px 12px', color: C.textMuted, fontSize: 12 }}>{formatDate(tx.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
