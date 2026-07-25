// frontend/src/pages/public/HomePage.tsx
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import logo from '../../assets/logo.png';

const DEFAULT_CONFIG: Record<string,string> = {
  SITE_NOM:          'Semence Epargne',
  SITE_SLOGAN:       'Epargner aujourd\'hui pour un avenir meilleur',
  SITE_DESCRIPTION:  'Activez vos cartes Semence, constituez votre epargne et touchez vos bonus. Accessible depuis tout telephone, meme en zone rurale.',
  SITE_TEL:          '+225 27 35 96 05 99',
  SITE_EMAIL:        'infos@semenceep.ci',
  SITE_WHATSAPP:     '+2250708249583',
  SITE_ADRESSE:      'COCODY les OSCARS Bd Latrille, Abidjan',
  SITE_COULEUR_PRIMAIRE:   '#F65A04',
  SITE_COULEUR_SECONDAIRE: '#1C5B9B',
};

export default function HomePage() {
  const navigate   = useNavigate();
  const [cfg, setCfg] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    api.get('/site-config/public').then(r => setCfg({ ...DEFAULT_CONFIG, ...r.data.data })).catch(() => {});
  }, []);

  const PRI = cfg.SITE_COULEUR_PRIMAIRE;
  const SEC = cfg.SITE_COULEUR_SECONDAIRE;

  return (
    <div style={{ fontFamily:"'Segoe UI',system-ui,sans-serif", color:'#0F2E52', lineHeight:1.6 }}>

      {/* NAVBAR */}
      <nav style={{ background:'#fff', borderBottom:'1px solid #dde6f0', padding:'0 5%', height:64, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100, boxShadow:'0 1px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src={cfg.SITE_LOGO_URL && cfg.SITE_LOGO_URL !== '/logo.png' ? cfg.SITE_LOGO_URL : logo} alt="Logo" style={{ height:38 }}/>
          <span style={{ fontWeight:800, fontSize:16, color:'#0F2E52' }}>{cfg.SITE_NOM}</span>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => navigate('/login')}
            style={{ background:'transparent', color:SEC, border:`1.5px solid ${SEC}`, borderRadius:8, padding:'7px 18px', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            Connexion
          </button>
          <a href={`https://wa.me/${cfg.SITE_WHATSAPP?.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
            style={{ background:PRI, color:'#fff', border:'none', borderRadius:8, padding:'7px 18px', fontSize:13, fontWeight:600, cursor:'pointer', textDecoration:'none' }}>
            Nous contacter
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background:`linear-gradient(135deg, #0F2E52 0%, ${SEC} 60%, ${PRI} 100%)`, padding:'80px 5% 80px', display:'flex', alignItems:'center', gap:60, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:280 }}>
          <div style={{ background:'rgba(255,255,255,0.15)', color:'#fff', borderRadius:20, padding:'3px 12px', fontSize:12, fontWeight:600, display:'inline-block', marginBottom:16 }}>
            Le Credit Panafricain — LCP
          </div>
          <h1 style={{ color:'#fff', fontSize:36, fontWeight:900, margin:'0 0 16px', lineHeight:1.2 }}>{cfg.SITE_SLOGAN}</h1>
          <p style={{ color:'rgba(255,255,255,0.8)', fontSize:15, marginBottom:32 }}>{cfg.SITE_DESCRIPTION}</p>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <button onClick={() => navigate('/login')}
              style={{ background:PRI, color:'#fff', border:'none', borderRadius:10, padding:'13px 28px', fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:`0 4px 20px rgba(246,90,4,0.4)` }}>
              Acceder a mon compte
            </button>
            <a href={`https://wa.me/${cfg.SITE_WHATSAPP?.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
              style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'1.5px solid rgba(255,255,255,0.4)', borderRadius:10, padding:'13px 28px', fontSize:15, fontWeight:600, cursor:'pointer', textDecoration:'none' }}>
              WhatsApp
            </a>
          </div>
        </div>
        <div style={{ flex:'0 0 auto' }}>
          <img src={cfg.SITE_LOGO_URL && cfg.SITE_LOGO_URL !== '/logo.png' ? cfg.SITE_LOGO_URL : logo}
            alt={cfg.SITE_NOM} style={{ width:200, filter:'drop-shadow(0 10px 30px rgba(0,0,0,0.4))' }}/>
        </div>
      </section>

      {/* SERVICES */}
      <section style={{ padding:'60px 5%', background:'#f4f7fb' }}>
        <h2 style={{ textAlign:'center', fontSize:26, fontWeight:800, marginBottom:40 }}>Nos services</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:20 }}>
          {[
            { icon:'💳', titre:'Cartes Semence Epargne', desc:'Achetez une carte, activez-la et constituez votre epargne. Bonus jusqu\'a 17% apres 12 mois.' },
            { icon:'💸', titre:'Virements internes LCP', desc:'Transferez des fonds instantanement entre comptes LCP, sans frais, avec confirmation par SMS.' },
            { icon:'📡', titre:'Recharge par SMS', desc:'Pas de smartphone? Envoyez un SMS et votre compte est credite automatiquement, meme en zone rurale.' },
            { icon:'🔐', titre:'Securite maximale', desc:'Verification par code OTP, verrou anti-double-activation, audit complet de chaque transaction.' },
          ].map(s => (
            <div key={s.titre} style={{ background:'#fff', borderRadius:14, padding:24, border:'1px solid #dde6f0', boxShadow:'0 2px 12px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>{s.icon}</div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:8, color:'#0F2E52' }}>{s.titre}</div>
              <div style={{ fontSize:13, color:'#5a7a9a' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PLANS EPARGNE */}
      <section style={{ padding:'60px 5%', background:'#fff' }}>
        <h2 style={{ textAlign:'center', fontSize:26, fontWeight:800, marginBottom:40 }}>Plans d\'epargne</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:20 }}>
          {[
            { palier:'3 mois',  bonus:'3,5%', versements:'2', color:PRI },
            { palier:'6 mois',  bonus:'8%',   versements:'3', color:SEC },
            { palier:'12 mois', bonus:'17%',  versements:'6', color:'#0F2E52' },
          ].map(p => (
            <div key={p.palier} style={{ background:p.color, color:'#fff', borderRadius:16, padding:'28px 20px', textAlign:'center' }}>
              <div style={{ fontSize:36, fontWeight:900, marginBottom:8 }}>{p.bonus}</div>
              <div style={{ fontWeight:700, fontSize:18, marginBottom:8 }}>Plan {p.palier}</div>
              <div style={{ opacity:0.8, fontSize:13 }}>{p.versements} versements minimum</div>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT */}
      <section style={{ padding:'60px 5%', background:`linear-gradient(135deg, #0F2E52, ${SEC})`, color:'#fff' }}>
        <h2 style={{ textAlign:'center', fontSize:26, fontWeight:800, marginBottom:40 }}>Nous contacter</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:20, maxWidth:800, margin:'0 auto' }}>
          {[
            { label:'Telephone', val:cfg.SITE_TEL, href:`tel:${cfg.SITE_TEL}` },
            { label:'Email', val:cfg.SITE_EMAIL, href:`mailto:${cfg.SITE_EMAIL}` },
            { label:'WhatsApp', val:cfg.SITE_WHATSAPP, href:`https://wa.me/${cfg.SITE_WHATSAPP?.replace(/\D/g,'')}` },
            { label:'Adresse', val:cfg.SITE_ADRESSE, href:'#' },
          ].map(c => (
            <a key={c.label} href={c.href} target={c.href.startsWith('http')?'_blank':'_self'} rel="noopener noreferrer"
              style={{ background:'rgba(255,255,255,0.1)', borderRadius:12, padding:20, textDecoration:'none', color:'#fff' }}>
              <div style={{ fontSize:12, opacity:0.7, marginBottom:6 }}>{c.label}</div>
              <div style={{ fontWeight:600, fontSize:14 }}>{c.val}</div>
            </a>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background:'#060e17', color:'rgba(255,255,255,0.5)', padding:'24px 5%', textAlign:'center', fontSize:12 }}>
        <p style={{ margin:'0 0 6px' }}>© 2024-{new Date().getFullYear()} Le Credit Panafricain (LCP) · RC CI-ABJ-2016-B 6706</p>
        <p style={{ margin:0 }}>Developpe par <strong style={{ color:'rgba(255,255,255,0.7)' }}>MaGestion Facile</strong> — M. Thierry ESSI · +225 07 47 19 67 84 · facebook.com/EasyGestion225</p>
      </footer>
    </div>
  );
}
