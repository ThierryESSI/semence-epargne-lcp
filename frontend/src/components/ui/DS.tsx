// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/components/ui/DS.tsx
// Design System — composants partagés LCP
import React, { useState } from 'react';
import { C, STATUS_STYLES } from '../../lib/design';
import { formatMontant } from '../../lib/utils';

// ─── SVG Icon ─────────────────────────────────────────────────────────────────
export const Icon = ({ d, size = 18, color = 'currentColor', strokeWidth = 2 }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const ICONS: Record<string, string> = {
  dashboard:    "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  clients:      "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75",
  distrib:      "M3 9h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M3 9l9-7 9 7",
  conseillers:  "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
  cartes:       "M1 10h22M1 6h22v2H1z M1 10v8a3 3 0 003 3h16a3 3 0 003-3v-8",
  transactions: "M7 16V4m0 0L3 8m4-4l4 4 M17 8v12m0 0l4-4m-4 4l-4-4",
  rapports:     "M18 20V10 M12 20V4 M6 20v-6",
  params:       "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  logout:       "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9",
  search:       "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  bell:         "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
  plus:         "M12 5v14M5 12h14",
  close:        "M18 6L6 18M6 6l12 12",
  eye:          "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z",
  trending:     "M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6",
  zap:          "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  leaf:         "M17 8C8 10 5.9 16.17 3.82 22 M9.2 21.23A20.04 20.04 0 0117 8",
  building:     "M3 21h18M9 21V3h6v18M3 7h6M15 7h6M3 14h6M15 14h6",
  phone:        "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 .99h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.64 8.2a16 16 0 006.29 6.29l1.28-1.57a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z",
  map:          "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 7a3 3 0 100 6 3 3 0 000-6z",
  percent:      "M19 5L5 19M9 6.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM15 17.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z",
  arrowUp:      "M12 19V5M5 12l7-7 7 7",
  arrowDown:    "M12 5v14M19 12l-7 7-7-7",
  check:        "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  wallet:       "M21 12V7H5a2 2 0 010-4h14v4 M3 5v14a2 2 0 002 2h16v-5 M18 12a2 2 0 000 4h3v-4z",
  refresh:      "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  send:         "M22 2L11 13 M22 2L15 22l-4-9-9-4 22-7z",
  download:     "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
  credit:       "M3 10h18M7 15h1m4 0h1M3 6h18a2 2 0 012 2v8a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2z",
  offline:      "M1 1l22 22M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01",
  trash:        "M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z",
};

// ─── Badge ────────────────────────────────────────────────────────────────────
export const Badge = ({ v }: { v: string }) => {
  const s = STATUS_STYLES[v?.toLowerCase()] || { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {v?.replace(/_/g, ' ')}
    </span>
  );
};

// ─── StatCard ─────────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, sub, icon, iconColor = C.green, trend }: any) => (
  <div style={{ background: C.white, borderRadius: 14, padding: '20px 22px', border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div style={{ flex: 1 }}>
        <div style={{ color: C.textMuted, fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{label}</div>
        <div style={{ color: C.text, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>
          {value ?? <span style={{ color: C.textLight, fontSize: 18 }}>—</span>}
        </div>
        {sub && <div style={{ color: C.textLight, fontSize: 12, marginTop: 4 }}>{sub}</div>}
        {trend && (
          <div style={{ color: C.green, fontSize: 12, fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Icon d={ICONS.arrowUp} size={12} color={C.green} />{trend}
          </div>
        )}
      </div>
      <div style={{ background: `${iconColor}18`, borderRadius: 10, padding: 10, color: iconColor, flexShrink: 0 }}>
        <Icon d={ICONS[icon] || ICONS.dashboard} size={20} color={iconColor} />
      </div>
    </div>
  </div>
);

// ─── Modal ────────────────────────────────────────────────────────────────────
export const Modal = ({ title, onClose, children, wide = false }: any) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
    <div style={{ background: C.white, borderRadius: 16, width: '100%', maxWidth: wide ? 700 : 520, boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'modalIn .2s ease', maxHeight: '90vh', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.white, zIndex: 1 }}>
        <h3 style={{ margin: 0, color: C.text, fontSize: 18, fontWeight: 700 }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, padding: 4, borderRadius: 6 }}>
          <Icon d={ICONS.close} size={18} />
        </button>
      </div>
      <div style={{ padding: '20px 24px' }}>{children}</div>
    </div>
  </div>
);

// ─── Form Field ───────────────────────────────────────────────────────────────
export const Field = ({ label, required, error, children, hint }: any) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    {label && (
      <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
        {label}{required && <span style={{ color: C.red }}> *</span>}
      </label>
    )}
    {children}
    {hint && <span style={{ fontSize: 11, color: C.textLight }}>{hint}</span>}
    {error && <span style={{ fontSize: 12, color: C.red }}>{error}</span>}
  </div>
);

const inputStyle = (err?: string) => ({
  border: `1.5px solid ${err ? C.red : C.border}`,
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 14,
  color: C.text,
  background: C.white,
  outline: 'none',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box' as const,
});

export const Input = ({ label, required, error, hint, ...props }: any) => (
  <Field label={label} required={required} error={error} hint={hint}>
    <input
      {...props}
      style={{ ...inputStyle(error), ...(props.style || {}), backgroundColor: props.disabled ? '#f8faf8' : C.white }}
      onFocus={e => { if (!props.disabled) e.target.style.borderColor = C.green; }}
      onBlur={e => { e.target.style.borderColor = error ? C.red : C.border; }}
    />
  </Field>
);

export const Select = ({ label, required, error, children, ...props }: any) => (
  <Field label={label} required={required} error={error}>
    <select {...props} style={{ ...inputStyle(error), cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7c6d' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
      {children}
    </select>
  </Field>
);

// ─── Button ───────────────────────────────────────────────────────────────────
export const Btn = ({ children, onClick, variant = 'primary', type = 'button', loading = false, disabled = false, style: s = {}, size = 'md' }: any) => {
  const variants: any = {
    primary:   { background: C.green, color: '#fff', border: 'none' },
    secondary: { background: 'transparent', color: C.green, border: `1.5px solid ${C.green}` },
    ghost:     { background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}` },
    danger:    { background: C.red, color: '#fff', border: 'none' },
  };
  const sizes: any = { sm: { padding: '6px 14px', fontSize: 13 }, md: { padding: '9px 18px', fontSize: 14 }, lg: { padding: '12px 24px', fontSize: 15 } };
  return (
    <button
      type={type} onClick={onClick} disabled={loading || disabled}
      style={{ ...variants[variant], ...sizes[size], borderRadius: 8, fontWeight: 600, cursor: disabled || loading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', opacity: disabled || loading ? 0.6 : 1, transition: 'all .15s', ...s }}
    >
      {loading ? <><span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} /> Chargement...</> : children}
    </button>
  );
};

// ─── Table ────────────────────────────────────────────────────────────────────
export const TableWrapper = ({ children }: any) => (
  <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>{children}</table>
    </div>
  </div>
);

export const THead = ({ cols }: { cols: string[] }) => (
  <thead>
    <tr style={{ background: '#f8faf8', borderBottom: `1.5px solid ${C.border}` }}>
      {cols.map(c => <th key={c} style={{ textAlign: 'left', padding: '12px 16px', color: C.textMuted, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{c}</th>)}
    </tr>
  </thead>
);

export const TR = ({ children, onClick }: any) => (
  <tr
    onClick={onClick}
    style={{ borderBottom: `1px solid ${C.borderLight}`, cursor: onClick ? 'pointer' : 'default', transition: 'background .1s' }}
    onMouseEnter={e => (e.currentTarget.style.background = '#f8faf8')}
    onMouseLeave={e => (e.currentTarget.style.background = '')}
  >
    {children}
  </tr>
);

export const TD = ({ children, mono = false, muted = false, bold = false, style: s = {} }: any) => (
  <td style={{ padding: '12px 16px', color: muted ? C.textMuted : C.text, fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? 12 : 14, fontWeight: bold ? 700 : 400, ...s }}>
    {children}
  </td>
);

// ─── Search bar ───────────────────────────────────────────────────────────────
export const SearchBar = ({ value, onChange, placeholder = 'Rechercher...' }: any) => (
  <div style={{ position: 'relative', maxWidth: 420 }}>
    <div style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
      <Icon d={ICONS.search} size={15} color={C.textMuted} />
    </div>
    <input
      value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', border: `1.5px solid ${C.border}`, borderRadius: 10, padding: '9px 12px 9px 35px', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: C.white, boxSizing: 'border-box' as const }}
      onFocus={e => e.target.style.borderColor = C.green}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  </div>
);

// ─── Page header ──────────────────────────────────────────────────────────────
export const PageHeader = ({ title, subtitle, action }: any) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: 0 }}>{title}</h1>
      {subtitle && <p style={{ color: C.textMuted, margin: '4px 0 0', fontSize: 14 }}>{subtitle}</p>}
    </div>
    {action && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{action}</div>}
  </div>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────
export const Spinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
    <div style={{ width: 32, height: 32, border: `3px solid ${C.greenPale}`, borderTopColor: C.green, borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
  </div>
);

// ─── Empty state ──────────────────────────────────────────────────────────────
export const Empty = ({ msg = 'Aucune donnée disponible' }: any) => (
  <div style={{ textAlign: 'center', padding: '48px 24px', color: C.textMuted }}>
    <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
    <p style={{ margin: 0, fontSize: 15 }}>{msg}</p>
  </div>
);

// ─── Alert box ────────────────────────────────────────────────────────────────
export const Alert = ({ type = 'info', children }: any) => {
  const styles: any = {
    info:    { bg: C.bluePale,   border: C.blue,  color: '#1e40af' },
    success: { bg: C.greenPale, border: C.green, color: C.green },
    error:   { bg: C.redPale,   border: C.red,   color: C.red   },
    warning: { bg: C.goldPale,  border: C.gold,  color: '#a16207' },
  };
  const s = styles[type];
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '10px 14px', color: s.color, fontSize: 14 }}>
      {children}
    </div>
  );
};

// ─── Pagination ───────────────────────────────────────────────────────────────
export const Pagination = ({ page, pages, onChange }: any) => {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 0', borderTop: `1px solid ${C.border}` }}>
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
        style={{ padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: C.white, color: C.text, fontSize: 13, opacity: page === 1 ? 0.4 : 1 }}>←</button>
      <span style={{ padding: '5px 12px', fontSize: 13, color: C.textMuted }}>Page {page} / {pages}</span>
      <button onClick={() => onChange(Math.min(pages, page + 1))} disabled={page === pages}
        style={{ padding: '5px 12px', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', background: C.white, color: C.text, fontSize: 13, opacity: page === pages ? 0.4 : 1 }}>→</button>
    </div>
  );
};

// ─── Section label ────────────────────────────────────────────────────────────
export const SectionLabel = ({ children }: any) => (
  <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '16px 0 10px' }}>
    {children}
  </div>
);

// ─── FormGrid ─────────────────────────────────────────────────────────────────
export const FormGrid = ({ children, cols = 2 }: any) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14, marginBottom: 14 }}>
    {children}
  </div>
);

// ─── Global styles ────────────────────────────────────────────────────────────
export const GlobalStyles = () => (
  <style>{`
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes modalIn { from { opacity:0; transform:scale(.97) translateY(-8px); } to { opacity:1; transform:scale(1) translateY(0); } }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    ::-webkit-scrollbar { width:5px; height:5px; }
    ::-webkit-scrollbar-track { background:transparent; }
    ::-webkit-scrollbar-thumb { background:#3a5a3c; border-radius:3px; }
    input::placeholder, textarea::placeholder { color: #9aaa9b; }
    select option { background: white; color: #1a2e1c; }
  `}</style>
);
