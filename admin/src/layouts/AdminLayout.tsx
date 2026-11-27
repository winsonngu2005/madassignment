import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import type { DutyStatus } from '../models';
import { toast } from '../util';
import SandboxPanel from '../pages/SandboxPanel';

export default function AdminLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [unassigned, setUnassigned] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [dutyStatus, setDutyStatus] = useState<DutyStatus>(user?.duty_status ?? 'on_duty');
  const [sandbox, setSandbox] = useState(localStorage.getItem('myhanns_sandbox_mode') === 'on');

  useEffect(() => { setDutyStatus(user?.duty_status ?? 'on_duty'); }, [user?.id, user?.duty_status]);

  const toggleDuty = async () => {
    if (sandbox) return;
    if (!user) return;
    const next: DutyStatus = dutyStatus === 'on_duty' ? 'off_duty' : 'on_duty';
    try {
      const updated = await api.updateDutyStatus(user.id, next);
      setDutyStatus(updated.duty_status ?? next);
      toast(next === 'on_duty' ? 'You are now On Duty.' : 'You are now Off Duty.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not update duty status.', 'err');
    }
  };

  const refreshBadges = useCallback(() => {
    void api
      .listTickets({ scope: 'unassigned' })
      .then((tickets) => setUnassigned(tickets.length))
      .catch(() => undefined);
    if (isAdmin) {
      void api
        .listRequests()
        .then((list) => setPendingRequests(list.length))
        .catch(() => undefined);
    }
  }, [isAdmin]);

  // refresh badge counts on mount and whenever the route changes
  // (every completed action re-renders the outlet and re-triggers this)
  useEffect(() => {
    refreshBadges();
  }, [refreshBadges, location.pathname, location.search]);

  // keep badges fresh without a reload
  useEffect(() => {
    const id = window.setInterval(refreshBadges, 2_000);
    return () => window.clearInterval(id);
  }, [refreshBadges]);

  const isStaff = user?.role === 'staff';

  const toggleSandbox = (enabled: boolean) => {
    setSandbox(enabled);
    localStorage.setItem('myhanns_sandbox_mode', enabled ? 'on' : 'off');
    window.dispatchEvent(new Event('myhanns-sandbox-change'));
  };

  return (
    <div className={`shell${sandbox ? ' sandbox-mode' : ''}`}>
      <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
        <div className="sidebar__body">
          <button className="sidebar__toggle" onClick={() => setCollapsed((c) => !c)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}><i className="fa-solid fa-bars" aria-hidden="true" /></button>
          <div className="sidebar__brand">
            <span className="brand-logo-wrap"><img className="brand-logo" src="images/logo.png" alt="" /></span>
            <span className="brand-label">
              MyHanns
              <small>Web Admin Panel</small>
            </span>
          </div>

          <nav className="sidebar__nav">
            <NavLink to="/statistics" className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`} title={isAdmin ? 'Dashboard' : 'Statistics'}><i className="fa-solid fa-chart-simple" aria-hidden="true" /><span className="label">{isAdmin ? 'Dashboard' : 'Statistics'}</span></NavLink>
            <NavLink
              to="/tickets"
              className={({ isActive }) => `sidebar__link${isActive && location.search !== '?scope=unassigned' ? ' is-active' : ''}`}
              title="Ticket Pool"
            >
              <i className="fa-regular fa-rectangle-list" aria-hidden="true" />
              <span className="label">Ticket Pool</span>
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/tickets?scope=unassigned"
                className={({ isActive }) => `sidebar__link${isActive && location.search === '?scope=unassigned' ? ' is-active' : ''}`}
                title="Unassigned tasks"
              >
                <i className="fa-solid fa-user-slash" aria-hidden="true" />
                <span className="label">Unassigned</span>
                <span className="nav-badge" title={`${unassigned} unassigned tickets`}>
                  {unassigned}
                </span>
              </NavLink>
            )}

            <NavLink
              to="/zones"
              className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
              title="Staff Zones"
            >
              <i className="fa-solid fa-location-crosshairs" aria-hidden="true" />
              <span className="label">{isStaff ? 'My Zones' : 'Staff Zones'}</span>
            </NavLink>

            {isAdmin && (
              <>
                <NavLink
                  to="/requests"
                  className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
                  title="Staff requests"
                >
                  <i className="fa-regular fa-bell" aria-hidden="true" />
                  <span className="label">Requests</span>
                  {pendingRequests > 0 && (
                    <span className="nav-badge" title={`${pendingRequests} pending staff requests`}>
                      {pendingRequests}
                    </span>
                  )}
                </NavLink>
              </>
            )}
          </nav>

          <div className="sidebar__foot">
            {/* profile row + sign out row, aligned as two stacked rows */}
            <div className="who">
              <i className="fa-solid fa-circle-user" aria-hidden="true" />
              <span className="who__name">{user?.name}</span>
            </div>
            {isAdmin && <button className="btn btn--sm sidebar-action" onClick={() => toggleSandbox(!sandbox)}><i className="fa-solid fa-flask"/><span className="label">{sandbox ? 'Exit Sandbox' : 'Sandbox Mode'}</span></button>}
            <button className={`duty-switch sidebar-action${dutyStatus === 'on_duty' ? ' is-on' : ''}`} disabled={sandbox} onClick={() => void toggleDuty()} title="Change duty availability">
              <i className="fa-solid fa-rotate" aria-hidden="true" />
              <span className="label">{dutyStatus === 'on_duty' ? 'On Duty' : 'Off Duty'}</span>
            </button>
            <button
              className="btn btn--sm sidebar-action"
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
        {sandbox ? <SandboxPanel onExit={() => toggleSandbox(false)} /> : <Outlet />}
      </main>
    </div>
  );
}
