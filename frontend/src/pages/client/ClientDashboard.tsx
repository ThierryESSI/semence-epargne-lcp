// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/client/ClientDashboard.tsx
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { C } from '../../lib/design';
import { PageHeader, StatCard, Badge, Spinner, Empty, Icon, ICONS } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function ClientDashboard() {
  const { user }    = useAuthStore();
  const navigate    = useNavigate();
  const [compte, setCompte]         = useState<any>(null);
  const [transactions, setTx]       = useState<any[]>([]);
  const [planActif, setPlanActif]   = useState<any>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/comptes/solde'),
      api.get('/transactions?limit=5'),
      api.get('/epargne/mes-plans'),
    ]).then(([c, t, e]) => {
      setCompte(c.data.data);
      setTx(t.data.data || []);
      const plans = e.data.data || [];
      setPlanActif(plans.find((p: any) => p.statut === 'EN_COURS') || null);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const actions = [
    { label:'Virement',       sub:'Envoyer des fonds',       path:'/client/virement',      bg:C.green     },
    { label:'Activer carte',  sub:'Scanner et créditer',     path:'/client/activer-carte', bg:'#1d6fa4'   },
    { label:'Mon epargne',    sub:'Plans et bonus',          path:'/client/epargne',       bg:'#7c4daa'   },
    { label:'Historique',     sub:'Toutes les transactions', path:'/client/transactions',  bg:'#5f5e5a'   },
  ];

  return (
    <div>
      <PageHeader title={`Bonjour, ${user?.prenom} 👋`} subtitle="Bienvenue sur votre espace SEMENCE ÉPARGNE"/>

      {/* Solde principal */}
      <div style={{ background:`linear-gradient(135deg,${C.sidebarBg},#2d4a30)`, borderRadius:16, padding:'22px 24px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ color:'rgba(255,255,255,0.6)', fontSize:13, marginBottom:4 }}>Solde disponible</div>
          <div style={{ color:'#fff', fontSize:36, fontWeight:900 }}>{formatMontant(compte?.solde||0)}</div>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, marginTop:4, fontFamily:'monospace' }}>
            N° {compte?.numeroCompte} · RIB : {compte?.rib || '—'}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 14px', marginBottom:6 }}>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:11 }}>Statut</div>
            <div style={{ color:C.gold, fontWeight:700, fontSize:13 }}>{compte?.statut}</div>
          </div>
          <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 14px' }}>
            <div style={{ color:'rgba(255,255,255,0.6)', fontSize:11 }}>Type</div>
            <div style={{ color:'#fff', fontWeight:600, fontSize:12 }}>{compte?.type?.replace(/_/g,' ')}</div>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {actions.map(a => (
          <button key={a.path} onClick={()=>navigate(a.path)}
            style={{ background:a.bg, color:'#fff', border:'none', borderRadius:12, padding:'16px 12px', cursor:'pointer', textAlign:'center', fontFamily:'inherit', transition:'transform .15s' }}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.transform='translateY(-2px)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform='none'}
          >
            <div style={{ fontSize:20, marginBottom:6 }}>{a.label.split(' ')[0]}</div>
            <div style={{ fontWeight:700, fontSize:13 }}>{a.label.split(' ').slice(1).join(' ')}</div>
            <div style={{ fontSize:11, opacity:0.75, marginTop:3 }}>{a.sub}</div>
          </button>
        ))}
      </div>

      {/* RIB card */}
      <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.border}`, padding:18, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:12, color:C.textMuted, marginBottom:4 }}>Mon RIB LCP — à communiquer pour recevoir un virement</div>
            <div style={{ fontFamily:'monospace', fontSize:18, fontWeight:800, color:C.text, letterSpacing:'0.05em' }}>{compte?.rib || 'RIB non disponible'}</div>
          </div>
          <button onClick={()=>navigator.clipboard?.writeText(compte?.rib||'')}
            style={{ background:C.greenPale, color:C.green, border:'none', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            📋 Copier
          </button>
        </div>
      </div>

      {/* Bannière plan épargne actif */}
      {planActif && (
        <div onClick={()=>navigate('/client/epargne')}
          style={{ background:`linear-gradient(135deg,#1a2e1c,#2d4a30)`, borderRadius:14, padding:18, marginBottom:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ color:C.gold,fontWeight:700,fontSize:12,marginBottom:3 }}>🌱 Plan Épargne en cours</div>
            <div style={{ color:'#fff',fontWeight:800,fontSize:16 }}>{planActif.config?.label} — Bonus {planActif.config?.tauxLabel}</div>
            <div style={{ color:'rgba(255,255,255,0.6)',fontSize:12,marginTop:3 }}>
              {planActif.progression?.joursRestants>0 ? `Échéance dans ${planActif.progression.joursRestants} j` : '✅ Échéance atteinte !'}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ color:C.gold,fontSize:11 }}>Bonus estimé</div>
            <div style={{ color:'#fff',fontWeight:900,fontSize:22 }}>+{formatMontant(planActif.progression?.bonusEstime||0)}</div>
            <div style={{ color:'rgba(255,255,255,0.5)',fontSize:11 }}>{planActif.nbVersementsEffectues}/{planActif.nbVersementsRequis} versements</div>
          </div>
        </div>
      )}

      {/* Dernières transactions */}
      <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.border}`, padding:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:C.text }}>Dernières transactions</h3>
          <button onClick={()=>navigate('/client/transactions')} style={{ background:'none',border:'none',color:C.green,fontSize:13,fontWeight:600,cursor:'pointer' }}>Voir tout</button>
        </div>
        {transactions.length===0 ? <Empty msg="Aucune transaction"/> : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {transactions.map(tx=>{
              const isVir = tx.type==='VIREMENT_LCP';
              const isBonus = tx.type==='BONUS_EPARGNE';
              const montantNet = Number(tx.montantNet);
              const isDebit = montantNet < 0;
              return (
                <div key={tx.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:`1px solid ${C.borderLight}` }}>
                  <div>
                    <p style={{ margin:0, fontWeight:600, fontSize:13 }}>
                      {isBonus ? '🎁 Bonus Épargne' : isVir ? (isDebit?'↗ Virement émis':'↙ Virement reçu') : '💳 Dépôt carte'}
                    </p>
                    <p style={{ margin:'2px 0 0', fontSize:11, color:C.textMuted }}>{formatDate(tx.createdAt, 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ margin:0, fontWeight:800, fontSize:15, color: isDebit?C.red:isBonus?C.gold:C.green }}>
                      {isDebit?'-':'+'}{ formatMontant(Math.abs(montantNet)) }
                    </p>
                    <Badge v={tx.statut?.toLowerCase()}/>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
