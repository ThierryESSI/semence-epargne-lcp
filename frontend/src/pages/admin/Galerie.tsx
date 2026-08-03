// frontend/src/pages/admin/Galerie.tsx
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { useState, useEffect, useRef } from 'react';
import { api } from '../../lib/api';
import { C } from '../../lib/design';
import { PageHeader, Btn, Alert, Spinner } from '../../components/ui/DS';

export default function Galerie() {
  const [photos,    setPhotos]    = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [form,      setForm]      = useState({ titre:'', descriptif:'' });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/galerie');
      setPhotos(data.data || []);
    } catch(e: any) { setError(e.response?.data?.error || 'Erreur'); }
    finally { setLoading(false); }
  }

  async function uploader(file: File) {
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('titre', form.titre);
      fd.append('descriptif', form.descriptif);
      await api.post('/galerie', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      setSuccess('Photo ajoutee avec succes');
      setForm({ titre:'', descriptif:'' });
      load();
    } catch(e: any) { setError(e.response?.data?.error || 'Erreur upload'); }
    finally { setUploading(false); }
  }

  async function supprimer(cle: string) {
    if (!confirm('Supprimer cette photo ?')) return;
    try {
      await api.delete(`/galerie/${cle}`);
      setSuccess('Photo supprimee');
      load();
    } catch(e: any) { setError(e.response?.data?.error || 'Erreur'); }
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <PageHeader title="Galerie photos" subtitle="Gerez les photos affichees sur semenceep.ci"/>
      {error   && <Alert type="error"  >{error}</Alert>}
      {success && <Alert type="success">{success}</Alert>}
      <div style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, padding:20, marginBottom:20 }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:14 }}>Ajouter une photo</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:C.textMuted, marginBottom:5 }}>Titre</label>
            <input value={form.titre} onChange={e => setForm(f=>({...f,titre:e.target.value}))}
              placeholder="Ex: Ceremonie de lancement"
              style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }}/>
          </div>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:C.textMuted, marginBottom:5 }}>Descriptif</label>
            <input value={form.descriptif} onChange={e => setForm(f=>({...f,descriptif:e.target.value}))}
              placeholder="Ex: Abidjan, juillet 2026"
              style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'9px 12px', fontSize:13, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }}/>
          </div>
        </div>
        <input type="file" ref={fileRef} style={{ display:'none' }} accept="image/jpeg,image/png,image/webp"
          onChange={e => e.target.files?.[0] && uploader(e.target.files[0])}/>
        <Btn onClick={() => fileRef.current?.click()} loading={uploading}>
          {uploading ? 'Upload en cours...' : 'Choisir une image et ajouter'}
        </Btn>
      </div>
      {photos.length === 0 ? (
        <div style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, padding:40, textAlign:'center', color:C.textMuted }}>
          Aucune photo. Ajoutez votre premiere photo ci-dessus.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {photos.map(photo => (
            <div key={photo.cle} style={{ background:'#fff', borderRadius:12, border:`1px solid ${C.border}`, overflow:'hidden' }}>
              <img src={photo.url} alt={photo.titre} style={{ width:'100%', height:200, objectFit:'cover' }}/>
              <div style={{ padding:'12px 14px' }}>
                {photo.titre && <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{photo.titre}</div>}
                {photo.descriptif && <div style={{ fontSize:12, color:C.textMuted, marginBottom:10 }}>{photo.descriptif}</div>}
                <button onClick={() => supprimer(photo.cle)}
                  style={{ background:C.redPale, color:C.red, border:'none', borderRadius:7, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
