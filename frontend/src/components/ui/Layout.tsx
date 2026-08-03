// frontend/src/components/ui/Layout.tsx
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../lib/store';
import { C } from '../../lib/design';
import { GlobalStyles } from './DS';
import logo from '../../assets/logo.png';

const NAV_ADMIN = [
  { to:'/admin',                label:'Tableau de bord',   icon:'◉' },
  { to:'/admin/clients',        label:'Clients',           icon:'◎' },
  { to:'/admin/distributeurs',  label:'Distributeurs',     icon:'◈' },
  { to:'/admin/conseillers',    label:'Conseillers',       icon:'◇' },
  { to:'/admin/cartes',         label:'Cartes Semence',    icon:'▣' },
  { to:'/admin/transactions',   label:'Transactions',      icon:'⇄' },
  { to:'/admin/epargne-plans',  label:'Plans Epargne',     icon:'◈' },
  { to:'/admin/chat',           label:'Messagerie',        icon:'◎' },
  { to:'/admin/ia',             label:'Analyse IA',        icon:'◆' },
  { to:'/admin/galerie',        label:'Galerie photos',    icon:'▢' },
  { to:'/admin/recharges-sms',  label:'Recharges SMS',     icon:'◎' },
  { to:'/admin/admins',         label:'Gestion Admins',    icon:'◉' },
  { to:'/admin/rapports',       label:'Rapports',          icon:'▦' },
  { to:'/admin/parametres',     label:'Parametres',        icon:'◌' },
];

const NAV_CLIENT = [
  { to:'/client',               label:'Mon compte',        icon:'◉' },
  { to:'/client/epargne',       label:'Mon Epargne',       icon:'◈' },
  { to:'/client/virement',      label:'Virement',          icon:'⇄' },
  { to:'/client/activer-carte', label:'Activer une carte', icon:'▣' },
  { to:'/client/transactions',  label:'Historique',        icon:'▦' },
  { to:'/client/chat',          label:'Messagerie',        icon:'◎' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const isClient = user?.role === 'CLIENT';
  const NAV      = isClient ? NAV_CLIENT : NAV_ADMIN;
  const initials = user ? `${user.prenom?.[0]||''}${user.nom?.[0]||''}`.toUpperCase() : '?';
  const fullName = user ? `${user.prenom} ${user.nom}` : '';

  return (
    <div style={{ display:'flex', height:'100vh', background:C.bg, overflow:'hidden' }}>
      <GlobalStyles />

      {/* Sidebar */}
      <aside style={{ width:collapsed?60:248, background:C.sidebar, display:'flex', flexDirection:'column', transition:'width .2s ease', flexShrink:0, overflow:'hidden' }}>

        {/* Logo */}
        <div style={{ padding:'14px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', gap:10, minHeight:60 }}>
          <img src={logo} alt="Logo" style={{ width:collapsed?34:38, height:'auto', flexShrink:0, transition:'width .2s' }}/>
          {!collapsed && (
            <div>
              <div style={{ color:'#fff', fontWeight:800, fontSize:13, letterSpacing:'0.04em', lineHeight:1.2 }}>SEMENCE</div>
              <div style={{ color:C.primary, fontWeight:700, fontSize:10, letterSpacing:'.1em' }}>EPARGNE</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav style={{ flex:1, padding:'8px 6px', overflowY:'auto', overflowX:'hidden' }}>
          {NAV.map(item => {
            const active = location.pathname === item.to ||
              (item.to !== '/admin' && item.to !== '/client' && location.pathname.startsWith(item.to));
            return (
              <NavLink key={item.to} to={item.to} end={item.to==='/admin'||item.to==='/client'}
                title={collapsed ? item.label : undefined}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 11px', borderRadius:8, textDecoration:'none', marginBottom:2,
                  fontWeight:active?700:400, fontSize:13, transition:'all .15s', whiteSpace:'nowrap',
                  background:active?C.activeBg:'transparent',
                  color:active?C.activeText:C.sidebarText,
                  borderLeft:active?`3px solid ${C.primary}`:'3px solid transparent',
                }}
                onMouseEnter={e => { if(!active)(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { if(!active)(e.currentTarget as HTMLElement).style.background='transparent'; }}
              >
                <span style={{ fontSize:14, flexShrink:0, color:active?C.primary:C.sidebarText }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer sidebar */}
        <div style={{ padding:'8px 6px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={logout}
            style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'9px 11px', borderRadius:8, border:'none', cursor:'pointer', background:'transparent', color:C.sidebarText, fontFamily:'inherit', fontSize:13, whiteSpace:'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.color='#fff'}
            onMouseLeave={e => e.currentTarget.style.color=C.sidebarText}>
            <span>⏻</span>{!collapsed && 'Deconnexion'}
          </button>
          <button onClick={() => setCollapsed(c => !c)}
            style={{ display:'flex', alignItems:'center', justifyContent:'center', width:'100%', padding:'7px', borderRadius:8, border:'none', cursor:'pointer', background:'transparent', color:C.sidebarText, fontSize:16, marginTop:2 }}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Topbar */}
        <header style={{ background:C.white, borderBottom:`1px solid ${C.border}`, padding:'0 22px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, color:C.textMuted, fontSize:13 }}>
            <span>⊕</span>
            <input placeholder="Rechercher..." style={{ border:'none', outline:'none', fontSize:13, color:C.text, background:'transparent', fontFamily:'inherit', width:200 }}/>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {/* Lien WhatsApp support */}
            <a href={`https://wa.me/${C.whatsapp.replace('+','')}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize:11, color:C.secondary, textDecoration:'none', fontWeight:600, padding:'4px 10px', background:C.secondaryPl, borderRadius:20 }}>
              Support
            </a>
            <div style={{ position:'relative', cursor:'pointer' }}>
              <span style={{ fontSize:18, color:C.textMuted }}>◉</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:32, height:32, background:`linear-gradient(135deg,${C.primary},${C.primaryDark})`, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:12, flexShrink:0 }}>
                {initials}
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:C.text, lineHeight:1.2 }}>{fullName}</div>
                <div style={{ fontSize:10, color:C.textMuted }}>{user?.role?.toLowerCase().replace(/_/g,' ')}</div>
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
