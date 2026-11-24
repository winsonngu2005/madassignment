import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="shell">
      <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
        <button
          className="sidebar__toggle"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <i className={`fa-solid ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`} aria-hidden="true" />
        </button>

        <div className="sidebar__body">
          <div className="sidebar__brand">
            <span className="brand-mini">C</span>
            <span className="brand-label">
              CST Admin
              <small>Community Service Tracking</small>
            </span>
          </div>

          <nav className="sidebar__nav">
            <NavLink
              to="/tickets"
              className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
              title="Ticket Pool"
            >
              <i className="fa-regular fa-rectangle-list" aria-hidden="true" />
              <span className="label">Ticket Pool</span>
            </NavLink>
            <NavLink
              to="/statistics"
              className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
              title="Statistics"
            >
              <i className="fa-solid fa-chart-simple" aria-hidden="true" />
              <span className="label">Statistics</span>
            </NavLink>
            <NavLink
              to="/zones"
              className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
              title="Staff Zones"
            >
              <i className="fa-solid fa-location-crosshairs" aria-hidden="true" />
              <span className="label">Staff Zones</span>
            </NavLink>
            <NavLink
              to="/testing"
              className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
              title="Test Data"
            >
              <i className="fa-solid fa-flask" aria-hidden="true" />
              <span className="label">Test Data</span>
            </NavLink>
          </nav>

          <div className="sidebar__foot">
            <div className="who">
              <i className="fa-solid fa-circle-user" aria-hidden="true" />
              {user?.name}
            </div>
            <button
              className="btn btn--sm"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Sign out"
            >
              <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
              <span className="label">Sign out</span>
            </button>
          </div>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
