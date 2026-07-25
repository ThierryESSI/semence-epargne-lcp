// ============================================================
// SEMENCE ÉPARGNE v6 — Le Crédit Panafricain (LCP)
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
// Contact : +225 07 47 19 67 84 | facebook.com/EasyGestion225
// PROPRIÉTÉ INTELLECTUELLE — Toute reproduction interdite sans
// autorisation écrite. Voir fichier LICENSE.md à la racine.
// ============================================================
// frontend/src/components/ui/index.tsx
import { statusColor } from '../../lib/utils';

// ─── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 ${className}`}>{children}</div>;
}

// ─── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ statut }: { statut: string }) {
  const map: Record<string, string> = {
    ACTIF: 'bg-green-100 text-green-800', EN_ATTENTE: 'bg-yellow-100 text-yellow-800',
    SUSPENDU: 'bg-red-100 text-red-800', CLOTURE: 'bg-gray-100 text-gray-800',
    SUCCES: 'bg-green-100 text-green-800', EN_COURS: 'bg-blue-100 text-blue-800',
    ECHEC: 'bg-red-100 text-red-800', DISPONIBLE: 'bg-green-100 text-green-800',
    VENDUE: 'bg-blue-100 text-blue-800', UTILISEE: 'bg-gray-100 text-gray-800',
    ANNULEE: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[statut] || 'bg-gray-100 text-gray-700'}`}>
      {statut.replace(/_/g, ' ')}
    </span>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon, color = 'blue', sub }: {
  label: string; value: string | number; icon?: React.ReactNode; color?: string; sub?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600', purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        {icon && <div className={`p-3 rounded-xl ${colors[color]}`}>{icon}</div>}
      </div>
    </Card>
  );
}

// ─── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        {subtitle && <p className="text-gray-500 text-sm mt-1">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ─── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="w-8 h-8 border-4 border-[#1B4F8A] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ message = 'Aucune donnée disponible' }: { message?: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <div className="text-5xl mb-3">📭</div>
      <p>{message}</p>
    </div>
  );
}

// ─── AlertBox ─────────────────────────────────────────────────────────────────
export function AlertBox({ type = 'info', message }: { type?: 'info' | 'success' | 'error' | 'warning'; message: string }) {
  const styles = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  };
  return <div className={`border rounded-lg px-4 py-3 text-sm ${styles[type]}`}>{message}</div>;
}

// ─── Input ─────────────────────────────────────────────────────────────────────
export function Input({ label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        {...props}
        className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A] ${
          error ? 'border-red-400' : 'border-gray-300'
        } ${props.className || ''}`}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ─── Select ────────────────────────────────────────────────────────────────────
export function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select
        {...props}
        className={`w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F8A] bg-white ${props.className || ''}`}
      >
        {children}
      </select>
    </div>
  );
}

// ─── Button ────────────────────────────────────────────────────────────────────
export function Button({ children, variant = 'primary', loading = false, ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger'; loading?: boolean }) {
  const styles = {
    primary:   'bg-[#1B4F8A] text-white hover:bg-blue-800',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger:    'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${styles[variant]} ${props.className || ''}`}
    >
      {loading ? 'Chargement...' : children}
    </button>
  );
}
