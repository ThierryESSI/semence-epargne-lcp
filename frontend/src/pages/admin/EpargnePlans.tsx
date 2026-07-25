// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/admin/EpargnePlans.tsx
// =====================================================================
// PAGE ADMIN — Gestion des plans d'épargne et bonus SEMENCE
// =====================================================================
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, TableWrapper, THead, TR, TD, Badge, StatCard, Spinner, Empty, Pagination } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';

const PALIER_LABELS: Record<string, string> = {
  TROIS_MOIS:  '🌱 3 mois  (+3,5%)',
  SIX_MOIS:    '🌿 6 mois  (+8%)',
  DOUZE_MOIS:  '🌳 12 mois (+17%)',
};
const STATUT_FILTER = ['', 'EN_COURS', 'ELIGIBLE', 'BONIFIE', 'INTERROMPU', 'EXPIRE'];
const STATUT_LABELS: Record<string,string> = { '':'Tous', EN_COURS:'En cours', ELIGIBLE:'Éligibles', BONIFIE:'Bonifiés', INTERROMPU:'Interrompus', EXPIRE:'Expirés' };

export default function EpargnePlans() {
  const [plans, setPlans]         = useState<any[]>([]);
  const [stats, setStats]         = useState<any>(null);
  const [statut, setStatut]       = useState('');
  const [page, setPage]           = useState(1);
  const [pagination, setPagination] = useState({ total:0, pages:1 });
  const [loading, setLoading]     = useState(true);
  const [deblocage, setDeblocage] = useState<string|null>(null);

  async function charger() {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        api.get(`/epargne/admin/plans?page=${page}&limit=20${statut ? `&statut=${statut}` : ''}`),
        api.get('/epargne/admin/stats'),
      ]);
      setPlans(p.data.data || []);
      setPagination(p.data.pagination);
      setStats(s.data.data);
    } catch { setPlans([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { charger(); }, [page, statut]);

  async function handleDebloquer(planId: string) {
    setDeblocage(planId);
    try {
      const { data } = await api.post(`/epargne/bonus/${planId}`);
      alert(`✅ Bonus versé : +${formatMontant(data.bonusMontant)} FCFA au client.`);
      charger();
    } catch (err: any) {
      alert(`❌ ${err.response?.data?.error || 'Erreur'}`);
    } finally { setDeblocage(null); }
  }

  return (
    <div>
      <PageHeader title="Plans d'Épargne SEMENCE" subtitle="Gestion des plans bonifiés LCP" />

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
          <StatCard label="En cours"          value={stats.plansEnCours}        icon="trending"      />
          <StatCard label="Éligibles"         value={stats.plansEligibles}      icon="check"         iconColor="#a16207"/>
          <StatCard label="Bonifiés"          value={stats.plansBonifies}       icon="arrowUp"       iconColor={C.green}/>
          <StatCard label="Total bonus versés" value={formatMontant(stats.totalBonusVerses)} icon="wallet" iconColor={C.green}/>
          <StatCard label="Échéances < 7j"    value={stats.prochainesEcheances} icon="bell"          iconColor={C.red}/>
        </div>
      )}

      {/* Filtres statut */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUT_FILTER.map(s => (
          <button key={s} onClick={() => { setStatut(s); setPage(1); }}
            style={{ padding: '6px 14px', border: `1.5px solid ${statut===s ? C.text : C.border}`, background: statut===s ? C.text : 'transparent', color: statut===s ? '#fff' : C.textMuted, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {STATUT_LABELS[s]}
          </button>
        ))}
      </div>

      <TableWrapper>
        <THead cols={['Client','Palier','Solde départ','Solde actuel','Bonus estimé','Versements','Échéance','Statut','Action']} />
        <tbody>
          {loading ? <tr><td colSpan={9}><Spinner /></td></tr>
          : plans.length === 0 ? <tr><td colSpan={9}><Empty msg="Aucun plan d'épargne trouvé." /></td></tr>
          : plans.map((p: any) => {
            const prog = p.progression;
            const bonusEstime = prog?.bonusEstime ?? Math.floor(Number(p.soldeActuel) * Number(p.bonusTaux));
            const eligible = prog?.eligible || p.statut === 'ELIGIBLE';
            return (
              <TR key={p.id}>
                <TD>
                  <div style={{ fontWeight: 600 }}>{p.compte?.user?.prenom} {p.compte?.user?.nom}</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{p.compte?.user?.telephone}</div>
                </TD>
                <TD>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{PALIER_LABELS[p.palier]}</span>
                </TD>
                <TD>{formatMontant(p.soldeDepart)}</TD>
                <TD bold>{formatMontant(p.soldeActuel)}</TD>
                <TD>
                  <span style={{ color: '#a16207', fontWeight: 700 }}>
                    {p.statut === 'BONIFIE' ? formatMontant(p.bonusMontant) : `~${formatMontant(bonusEstime)}`}
                  </span>
                </TD>
                <TD>
                  <span style={{ color: p.nbVersementsEffectues >= p.nbVersementsRequis ? C.green : C.red, fontWeight: 600 }}>
                    {p.nbVersementsEffectues}/{p.nbVersementsRequis}
                  </span>
                </TD>
                <TD muted>
                  {formatDate(p.dateEcheance, 'dd/MM/yyyy')}
                  {prog?.joursRestants > 0 && <div style={{ fontSize: 11, color: C.textMuted }}>dans {prog.joursRestants}j</div>}
                </TD>
                <TD><Badge v={p.statut.toLowerCase()} /></TD>
                <TD>
                  {eligible && p.statut === 'EN_COURS' && (
                    <button
                      onClick={() => handleDebloquer(p.id)}
                      disabled={deblocage === p.id}
                      style={{ background: C.green, color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: deblocage === p.id ? 0.6 : 1 }}>
                      {deblocage === p.id ? '...' : '🎁 Verser'}
                    </button>
                  )}
                </TD>
              </TR>
            );
          })}
        </tbody>
      </TableWrapper>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1} style={{ padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: C.white, opacity: page===1?0.4:1 }}>←</button>
          <span style={{ padding: '5px 12px', fontSize: 13, color: C.textMuted }}>Page {page}/{pagination.pages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.pages,p+1))} disabled={page===pagination.pages} style={{ padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: C.white, opacity: page===pagination.pages?0.4:1 }}>→</button>
        </div>
      )}
    </div>
  );
}
