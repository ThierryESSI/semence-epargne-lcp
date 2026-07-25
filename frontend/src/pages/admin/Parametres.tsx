// frontend/src/pages/admin/Parametres.tsx
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, Btn, Alert, Spinner, Input } from '../../components/ui/DS';

interface ConfigItem { id:string; cle:string; valeur:string; type:string; label:string; }

const GROUPES: Record<string, string[]> = {
  'Identite du site':       ['SITE_NOM','SITE_SLOGAN','SITE_DESCRIPTION','SITE_COULEUR_PRIMAIRE','SITE_COULEUR_SECONDAIRE'],
  'Contact public':         ['SITE_TEL','SITE_EMAIL','SITE_WHATSAPP','SITE_ADRESSE'],
  'Images':                 ['SITE_LOGO_URL','SITE_HERO_IMAGE'],
  'Taux et commissions':    ['FRAIS_TAUX','BONUS_3M_TAUX','BONUS_6M_TAUX','BONUS_12M_TAUX'],
  'Notifications':          ['NOTIF_WHATSAPP_ACTIVE','NOTIF_EMAIL_ACTIVE'],
  'Systeme':                ['MAINTENANCE_MODE'],
};

export default function Parametres() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<string|null>(null);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [vals,    setVals]    = useState<Record<string,string>>({});
  const fileRefs = useRef<Record<string,HTMLInputElement|null>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/site-config');
      setConfigs(data.data || []);
      const m: Record<string,string> = {};
      (data.data || []).forEach((c: ConfigItem) => { m[c.cle] = c.valeur; });
      setVals(m);
    } catch(e:any) { setError(e.response?.data?.error || 'Erreur de chargement'); }
    finally { setLoading(false); }
  }

  async function save(cle: string) {
    setSaving(cle); setError(''); setSuccess('');
    try {
      await api.patch(`/site-config/${cle}`, { valeur: vals[cle] });
      setSuccess(`"${cle}" mis a jour`);
    } catch(e:any) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setSaving(null); }
  }

  async function uploadImage(cle: string, file: File) {
    setSaving(cle); setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post(`/site-config/${cle}/image`, fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      setVals(v => ({ ...v, [cle]: data.data.url }));
      setSuccess(`Image "${cle}" mise a jour`);
      load();
    } catch(e:any) { setError(e.response?.data?.error || 'Erreur upload'); }
    finally { setSaving(null); }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Parametres" subtitle="Modifier le contenu, les textes et les images du site"/>
      {error   && <Alert type="error"  >{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}

      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        {Object.entries(GROUPES).map(([groupe, cles]) => {
          const items = configs.filter(c => cles.includes(c.cle));
          if (!items.length) return null;
          return (
            <div key={groupe} style={{ background:'#fff', borderRadius:14, border:`1px solid ${C.border}`, overflow:'hidden' }}>
              <div style={{ padding:'12px 18px', background:C.bg, borderBottom:`1px solid ${C.border}`, fontWeight:700, fontSize:14, color:C.text }}>
                {groupe}
              </div>
              <div style={{ padding:16, display:'flex', flexDirection:'column', gap:12 }}>
                {items.map(cfg => (
                  <div key={cfg.cle} style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:12, alignItems:'end' }}>
                    <div>
                      <label style={{ display:'block', fontSize:12, fontWeight:600, color:C.textMuted, marginBottom:4 }}>
                        {cfg.label} <span style={{ fontSize:10, color:C.textLight, fontFamily:'monospace' }}>({cfg.cle})</span>
                      </label>

                      {cfg.type === 'IMAGE' ? (
                        <div>
                          {vals[cfg.cle] && (
                            <img src={vals[cfg.cle]} alt={cfg.cle} style={{ height:50, borderRadius:6, marginBottom:8, border:`1px solid ${C.border}` }}/>
                          )}
                          <input type="file" ref={el => fileRefs.current[cfg.cle] = el} style={{ display:'none' }}
                            accept="image/jpeg,image/png,image/webp"
                            onChange={e => e.target.files?.[0] && uploadImage(cfg.cle, e.target.files[0])}/>
                          <button onClick={() => fileRefs.current[cfg.cle]?.click()}
                            style={{ background:C.bluePale, color:C.blue, border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                            {saving===cfg.cle ? 'Upload...' : 'Choisir une image'}
                          </button>
                        </div>
                      ) : cfg.type === 'BOOLEAN' ? (
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                            <input type="checkbox" checked={vals[cfg.cle]==='true'}
                              onChange={e => setVals(v => ({ ...v, [cfg.cle]: e.target.checked ? 'true' : 'false' }))}
                              style={{ accentColor:C.primary, width:16, height:16 }}/>
                            {vals[cfg.cle]==='true' ? 'Actif' : 'Inactif'}
                          </label>
                        </div>
                      ) : cfg.cle.includes('COULEUR') ? (
                        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                          <input type="color" value={vals[cfg.cle]||'#000000'}
                            onChange={e => setVals(v => ({ ...v, [cfg.cle]: e.target.value }))}
                            style={{ width:40, height:36, borderRadius:6, border:`1px solid ${C.border}`, cursor:'pointer', padding:2 }}/>
                          <input value={vals[cfg.cle]||''} onChange={e => setVals(v => ({ ...v, [cfg.cle]: e.target.value }))}
                            style={{ flex:1, border:`1.5px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', fontFamily:'monospace' }}/>
                        </div>
                      ) : cfg.cle === 'SITE_DESCRIPTION' ? (
                        <textarea value={vals[cfg.cle]||''} onChange={e => setVals(v => ({ ...v, [cfg.cle]: e.target.value }))}
                          rows={3} style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', fontFamily:'inherit', resize:'vertical', boxSizing:'border-box' }}/>
                      ) : (
                        <input value={vals[cfg.cle]||''} onChange={e => setVals(v => ({ ...v, [cfg.cle]: e.target.value }))}
                          style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}/>
                      )}
                    </div>

                    {cfg.type !== 'IMAGE' && (
                      <Btn onClick={() => save(cfg.cle)} loading={saving===cfg.cle} size="sm">
                        Sauvegarder
                      </Btn>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
