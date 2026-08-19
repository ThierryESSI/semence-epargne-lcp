// frontend/src/pages/auth/ForceChangePasswordPage.tsx
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { C } from '../../lib/design';
import logo from '../../assets/logo.png';

export default function ForceChangePasswordPage() {
  const navigate = useNavigate();
  const { setAuth, user } = useAuthStore();
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères');
    if (password !== confirm) return setError('Les mots de passe ne correspondent pas');

    setLoading(true);
    try {
      await api.put('/auth/force-password', { nouveauPassword: password });
      // Mettre à jour le store pour retirer le flag
      if (user) {
        setAuth({ ...user, mustChangePassword: false } as any, localStorage.getItem('access_token') || '', localStorage.getItem('refresh_token') || '');
      }
      navigate(user?.role === 'CLIENT' ? '/client' : '/admin', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors du changement de mot de passe');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:'100vh', background:`linear-gradient(135deg, ${C.sidebar} 0%, #1a3d6e 50%, ${C.secondary} 100%)`, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:420 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src={logo} alt="Semence Epargne" style={{ width:120, marginBottom:16, filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}/>
          <h1 style={{ color:'#fff', fontSize:22, fontWeight:800, margin:'0 0 6px' }}>SEMENCE EPARGNE</h1>
        </div>

        {/* Carte */}
        <div style={{ background:'#fff', borderRadius:20, padding:'28px 24px', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ background:C.goldPale, borderRadius:10, padding:'12px 14px', marginBottom:18, fontSize:13, color:'#a16207', display:'flex', gap:8, alignItems:'flex-start' }}>
            <span style={{ fontSize:18, flexShrink:0 }}>🔑</span>
            <div>
              <div style={{ fontWeight:700, marginBottom:2 }}>Changement de mot de passe requis</div>
              <div style={{ fontSize:12, opacity:0.8 }}>Pour des raisons de sécurité, vous devez définir un nouveau mot de passe avant de continuer.</div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>
                Nouveau mot de passe <span style={{ color:C.red }}>*</span>
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="Min. 8 caractères"
                style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit', color:C.text }}/>
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>
                Confirmer le mot de passe <span style={{ color:C.red }}>*</span>
              </label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                placeholder="Retapez le mot de passe"
                style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit', color:C.text }}/>
              {password && confirm && password !== confirm && (
                <div style={{ fontSize:12, color:C.red, marginTop:4 }}>Les mots de passe ne correspondent pas</div>
              )}
            </div>

            {error && (
              <div style={{ background:C.redPale, color:C.red, borderRadius:8, padding:'10px 12px', fontSize:13, marginBottom:14 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || password.length < 8 || password !== confirm}
              style={{ width:'100%', background:loading?C.textMuted:`linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:700, cursor:loading||password.length<8||password!==confirm?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:`0 4px 15px rgba(246,90,4,0.35)`, opacity:password.length<8||password!==confirm?0.5:1 }}>
              {loading ? 'Enregistrement...' : 'Définir mon mot de passe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
