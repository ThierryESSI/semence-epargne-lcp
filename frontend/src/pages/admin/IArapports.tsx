// frontend/src/pages/admin/IArapports.tsx
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { useState } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, Btn, Alert, Spinner } from '../../components/ui/DS';

export default function IArapports() {
  const [loading,  setLoading]  = useState(false);
  const [analyse,  setAnalyse]  = useState<any>(null);
  const [question, setQuestion] = useState('');
  const [reponse,  setReponse]  = useState('');
  const [qLoading, setQLoading] = useState(false);
  const [error,    setError]    = useState('');
  const [periode,  setPeriode]  = useState(new Date().toISOString().slice(0,7));

  async function generer() {
    setLoading(true); setError(''); setAnalyse(null);
    try {
      const { data } = await api.post('/ia/analyser', { periode });
      setAnalyse(data.data);
    } catch(e: any) { setError(e.response?.data?.error || 'Erreur IA'); }
    finally { setLoading(false); }
  }

  async function poserQuestion() {
    if (!question.trim()) return;
    setQLoading(true); setReponse('');
    try {
      const { data } = await api.post('/ia/question', { question, periode });
      setReponse(data.data.reponse);
    } catch(e: any) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setQLoading(false); }
  }

  return (
    <div>
      <PageHeader
        title="Analyse IA — Intelligence des rapports"
        subtitle="Analyse automatique de vos donnees par Claude (Anthropic)"
      />
      {error && <Alert type="error">{error}</Alert>}

      <div style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, padding:20, marginBottom:16, display:'flex', gap:16, alignItems:'flex-end', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:200 }}>
          <label style={{ display:'block', fontSize:12, fontWeight:600, color:C.textMuted, marginBottom:6 }}>Periode a analyser</label>
          <input type="month" value={periode} onChange={e => setPeriode(e.target.value)}
            style={{ border:`1.5px solid ${C.border}`, borderRadius:8, padding:'9px 12px', fontSize:14, fontFamily:'inherit', color:C.text, outline:'none' }}/>
        </div>
        <Btn onClick={generer} loading={loading}>Generer l'analyse IA</Btn>
      </div>

      {loading && (
        <div style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, padding:40, textAlign:'center' }}>
          <Spinner />
          <p style={{ color:C.textMuted, marginTop:12 }}>Claude analyse vos donnees... (~10 secondes)</p>
        </div>
      )}

      {analyse && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
            {[
              ['Clients total',         analyse.donnees.clients.total,                    C.blue],
              ['Nouveaux ce mois',      analyse.donnees.clients.nouveaux,                 C.green],
              ['Depots cartes',         analyse.donnees.transactions.depots.nombre,       C.primary],
              ['Recharges SMS rurales', analyse.donnees.transactions.rechargesSMS,        '#7c4daa'],
            ].map(([label, val, color]) => (
              <div key={label as string} style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, padding:'14px 16px' }}>
                <div style={{ fontSize:11, color:C.textMuted, marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:22, fontWeight:800, color: color as string }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, padding:24, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>Analyse IA — {analyse.periode}</div>
              <div style={{ fontSize:11, color:C.textMuted }}>{analyse.tokensUtilises} tokens · Cout : {analyse.coutEstime}</div>
            </div>
            <div style={{ background:C.bg, borderRadius:10, padding:'16px 20px', fontSize:14, lineHeight:1.8, color:C.text, whiteSpace:'pre-wrap' }}>
              {analyse.analyse}
            </div>
            <div style={{ marginTop:12, fontSize:11, color:C.textMuted }}>
              Genere le {new Date(analyse.genereAt).toLocaleString('fr-CI')} · Modele : claude-haiku-4-5
            </div>
          </div>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, padding:20 }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>Posez une question a l'IA</div>
        <div style={{ fontSize:13, color:C.textMuted, marginBottom:14 }}>
          Exemples : "Quels clients n'ont pas recharge depuis 30 jours ?" · "Quel conseiller performe le mieux ?"
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <input value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="Votre question sur les donnees..."
            onKeyDown={e => e.key === 'Enter' && poserQuestion()}
            style={{ flex:1, border:`1.5px solid ${C.border}`, borderRadius:8, padding:'10px 14px', fontSize:14, fontFamily:'inherit', color:C.text, outline:'none' }}/>
          <Btn onClick={poserQuestion} loading={qLoading}>Demander</Btn>
        </div>
        {reponse && (
          <div style={{ marginTop:14, background:C.bluePale, borderRadius:10, padding:'14px 18px', fontSize:14, lineHeight:1.7, color:C.text }}>
            <div style={{ fontWeight:600, color:C.blue, marginBottom:6, fontSize:12 }}>Reponse IA</div>
            {reponse}
          </div>
        )}
      </div>
    </div>
  );
}
