// frontend/src/App.tsx
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';
import HomePage            from './pages/public/HomePage';
import LoginPage           from './pages/auth/LoginPage';
import Layout              from './components/ui/Layout';
import AdminDashboard      from './pages/admin/Dashboard';
import AdminClients        from './pages/admin/Clients';
import AdminDistributeurs  from './pages/admin/Distributeurs';
import AdminConseillers    from './pages/admin/Conseillers';
import AdminCartes         from './pages/admin/Cartes';
import AdminTransactions   from './pages/admin/Transactions';
import AdminRapports       from './pages/admin/Rapports';
import AdminParametres     from './pages/admin/Parametres';
import EpargnePlans        from './pages/admin/EpargnePlans';
import GestionAdmins       from './pages/admin/GestionAdmins';
import ClientDashboard     from './pages/client/ClientDashboard';
import ClientTransactions  from './pages/client/ClientTransactions';
import ClientRapports      from './pages/client/ClientRapports';
import EpargnePage         from './pages/client/EpargnePage';
import VirementPage        from './pages/client/VirementPage';
import ActivationCartePage from './pages/client/ActivationCartePage';
import OfflinePage         from './pages/OfflinePage';

const ROLE_HOME: Record<string,string> = {
  SUPER_ADMIN:'/admin', MASTER:'/admin',
  DISTRIBUTEUR_INTERNE:'/admin', DISTRIBUTEUR_AGREE:'/admin',
  CONSEILLER:'/admin', CLIENT:'/client',
};

function HomeRedirect() {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
}

function Protected({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

const ADMIN = ['SUPER_ADMIN','MASTER','DISTRIBUTEUR_INTERNE','DISTRIBUTEUR_AGREE','CONSEILLER'];

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Page publique */}
        <Route path="/"      element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app"   element={<HomeRedirect />} />

        {/* Admin */}
        <Route path="/admin" element={<Protected roles={ADMIN}><Layout /></Protected>}>
          <Route index                element={<AdminDashboard />} />
          <Route path="clients"       element={<AdminClients />} />
          <Route path="distributeurs" element={<AdminDistributeurs />} />
          <Route path="conseillers"   element={<AdminConseillers />} />
          <Route path="cartes"        element={<AdminCartes />} />
          <Route path="transactions"  element={<AdminTransactions />} />
          <Route path="epargne-plans" element={<EpargnePlans />} />
          <Route path="rapports"      element={<AdminRapports />} />
          <Route path="parametres"    element={<AdminParametres />} />
          <Route path="admins"        element={<Protected roles={['SUPER_ADMIN','MASTER']}><GestionAdmins /></Protected>} />
          <Route path="offline"       element={<OfflinePage />} />
        </Route>

        {/* Client */}
        <Route path="/client" element={<Protected roles={['CLIENT']}><Layout /></Protected>}>
          <Route index                  element={<ClientDashboard />} />
          <Route path="epargne"         element={<EpargnePage />} />
          <Route path="virement"        element={<VirementPage />} />
          <Route path="activer-carte"   element={<ActivationCartePage />} />
          <Route path="transactions"    element={<ClientTransactions />} />
          <Route path="rapports"        element={<ClientRapports />} />
          <Route path="offline"         element={<OfflinePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
