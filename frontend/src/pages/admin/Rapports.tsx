// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/admin/Rapports.tsx
import { useDashboardStats } from '../../hooks/useData';
import { C } from '../../lib/design';
import { PageHeader, StatCard, Spinner, Icon, ICONS } from '../../components/ui/DS';
import { formatMontant } from '../../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CARTES_COLORS = [C.green, '#e76f51', C.gold, '#264653', '#2a9d8f'];

export default function Rapports() {
  const { data, loading } = useDashboardStats();
  if (loading) return <Spinner />;

  const k = data?.kpis || {};
  const evo = data?.evolutionDepots || [];
  const totalFrais = Math.round((k.volumeEpargne || 0) * 0.01);
  const lcpPart = Math.round(totalFrais * 0.6);
  const distPart = Math.round(totalFrais * 0.4);

  return (
    <div>
      <PageHeader title="Rapports & Statistiques" subtitle="Vue analytique de la plateforme" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <StatCard label="Épargne totale" value={formatMontant(k.volumeEpargne || 0)} icon="trending" />
        <StatCard label="Total frais collectés" value={formatMontant(totalFrais)} icon="percent" iconColor={C.red} />
        <StatCard label="Revenus LCP" value={formatMontant(lcpPart)} sub="2 parts (0,6%)" icon="arrowUp" iconColor={C.green} />
        <StatCard label="Rev. Distributeurs" value={formatMontant(distPart)} sub="1 part (0,4%)" icon="clients" iconColor={C.gold} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 22 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Évolution mensuelle des dépôts</h3>
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
        <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 22 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Répartition des cartes par montant</h3>
          <div style={{ textAlign: 'center', color: C.textMuted, padding: '40px 0', fontSize: 13 }}>
            Disponible après émission de cartes
          </div>
        </div>
      </div>

      {/* Détail répartition */}
      <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700 }}>Détail clé de répartition des frais</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `1.5px solid ${C.border}` }}>
              {['Description', 'Taux', 'Parts', 'Montant (FCFA)'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 14px', color: C.textMuted, fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { desc: 'Frais de rechargement total', taux: '1% (0,01)', parts: '3 parts', montant: totalFrais, bold: true },
              { desc: '→ Part LCP', taux: '0,6% (0,006)', parts: '2 parts', montant: lcpPart, color: C.green },
              { desc: '→ Part Distributeurs', taux: '0,4% (0,004)', parts: '1 part', montant: distPart, color: C.gold },
            ].map((r, i) => (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '11px 14px', fontWeight: r.bold ? 700 : 400, color: r.color || C.text }}>{r.desc}</td>
                <td style={{ padding: '11px 14px', color: r.color || C.textMuted }}>{r.taux}</td>
                <td style={{ padding: '11px 14px', color: C.textMuted }}>{r.parts}</td>
                <td style={{ padding: '11px 14px', fontWeight: r.bold ? 800 : 600, color: r.color || C.text, fontSize: r.bold ? 16 : 14 }}>
                  {formatMontant(r.montant)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
