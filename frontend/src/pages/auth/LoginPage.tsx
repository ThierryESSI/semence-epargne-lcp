// frontend/src/pages/auth/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { C } from '../../lib/design';
import logo from '../../assets/logo.png';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [identifiant, setIdentifiant] = useState('');
  const [password, setPassword]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { identifiant, password });
      setAuth(data.user, data.accessToken, data.refreshToken);
      const role = data.user.role;
      navigate(role === 'CLIENT' ? '/client' : '/admin');
    } catch(err: any) {
      setError(err.response?.data?.error || 'Identifiant ou mot de passe incorrect');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight:'100vh', background:`linear-gradient(135deg, ${C.sidebar} 0%, #1a3d6e 50%, ${C.secondary} 100%)`, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ width:'100%', maxWidth:420 }}>

        {/* Logo + titre */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src={logo} alt="Semence Epargne" style={{ width:120, marginBottom:16, filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}/>
          <h1 style={{ color:'#fff', fontSize:22, fontWeight:800, margin:'0 0 6px' }}>SEMENCE EPARGNE</h1>
          
        </div>

        {/* Carte login */}
        <div style={{ background:'#fff', borderRadius:20, padding:'28px 24px', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
          <h2 style={{ margin:'0 0 20px', fontSize:18, fontWeight:700, color:C.text }}>Connexion</h2>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>
                Email ou téléphone
              </label>
              <input value={identifiant} onChange={e => setIdentifiant(e.target.value)} required
                placeholder="email@semenceep.ci ou 07XXXXXXXX"
                style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit', color:C.text }}/>
            </div>

            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:C.text, marginBottom:5 }}>
                Mot de passe
              </label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{ width:'100%', border:`1.5px solid ${C.border}`, borderRadius:8, padding:'10px 12px', fontSize:14, outline:'none', boxSizing:'border-box', fontFamily:'inherit', color:C.text }}/>
            </div>

            {error && (
              <div style={{ background:C.redPale, color:C.red, borderRadius:8, padding:'10px 12px', fontSize:13, marginBottom:14 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width:'100%', background:loading?C.textMuted:`linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, color:'#fff', border:'none', borderRadius:10, padding:'13px', fontSize:15, fontWeight:700, cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', boxShadow:`0 4px 15px rgba(246,90,4,0.35)` }}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div style={{ marginTop:18, textAlign:'center', fontSize:12, color:C.textMuted }}>
            Assistance : <a href={`mailto:infos@semenceep.ci`} style={{ color:C.secondary, textDecoration:'none', fontWeight:600 }}>infos@semenceep.ci</a>
          </div>
        </div>

        {/* Footer */}

      </div>
    </div>
  );
}
