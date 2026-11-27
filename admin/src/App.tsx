import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import RequestsPage from './pages/RequestsPage';
import StatisticsPage from './pages/StatisticsPage';
import StaffZonesPage from './pages/StaffZonesPage';
import TicketDetailPage from './pages/TicketDetailPage';
import TicketsPage from './pages/TicketsPage';

function RequireLogin({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/tickets" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireLogin>
            <AdminLayout />
          </RequireLogin>
        }
      >
        <Route index element={<Navigate to="/tickets" replace />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="statistics" element={<StatisticsPage />} />
        <Route path="zones" element={<StaffZonesPage />} />
        <Route
          path="requests"
          element={
            <RequireAdmin>
              <RequestsPage />
            </RequireAdmin>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/tickets" replace />} />
    </Routes>
  );
}
