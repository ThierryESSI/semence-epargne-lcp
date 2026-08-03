// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/admin/Cartes.tsx
import { useState } from 'react';
import { api } from '../../lib/api';
import { usePaginated } from '../../hooks/useData';
import { C } from '../../lib/design';
import { PageHeader, TableWrapper, THead, TR, TD, Badge, Modal, FormGrid, Input, Select, Btn, StatCard, Spinner, Empty, Pagination, Alert, Icon, ICONS } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';

const MONTANTS = [500,1000,2000,5000,10000,25000,50000];
const TABS = ['Toutes','Disponibles','Attribuées','Utilisées','Lots'];

export default function Cartes() {
  const [tab, setTab] = useState('');
  const { items, pagination, loading, page, setPage, search, setSearch, refetch } = usePaginated<any>('/cartes/emettre', tab && tab !== 'Toutes' && tab !== 'Lots' ? { statut: tab.toUpperCase().replace('É','E').replace('ES','E') } : {});
  const [showEmission, setShowEmission] = useState(false);
  const [showActivation, setShowActivation] = useState(false);
  const [montant, setMontant] = useState(1000);
  const [quantite, setQuantite] = useState(10);
  const [lotRef, setLotRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [emises, setEmises] = useState<any[]>([]);
  const [lotInfo, setLotInfo] = useState<any>(null);
  const [codeCarte, setCodeCarte] = useState('');
  const [codeValid, setCodeValid] = useState('');

  const [lots, setLots] = useState<any[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotsPage, setLotsPage] = useState(1);
  const [lotsPag, setLotsPag] = useState({ total: 0, page: 1, limit: 20, pages: 1 });

  const fraisTotal = montant * quantite * 0.01;
  const partLcp = fraisTotal * 0.6;
  const partDist = fraisTotal * 0.4;

  async function loadLots(p: number = lotsPage) {
    setLotsLoading(true);
    try {
      const { data } = await api.get(`/cartes/lots?page=${p}&limit=20`);
      setLots(data.data || []);
      setLotsPag(data.pagination);
    } catch { setLots([]); }
    finally { setLotsLoading(false); }
  }

  async function handleEmettre(e:any) {
    e.preventDefault(); setError(''); setSubmitting(true);
    try {
      const {data} = await api.post('/cartes/emettre', { montant, quantite, lot: lotRef.trim() || undefined });
      setEmises(data.data || []);
      setLotInfo(data.lot || null);
      refetch();
      if (tab === 'Lots') loadLots(1);
    } catch(err:any) { setError(err.response?.data?.error||'Erreur'); }
    finally { setSubmitting(false); }
  }

  async function handleGrillerLot(l:any) {
    const motif = prompt(`GRILLER LE LOT ${l.reference} ?\n\nAnnule définitivement toutes les cartes non utilisées (${l.totalCartes - l.utilisees - l.annulees} carte(s)).\n\nMotif (fraude, vol, erreur...) :`, 'Fraude présumée');
    if (motif === null) return;
    if (!confirm(`Confirmer le grillage du lot ${l.reference} ? Cette action est IRREVERSIBLE.`)) return;
    try {
      const { data } = await api.post(`/cartes/lots/${l.id}/griller`, { motif });
      alert(data.message || 'Lot grillé');
      loadLots(lotsPage);
    } catch(err:any) { alert(err.response?.data?.error || 'Erreur'); }
  }

  function switchTab(t:string) {
    setTab(t === 'Toutes' ? '' : t);
    if (t === 'Lots') { setLotsPage(1); loadLots(1); }
  }

  const statsItems = items as any[];
  const dispo = statsItems.filter(c=>c.statut==='DISPONIBLE').length;
  const vendue = statsItems.filter(c=>c.statut==='VENDUE').length;
  const utilisee = statsItems.filter(c=>c.statut==='UTILISEE').length;

  return (
    <div>
      <PageHeader title="Cartes Semence Épargne" subtitle="Émission par lot, recharge SMS (CSE-XXXXXXXX), grillage anti-fraude"
        action={<>
          <Btn variant="ghost" onClick={()=>setShowActivation(true)}><Icon d={ICONS.credit} size={15} color={C.textMuted}/>Activer une carte</Btn>
          <Btn onClick={()=>setShowEmission(true)}><Icon d={ICONS.plus} size={15} color="#fff"/>Émettre des cartes</Btn>
        </>}/>

      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        <StatCard label="Disponibles" value={pagination.total > 0 ? String(dispo) : '—'} icon="cartes"/>
        <StatCard label="Attribuées" value={pagination.total > 0 ? String(vendue) : '—'} icon="credit"/>
        <StatCard label="Utilisées" value={pagination.total > 0 ? String(utilisee) : '—'} icon="zap"/>
        <StatCard label="Valeur totale" value={pagination.total > 0 ? formatMontant(items.reduce((s:any,c:any)=>s+Number(c.montant||0),0)) : '—'} icon="credit"/>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,marginBottom:16,alignItems:'center',flexWrap:'wrap'}}>
        {TABS.map((t,i)=>(
          <button key={t} onClick={()=>switchTab(t)}
            style={{padding:'7px 16px',border:`1.5px solid ${(tab===t||(t==='Toutes'&&!tab))?C.text:C.border}`,background:(tab===t||(t==='Toutes'&&!tab))?C.text:'transparent',color:(tab===t||(t==='Toutes'&&!tab))?'#fff':C.textMuted,borderRadius:i===0?'8px 0 0 8px':i===TABS.length-1?'0 8px 8px 0':'0',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Lots' ? (
        <div>
          <TableWrapper>
            <THead cols={['Lot','Montant','Cartes','Utilisées','Annulées','Statut','Créé le','Actions']}/>
            <tbody>
              {lotsLoading ? <tr><td colSpan={8}><Spinner/></td></tr>
              : lots.length===0 ? <tr><td colSpan={8}><Empty msg="Aucun lot. Émettez votre premier lot de cartes."/></td></tr>
              : lots.map((l:any)=>(
                <TR key={l.id}>
                  <TD><span style={{fontFamily:'monospace',color:C.green,fontSize:12,fontWeight:600}}>{l.reference}</span></TD>
                  <TD bold>{formatMontant(l.montant)}</TD>
                  <TD bold>{l.totalCartes}</TD>
                  <TD><span style={{color:C.green,fontWeight:600}}>{l.utilisees}</span></TD>
                  <TD>{l.annulees > 0 ? <span style={{color:C.red,fontWeight:600}}>{l.annulees}</span> : <span style={{color:C.textMuted}}>0</span>}</TD>
                  <TD><Badge v={l.statut?.toLowerCase()}/></TD>
                  <TD muted>{formatDate(l.createdAt,'dd/MM/yy')}</TD>
                  <TD>
                    {l.statut !== 'GRILLE' && (
                      <button onClick={()=>handleGrillerLot(l)}
                        style={{background:C.redPale,color:C.red,border:'none',borderRadius:6,padding:'4px 10px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                        <Icon d={ICONS.trash} size={12} color={C.red} style={{verticalAlign:'-2px',marginRight:4}}/>Griller
                      </button>
                    )}
                  </TD>
                </TR>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={lotsPage} pages={lotsPag.pages} onChange={(p:number)=>{setLotsPage(p);loadLots(p);}}/>
        </div>
      ) : (
        <>
          <TableWrapper>
            <THead cols={['Code carte','Lot','Montant','Frais (1%)','Part LCP','Part Distrib.','Crédité','Code valid.','Statut','Date']}/>
            <tbody>
              {loading ? <tr><td colSpan={10}><Spinner/></td></tr>
              : items.length===0 ? <tr><td colSpan={10}><Empty msg="Aucune carte. Émettez votre premier lot."/></td></tr>
              : items.map((c:any)=>{
                const mnt=Number(c.montant||0);
                const frais=Math.ceil(mnt*0.01);
                return (
                  <TR key={c.id}>
                    <TD>
                      <span style={{fontFamily:'monospace',color:C.green,fontSize:12,fontWeight:600}}>{c.reference}</span>
                      {c.refCourt && <div style={{fontSize:11,color:C.textMuted,fontFamily:'monospace',marginTop:2}}>SMS: <strong style={{color:C.red}}>{c.refCourt}</strong></div>}
                    </TD>
                    <TD muted>{c.lot?.reference || '—'}</TD>
                    <TD bold>{formatMontant(mnt)}</TD>
                    <TD><span style={{color:C.red,fontWeight:600}}>{formatMontant(frais)}</span></TD>
                    <TD><span style={{color:C.green,fontWeight:600}}>{formatMontant(Math.round(frais*0.6))}</span></TD>
                    <TD><span style={{color:C.gold,fontWeight:600}}>{formatMontant(Math.round(frais*0.4))}</span></TD>
                    <TD bold>{formatMontant(mnt-frais)}</TD>
                    <TD mono muted>****</TD>
                    <TD><Badge v={c.statut?.toLowerCase()}/></TD>
                    <TD muted>{formatDate(c.createdAt,'dd/MM/yy')}</TD>
                  </TR>
                );
              })}
            </tbody>
          </TableWrapper>
          <Pagination page={page} pages={pagination.pages} onChange={setPage}/>
        </>
      )}

      {/* Modal émission */}
      {showEmission && (
        <Modal title="Émission de cartes (par lot)" onClose={()=>{setShowEmission(false);setEmises([]);setLotInfo(null);setError('');}}>
          {emises.length > 0 ? (
            <div>
              <div style={{background:C.greenPale,borderRadius:10,padding:12,marginBottom:16}}>
                <p style={{margin:0,fontWeight:700,color:C.green}}>✅ {emises.length} carte(s) émise(s) avec succès !</p>
                {lotInfo && <p style={{margin:'6px 0 0',fontSize:13,color:C.text}}>Lot : <strong style={{fontFamily:'monospace'}}>{lotInfo.reference}</strong></p>}
              </div>
              <div style={{maxHeight:360,overflowY:'auto',display:'flex',flexDirection:'column',gap:12}}>
                {emises.map((c:any)=>(
                  <div key={c.id} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:14,background:'#f8faf8'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:8}}>
                      <div>
                        <p style={{margin:0,fontWeight:700,color:C.green,fontFamily:'monospace',fontSize:12}}>{c.reference}</p>
                        {c.refCourt && <p style={{margin:'4px 0 0',fontSize:12,color:C.text}}>Recharge SMS : <strong style={{color:C.red,fontFamily:'monospace'}}>{c.refCourt}</strong></p>}
                        <p style={{margin:'4px 0 0',fontSize:13,color:C.text}}>{formatMontant(c.montant)}</p>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <p style={{margin:0,fontSize:12,color:C.textMuted}}>Code validation</p>
                        <p style={{margin:'4px 0 0',fontWeight:800,color:C.red,fontSize:18,fontFamily:'monospace'}}>{c.codeValidation}</p>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                      <div style={{textAlign:'center'}}>
                        <p style={{fontSize:11,color:C.textMuted,margin:'0 0 4px'}}>QR Authentification (Recto)</p>
                        <img src={c.qrAuthImage} alt="QR Auth" style={{width:100,height:100,border:`1px solid ${C.border}`,borderRadius:8}}/>
                      </div>
                      <div style={{textAlign:'center'}}>
                        <p style={{fontSize:11,color:C.textMuted,margin:'0 0 4px'}}>QR Épargne (Verso)</p>
                        <img src={c.qrEpargneImage} alt="QR Epargne" style={{width:100,height:100,border:`1px solid ${C.border}`,borderRadius:8}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Btn variant="secondary" onClick={()=>{setShowEmission(false);setEmises([]);setLotInfo(null);}} style={{width:'100%',justifyContent:'center',marginTop:12}}>Fermer</Btn>
            </div>
          ) : (
            <form onSubmit={handleEmettre}>
              <div style={{marginBottom:14}}>
                <label style={{fontSize:13,fontWeight:600,color:C.text,display:'block',marginBottom:6}}>Montant unitaire (FCFA)</label>
                <select value={montant} onChange={e=>setMontant(Number(e.target.value))} style={{width:'100%',border:`1.5px solid ${C.green}`,borderRadius:8,padding:'10px 12px',fontSize:14,outline:'none',fontFamily:'inherit'}}>
                  {MONTANTS.map(m=><option key={m} value={m}>{formatMontant(m)}</option>)}
                </select>
              </div>
              <FormGrid>
                <Input label="Quantité" type="number" min={1} max={500} value={quantite} onChange={(e:any)=>setQuantite(Number(e.target.value))}/>
                <Input label="Référence du lot (optionnel)" value={lotRef} onChange={(e:any)=>setLotRef(e.target.value)} placeholder="LOT-XXXXXX (auto si vide)"/>
              </FormGrid>
              <div style={{background:'#f8faf8',borderRadius:10,padding:14,margin:'14px 0',border:`1px solid ${C.border}`}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}><span style={{color:C.textMuted}}>Valeur totale</span><span style={{fontWeight:800}}>{formatMontant(montant*quantite)}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}><span style={{color:C.textMuted}}>Frais (1%)</span><span style={{color:C.red,fontWeight:700}}>{formatMontant(fraisTotal)}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}><span style={{color:C.textMuted,fontSize:12}}>Part LCP (0,6%)</span><span style={{color:C.green,fontWeight:600}}>{formatMontant(partLcp)}</span></div>
                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:C.textMuted,fontSize:12}}>Part Distributeur (0,4%)</span><span style={{color:C.gold,fontWeight:600}}>{formatMontant(partDist)}</span></div>
              </div>
              {error && <Alert type="error">{error}</Alert>}
              <Btn type="submit" loading={submitting} style={{width:'100%',justifyContent:'center',padding:'13px'}} size="lg">Émettre {quantite} carte{quantite>1?'s':''}</Btn>
            </form>
          )}
        </Modal>
      )}

      {/* Modal activation */}
      {showActivation && (
        <Modal title="Activation de carte Semence Épargne" onClose={()=>setShowActivation(false)}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:20}}>
            {[1,2,3].map(s=>(
              <div key={s} style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:32,height:32,borderRadius:'50%',background:s===1?C.green:'#e8ede9',color:s===1?'#fff':C.textMuted,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14}}>{s}</div>
                {s<3 && <div style={{width:28,height:2,background:'#e8ede9'}}/>}
              </div>
            ))}
          </div>
          <p style={{textAlign:'center',color:C.green,fontSize:14,marginBottom:16}}>Saisissez le code de la carte et le code de validation (4 chiffres au verso)</p>
          <Input label="Code de la carte" placeholder="CSE..." value={codeCarte} onChange={(e:any)=>setCodeCarte(e.target.value)}/>
          <div style={{height:12}}/>
          <Input label="Code de validation (4 chiffres)" placeholder="XXXX" value={codeValid} onChange={(e:any)=>setCodeValid(e.target.value)} style={{textAlign:'center',fontSize:20,letterSpacing:'0.3em'}}/>
          <Btn style={{width:'100%',justifyContent:'center',padding:'13px',marginTop:16}} size="lg">
            <Icon d={ICONS.credit} size={16} color="#fff"/>Vérifier la carte
          </Btn>
        </Modal>
      )}
    </div>
  );
}
