// frontend/src/pages/admin/UnarciAgency.tsx
// Agence UNARCI — liste des adhérents + validation manuelle des paiements
import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, Btn, Alert, Spinner, Badge, StatCard, TableWrapper, THead, TR, TD, SearchBar, Empty } from '../../components/ui/DS';

const STATUTS = [
  { key:'',       label:'Tous' },
  { key:'INSCRIT',label:'Inscrits (paiement en attente)' },
  { key:'ACTIF',  label:'Actifs (payé + activé)' },
  { key:'REJETE', label:'Rejetés' },
];

export default function UnarciAgency() {
  const [adherents, setAdherents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total:0, inscrits:0, actifs:0, rejetes:0 });
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statut, setStatut] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true); setError('');
    try {
      const [a, s] = await Promise.all([
        api.get('/unarci/agence/adherents', { params:{ statut: statut || undefined, search: search || undefined } }),
        api.get('/unarci/agence/stats'),
      ]);
      setAdherents(a.data.data || []);
      setStats(s.data.data || {});
    } catch (e: any) { setError(e.response?.data?.error || 'Erreur de chargement'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [statut, search]);

  async function activer(id: string, nom: string) {
    if (!confirm(`Valider le paiement et activer le compte de ${nom} ?`)) return;
    setActivating(id); setError(''); setSuccess('');
    try {
      await api.post(`/unarci/agence/activer/${id}`);
      setSuccess(`Compte de ${nom} activé — paiement validé.`);
      load();
    } catch (e: any) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setActivating(null); }
  }

  const badge = (s: string) => {
    const map: Record<string, [string, string]> = {
      INSCRIT: ['#a16207', '#fff8e7'],
      ACTIF:   ['#2d6a4f', '#e6f6ef'],
      REJETE:  ['#b3261e', '#fdecea'],
    };
    const [color, bg] = map[s] || ['#0F2E52', '#eef3fa'];
    return { color, bg, label: s === 'ACTIF' ? 'Payé / Actif' : s === 'INSCRIT' ? 'En attente de paiement' : s };
  };

  return (
    <div>
      <PageHeader title="Adhésions UNARCI" subtitle="Adhérents enregistrés via le formulaire public — validez les paiements manuellement" />

      {error   && <Alert type="error"  >{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        <StatCard label="Total adhérents" value={stats.total || 0} icon="◎" iconColor={C.primary} />
        <StatCard label="En attente de paiement" value={stats.inscrits || 0} icon="⏳" iconColor="#a16207" />
        <StatCard label="Payés / Actifs" value={stats.actifs || 0} icon="✓" iconColor="#2d6a4f" />
        <StatCard label="Rejetés" value={stats.rejetes || 0} icon="✗" iconColor="#b3261e" />
      </div>

      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:16 }}>
        {STATUTS.map(s => (
          <button key={s.key} onClick={() => setStatut(s.key)}
            style={{ background: statut === s.key ? C.primary : '#fff', color: statut === s.key ? '#fff' : C.textMuted,
              border: statut === s.key ? 'none' : `1.5px solid ${C.border}`, borderRadius: 8, padding:'7px 14px',
              fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {s.label}
          </button>
        ))}
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Rechercher (nom, référence, téléphone)..." />

      {loading ? <Spinner /> : adherents.length === 0 ? (
        <Empty msg="Aucun adhérent pour ce filtre" />
      ) : (
        <TableWrapper>
          <THead cols={['Référence','Adhérent','Téléphone / Email','Ville','Statut','Inscrit le','Action']} />
          {adherents.map(a => {
            const b = badge(a.statut);
            return (
              <TR key={a.id}>
                <TD mono>{a.reference}</TD>
                <TD bold>{a.nomComplet}</TD>
                <TD>{a.user?.telephone}<br/><span style={{ color:C.textMuted, fontSize:11 }}>{a.user?.email}</span></TD>
                <TD>{a.ville || '—'}</TD>
                <TD><Badge v={b.label} /></TD>
                <TD>{new Date(a.createdAt).toLocaleDateString('fr-CI')}</TD>
                <TD>
                  {a.statut === 'INSCRIT' ? (
                    <Btn size="sm" loading={activating === a.id} onClick={() => activer(a.id, a.nomComplet)}>
                      Valider paiement
                    </Btn>
                  ) : (
                    <span style={{ fontSize:12, color:C.textMuted }}>{a.statut === 'ACTIF' ? 'Activé' : 'Rejeté'}</span>
                  )}
                </TD>
              </TR>
            );
          })}
        </TableWrapper>
      )}
    </div>
  );
}
