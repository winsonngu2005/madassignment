import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import Dropdown from '../components/Dropdown';
import PriorityTag from '../components/PriorityTag';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../auth';
import type { AssignPayload, Category, Priority, Ticket, TicketStatus, User, Zone } from '../models';
import { dueLabel, toast } from '../util';

const STATUS_OPTIONS: (TicketStatus | '')[] = [
  '',
  'pending',
  'accepted',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
];

type SortKey = 'priority' | 'newest' | 'due';

const PRIORITY_RANK: Record<string, number> = { urgent: 3, normal: 2, low: 1 };

export default function TicketsPage() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [params] = useSearchParams();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [category, setCategory] = useState<number | ''>('');
  const [zone, setZone] = useState<Zone | ''>('');
  const [assignee, setAssignee] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('priority');
  const [assigningTicketId, setAssigningTicketId] = useState<number | null>(null);
  const [pinnedTicketId, setPinnedTicketId] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem('myhanns_last_unassigned_ticket'));
    return Number.isFinite(saved) && saved > 0 ? saved : null;
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [staff, setStaff] = useState<User[]>([]);

  // deep link support: /tickets?scope=unassigned from the sidebar badge
  const scope = params.get('scope') === 'unassigned' ? ('unassigned' as const) : undefined;

  useEffect(() => {
    api
      .listCategories()
      .then((list) => setCategories(list as Category[]))
      .catch(() => undefined);
    if (isAdmin) {
      api
        .listStaff()
        .then((list) => setStaff(list as User[]))
        .catch(() => undefined);
    }
  }, [isAdmin]);

  const hasFilters = Boolean(status || priority || category || zone || assignee || search.trim());
  useEffect(() => {
    if (scope !== 'unassigned' || hasFilters) {
      setPinnedTicketId(null);
      localStorage.removeItem('myhanns_last_unassigned_ticket');
    }
  }, [scope, hasFilters]);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      setTickets(
        await api.listTickets({
          status,
          priority,
          category_id: category || undefined,
          zone: zone || undefined,
          assignee_id: assignee || undefined,
          search: search.trim(),
          scope,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [status, priority, category, zone, assignee, search, scope]);

  // debounce search
  useEffect(() => {
    const id = window.setTimeout(() => {
      void reload();
    }, 250);
    return () => window.clearTimeout(id);
  }, [reload]);

  // Keep staff ticket offers current while the pool is open (mock equivalent
  // of the backend push notification channel).
  useEffect(() => {
    if (isAdmin) return;
    const timer = window.setInterval(() => { void reload(true); }, 8000);
    return () => window.clearInterval(timer);
  }, [isAdmin, reload]);

  const sorted = useMemo(() => {
    const list = [...tickets];
    if (sort === 'newest') list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else if (sort === 'due') list.sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'));
    else list.sort((a, b) => {
      const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      return pr || b.created_at.localeCompare(a.created_at);
    });
    if (scope === 'unassigned' && !hasFilters && pinnedTicketId !== null) {
      const index = list.findIndex((ticket) => ticket.id === pinnedTicketId);
      if (index > 0) list.unshift(...list.splice(index, 1));
    }
    return list;
  }, [tickets, sort, scope, hasFilters, pinnedTicketId]);

  const assignFromPool = async (ticket: Ticket, staffId: number) => {
    const member = staff.find((person) => person.id === staffId);
    if (!member) return;
    const dueAt = ticket.due_at ?? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const payload: AssignPayload = { assignee_id: member.id, priority: ticket.priority, due_at: dueAt, note: 'Assigned from Unassigned Ticket Pool.' };
    try {
      await api.assignTicket(ticket.id, payload);
      setAssigningTicketId(null);
      if (pinnedTicketId === ticket.id) {
        setPinnedTicketId(null);
        localStorage.removeItem('myhanns_last_unassigned_ticket');
      }
      await reload(true);
      toast(`Assigned to ${member.name}.`);
    } catch (err) { toast(err instanceof Error ? err.message : 'Could not assign ticket.', 'err'); }
  };

  return (
    <>
      <div className="page-head">
        <div className="left">
          <h1>
            Ticket Pool
            {scope === 'unassigned' && <span className="mock-flag">UNASSIGNED</span>}
          </h1>
          <p>
            {isAdmin
              ? scope === 'unassigned'
                ? 'Tickets without a responsible staff — assign them manually.'
                : 'All reported community issues across every staff member.'
              : `Tickets you are responsible for${user ? `, ${user.name}` : ''} — plus the public pool.`}
          </p>
        </div>
        <div className="actions">
          <Dropdown
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            ariaLabel="Sort tickets"
            options={[
              { value: 'priority', label: 'Sort: priority' },
              { value: 'newest', label: 'Sort: newest' },
              { value: 'due', label: 'Sort: due soonest' },
            ]}
          />
          <button className="btn btn--ghost" onClick={() => void reload()} title="Refresh">
            <i className="fa-solid fa-rotate-right" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      <div className="card">
        <div className="filterbar">
          <Dropdown
            value={status}
            onChange={(v) => setStatus(v as TicketStatus | '')}
            ariaLabel="Filter by status"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s === '' ? 'All statuses' : s }))}
          />
          <Dropdown
            value={priority}
            onChange={(v) => setPriority(v as Priority | '')}
            ariaLabel="Filter by priority"
            options={[
              { value: '' as const, label: 'All priorities' },
              { value: 'urgent', label: 'urgent' },
              { value: 'normal', label: 'normal' },
              { value: 'low', label: 'low' },
            ]}
          />
          {isAdmin && (
            <>
              <Dropdown
                value={category}
                onChange={(v) => setCategory(v as number | '')}
                ariaLabel="Filter by category"
                options={[
                  { value: '' as const, label: 'All categories' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <Dropdown
                value={zone}
                onChange={(v) => setZone(v as Zone | '')}
                ariaLabel="Filter by zone"
                options={[
                  { value: '' as const, label: 'All zones' },
                  { value: 'A' as const, label: 'Zone A' },
                  { value: 'B' as const, label: 'Zone B' },
                ]}
              />
              <Dropdown
                value={assignee}
                onChange={(v) => setAssignee(v as number | '')}
                ariaLabel="Filter by staff"
                options={[
                  { value: '' as const, label: 'All staff' },
                  ...staff.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </>
          )}
          <button className="btn btn--ghost" type="button" onClick={() => { setStatus(''); setPriority(''); setCategory(''); setZone(''); setAssignee(''); }}>Clear All Filters</button>
          <div className="search-wrap">
            <input
              type="text"
              placeholder={
                isAdmin
                  ? 'Search ticket no / title / resident / category / zone / staff…'
                  : 'Search ticket no / title / location / resident…'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search.length > 0 && (
              <button
                type="button"
                className="search-clear"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => setSearch('')}
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {error && <div className="err-box">{error}</div>}
        {loading && !tickets.length ? (
          <div className="spinner">Loading tickets…</div>
        ) : sorted.length === 0 ? (
          <div className="empty">No tickets match the current filters.</div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ticket No</th>
                  <th>Issue</th>
                  <th>Category</th>
                  <th>Zone</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Due</th>
                  <th>Reported</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr key={t.id} className={scope === 'unassigned' && !hasFilters && pinnedTicketId === t.id ? 'ticket-row-pinned' : undefined} onClick={() => { if (scope === 'unassigned' && !hasFilters) { setPinnedTicketId(t.id); localStorage.setItem('myhanns_last_unassigned_ticket', String(t.id)); } navigate(`/tickets/${t.id}`); }}>
                    <td className="mono">
                      {t.ticket_no}
                      {t.is_demo && <span className="badge badge--demo">DEMO</span>}
                    </td>
                    <td>
                      <div className={`strong${t.admin_attention ? ' is-alert' : ''}`}>{t.admin_attention && <i className="fa-solid fa-triangle-exclamation" aria-label="Admin attention required" />} {t.title}</div>
                      <div style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>{t.location_desc}</div>
                    </td>
                    <td>{t.category_name}</td>
                    <td>
                      <span className="zone-tag">Zone {t.zone}</span>
                    </td>
                    <td>
                      {t.acceptance_status === 'awaiting_acceptance' ? <span className="badge badge--completed">Awaiting Acceptance</span> : <StatusBadge status={t.status} />}
                    </td>
                    <td>
                      <PriorityTag priority={t.priority} />
                    </td>
                    <td onClick={(event) => event.stopPropagation()}>
                      {t.is_public && !t.assignee_id ? (
                        <span className="badge badge--demo">public pool</span>
                      ) : t.offered_staff_ids?.length ? (
                        <span className="badge badge--accepted">{user?.role === 'staff' && t.offered_staff_ids.includes(user.id) ? 'Offered to you' : `Offered · ${t.offered_staff_ids.length} staff`}</span>
                      ) : scope === 'unassigned' && isAdmin && !t.assignee_id ? (
                        assigningTicketId === t.id ? (
                          <Dropdown value={0} onChange={(id) => void assignFromPool(t, id)} ariaLabel={`Assign ${t.ticket_no}`} options={[{ value: 0, label: 'Choose staff…' }, ...staff.filter((member) => member.role === 'staff' && member.duty_status === 'on_duty').map((member) => ({ value: member.id, label: member.name }))]} />
                        ) : (
                          <button className="btn btn--sm btn--ghost" type="button" onClick={() => setAssigningTicketId(t.id)} aria-label={`Assign ${t.ticket_no}`} title="Select responsible staff">—</button>
                        )
                      ) : (
                        (t.assignee_name ?? '—')
                      )}
                    </td>
                    <td className="mono">{dueLabel(t)}</td>
                    <td className="mono">{t.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
