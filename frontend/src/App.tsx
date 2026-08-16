// frontend/src/App.tsx
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';
import Layout from './components/ui/Layout';
import { Spinner } from './components/ui/DS';

const HomePage = lazy(() => import('./pages/public/HomePage'));
const UnarciPage = lazy(() => import('./pages/public/UnarciPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminClients = lazy(() => import('./pages/admin/Clients'));
const AdminDistributeurs = lazy(() => import('./pages/admin/Distributeurs'));
const AdminConseillers = lazy(() => import('./pages/admin/Conseillers'));
const AdminCartes = lazy(() => import('./pages/admin/Cartes'));
const AdminTransactions = lazy(() => import('./pages/admin/Transactions'));
const AdminRapports = lazy(() => import('./pages/admin/Rapports'));
const AdminParametres = lazy(() => import('./pages/admin/Parametres'));
const EpargnePlans = lazy(() => import('./pages/admin/EpargnePlans'));
const GestionAdmins = lazy(() => import('./pages/admin/GestionAdmins'));
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const ClientTransactions = lazy(() => import('./pages/client/ClientTransactions'));
const ClientRapports = lazy(() => import('./pages/client/ClientRapports'));
const EpargnePage = lazy(() => import('./pages/client/EpargnePage'));
const VirementPage = lazy(() => import('./pages/client/VirementPage'));
const ActivationCartePage = lazy(() => import('./pages/client/ActivationCartePage'));
const OfflinePage = lazy(() => import('./pages/OfflinePage'));
const IArapports = lazy(() => import('./pages/admin/IArapports'));
const Chat       = lazy(() => import('./pages/admin/Chat'));
const Galerie    = lazy(() => import('./pages/admin/Galerie'));
const ClientChat = lazy(() => import('./pages/client/ClientChat'));
const UnarciAgency = lazy(() => import('./pages/admin/UnarciAgency'));
const RechargesSMS = lazy(() => import('./pages/admin/RechargesSMS'));

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
const IA_ACCES = ['SUPER_ADMIN','MASTER','DISTRIBUTEUR_INTERNE'];

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
      <Routes>
        {/* Page publique */}
        <Route path="/"      element={<HomePage />} />
        <Route path="/unarci" element={<UnarciPage />} />
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
          <Route path="ia"            element={<Protected roles={IA_ACCES}><IArapports /></Protected>} />
          <Route path="chat"          element={<Chat />} />
          <Route path="galerie"       element={<Protected roles={['SUPER_ADMIN','MASTER']}><Galerie /></Protected>} />
          <Route path="admins"        element={<Protected roles={['SUPER_ADMIN','MASTER']}><GestionAdmins /></Protected>} />
          <Route path="unarci"        element={<Protected roles={['SUPER_ADMIN','MASTER','DISTRIBUTEUR_AGREE','DISTRIBUTEUR_INTERNE']}><UnarciAgency /></Protected>} />
          <Route path="recharges-sms"  element={<Protected roles={['SUPER_ADMIN','MASTER']}><RechargesSMS /></Protected>} />
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
          <Route path="chat"            element={<ClientChat />} />
          <Route path="offline"         element={<OfflinePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
