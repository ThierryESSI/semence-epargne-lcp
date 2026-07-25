// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/pages/admin/Transactions.tsx
import { useState } from 'react';
import { usePaginated } from '../../hooks/useData';
import { C } from '../../lib/design';
import { PageHeader, TableWrapper, THead, TR, TD, Badge, StatCard, Spinner, Empty, Pagination, SearchBar, Icon, ICONS } from '../../components/ui/DS';
import { formatMontant, formatDate } from '../../lib/utils';
import { PieChart, Pie, Cell } from 'recharts';

export default function Transactions() {
  const [filter, setFilter] = useState('');
  const { items, pagination, loading, page, setPage, search, setSearch } = usePaginated<any>('/transactions', filter ? { statut: filter } : {});

  const total = items.reduce((s:number,t:any)=>s+Number(t.montant||0),0);
  const totalFrais = items.reduce((s:number,t:any)=>s+Number(t.frais||0),0);
  const totalNet = items.reduce((s:number,t:any)=>s+Number(t.montantNet||0),0);
  const partLcp = Math.round(totalFrais*0.6);
  const partDist = Math.round(totalFrais*0.4);
  const pie = [{name:'LCP',value:partLcp},{name:'Distrib.',value:partDist}];

  const FILTERS = ['','SUCCES','EN_COURS','ECHEC'];
  const FILTER_LABELS: Record<string,string> = {'':'Toutes','SUCCES':'Succès','EN_COURS':'En cours','ECHEC':'Échec'};

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Historique complet des opérations"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:20}}>
        <StatCard label="Total crédité" value={formatMontant(totalNet)} icon="arrowDown" iconColor={C.green}/>
        <StatCard label="Total frais (1%)" value={formatMontant(totalFrais)} icon="transactions" iconColor={C.red}/>
        <StatCard label="Part LCP (0,6%)" value={formatMontant(partLcp)} icon="arrowUp" iconColor={C.green}/>
        <StatCard label="Part Distrib. (0,4%)" value={formatMontant(partDist)} icon="arrowUp" iconColor={C.gold}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:16}}>
        <div>
          <div style={{display:'flex',gap:8,marginBottom:14,alignItems:'center',flexWrap:'wrap'}}>
            <SearchBar value={search} onChange={(v:string)=>{setSearch(v);setPage(1);}} placeholder="Rechercher..."/>
            {FILTERS.map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                style={{padding:'7px 14px',border:`1.5px solid ${filter===f?C.text:C.border}`,background:filter===f?C.text:'transparent',color:filter===f?'#fff':C.textMuted,borderRadius:8,fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'}}>
                {FILTER_LABELS[f]} {f===''&&pagination.total>0?`(${pagination.total})`:''}
              </button>
            ))}
          </div>
          <TableWrapper>
            <THead cols={['Réf.','Client','Type','Montant brut','Frais','Net crédité','Statut','Date']}/>
            <tbody>
              {loading ? <tr><td colSpan={8}><Spinner/></td></tr>
              : items.length===0 ? <tr><td colSpan={8}><Empty msg="Aucune transaction pour le moment."/></td></tr>
              : items.map((tx:any)=>(
                <TR key={tx.id}>
                  <TD mono muted>{tx.reference?.slice(0,15)}...</TD>
                  <TD bold>{tx.compte?.user?.prenom} {tx.compte?.user?.nom}</TD>
                  <TD><span style={{background:C.greenPale,color:C.green,padding:'3px 8px',borderRadius:6,fontSize:11,fontWeight:600}}>{tx.type?.replace(/_/g,' ')}</span></TD>
                  <TD>{formatMontant(tx.montant)}</TD>
                  <TD><span style={{color:C.red,fontWeight:700}}>{formatMontant(tx.frais)}</span></TD>
                  <TD bold>{formatMontant(tx.montantNet)}</TD>
                  <TD><Badge v={tx.statut?.toLowerCase()}/></TD>
                  <TD muted>{formatDate(tx.createdAt,'dd/MM/yy HH:mm')}</TD>
                </TR>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} pages={pagination.pages} onChange={setPage}/>
        </div>

        {/* Clé répartition */}
        <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,padding:20}}>
          <h3 style={{margin:'0 0 8px',fontSize:15,fontWeight:700,color:C.text}}>Clé de répartition</h3>
          <div style={{textAlign:'center',margin:'8px 0'}}>
            <div style={{fontSize:24,fontWeight:800}}>{formatMontant(totalFrais)}</div>
            <div style={{fontSize:12,color:C.textMuted}}>Total frais collectés (1%)</div>
          </div>
          {totalFrais > 0 ? (
            <PieChart width={160} height={110} style={{margin:'0 auto'}}>
              <Pie data={pie} cx={80} cy={55} innerRadius={30} outerRadius={52} dataKey="value" startAngle={90} endAngle={-270}>
                <Cell fill={C.green}/><Cell fill={C.gold}/>
              </Pie>
            </PieChart>
          ) : (
            <div style={{height:80,display:'flex',alignItems:'center',justifyContent:'center',color:C.textLight,fontSize:13}}>Aucun frais</div>
          )}
          <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:8,fontSize:12}}>
            <div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:10,height:10,background:C.green,borderRadius:2}}/><span style={{color:C.textMuted}}>Part LCP (2 parts)</span></div>
            <div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:10,height:10,background:C.gold,borderRadius:2}}/><span style={{color:C.textMuted}}>Part Distributeurs (1 part)</span></div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:12}}>
            <div style={{background:C.greenPale,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
              <div style={{fontSize:11,color:C.green,fontWeight:600}}>LCP (0,6%)</div>
              <div style={{fontSize:16,fontWeight:800,color:C.green}}>{formatMontant(partLcp)}</div>
            </div>
            <div style={{background:C.goldPale,borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
              <div style={{fontSize:11,color:'#a16207',fontWeight:600}}>Distrib. (0,4%)</div>
              <div style={{fontSize:16,fontWeight:800,color:'#a16207'}}>{formatMontant(partDist)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
