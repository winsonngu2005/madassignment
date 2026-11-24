import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import AdminLayout from './layouts/AdminLayout';
import LoginPage from './pages/LoginPage';
import StatisticsPage from './pages/StatisticsPage';
import StaffZonesPage from './pages/StaffZonesPage';
import TestDataPage from './pages/TestDataPage';
import TicketDetailPage from './pages/TicketDetailPage';
import TicketsPage from './pages/TicketsPage';

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="/tickets" replace />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="statistics" element={<StatisticsPage />} />
        <Route path="testing" element={<TestDataPage />} />
        <Route path="zones" element={<StaffZonesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/tickets" replace />} />
    </Routes>
  );
}
