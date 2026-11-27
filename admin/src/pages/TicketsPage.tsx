import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import Dropdown from '../components/Dropdown';
import PriorityTag from '../components/PriorityTag';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../auth';
import type { Category, Priority, Ticket, TicketStatus, User, Zone } from '../models';
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
const STATUS_LABEL: Record<TicketStatus, string> = { pending: 'Pending', accepted: 'Accepted', in_progress: 'In Progress', completed: 'Completed', rejected: 'Rejected', cancelled: 'Cancelled' };

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
  const [dueBucket, setDueBucket] = useState<'' | 'none' | 'almost' | 'overdue'>('');
  const [completionTab, setCompletionTab] = useState<'open' | 'completed'>('open');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('priority');
  const [rowEdits, setRowEdits] = useState<Record<number, { assigneeId?: number; dueChoice?: string }>>({});
  const [pinnedTicketId, setPinnedTicketId] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem('myhanns_last_unassigned_ticket'));
    return Number.isFinite(saved) && saved > 0 ? saved : null;
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [staff, setStaff] = useState<User[]>([]);
  useEffect(() => {
    const requested = localStorage.getItem('myhanns_ticket_status_filter');
    if (requested !== null) { if (requested === 'overdue') setDueBucket('overdue'); else setStatus(requested === 'all' ? '' : requested as TicketStatus | ''); localStorage.removeItem('myhanns_ticket_status_filter'); }
  }, []);

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

  const hasFilters = Boolean(status || priority || category || zone || assignee || dueBucket || search.trim());
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
      const results = await api.listTickets({
          status,
          priority,
          category_id: category || undefined,
          zone: zone || undefined,
          assignee_id: assignee || undefined,
          search: search.trim(),
          scope,
        });
      const dueFiltered = dueBucket ? results.filter((ticket) => {
        if (dueBucket === 'none') return !ticket.due_at;
        if (!ticket.due_at) return false;
        const remaining = new Date(ticket.due_at.replace(' ', 'T')).getTime() - Date.now();
        return dueBucket === 'overdue' ? remaining < 0 : remaining >= 0 && remaining <= 86_400_000;
      }) : results;
      setTickets(dueFiltered.filter((ticket) => completionTab === 'completed' ? ticket.status === 'completed' : ticket.status !== 'completed'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [status, priority, category, zone, assignee, search, scope, dueBucket, completionTab]);

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

  const savePoolRow = async (ticket: Ticket) => {
    const edit = rowEdits[ticket.id] ?? {};
    const dueAt = edit.dueChoice === 'none' ? null : edit.dueChoice && edit.dueChoice !== 'existing' ? new Date(Date.now() + Number(edit.dueChoice) * 86_400_000).toISOString().slice(0, 19).replace('T', ' ') : ticket.due_at ?? null;
    try {
      if (edit.assigneeId && dueAt) await api.assignTicket(ticket.id, { assignee_id: edit.assigneeId, priority: ticket.priority, due_at: dueAt });
      else if (edit.assigneeId) await api.editTicket(ticket.id, { assignee_id: edit.assigneeId, due_at: dueAt });
      else await api.editTicket(ticket.id, { ...(edit.assigneeId === 0 ? { assignee_id: null } : {}), due_at: dueAt });
      setRowEdits((all) => { const next = { ...all }; delete next[ticket.id]; return next; });
      await reload(true);
      toast('Ticket changes saved.');
    } catch (err) { toast(err instanceof Error ? err.message : 'Could not save ticket.', 'err'); }
  };

  const deletePoolRow = async (ticket: Ticket) => {
    if (!window.confirm(`Delete ${ticket.ticket_no}? This removes the ticket and its history.`)) return;
    try { await api.deleteTicket(ticket.id); await reload(true); toast('Ticket deleted.'); }
    catch (err) { toast(err instanceof Error ? err.message : 'Could not delete ticket.', 'err'); }
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
        <nav className="subnav" aria-label="Ticket completion filter" style={{ marginBottom: 14 }}>
          <button type="button" className={`subnav__btn${completionTab === 'open' ? ' is-on' : ''}`} onClick={() => { setCompletionTab('open'); setStatus(''); }}>All except Completed</button>
          <button type="button" className={`subnav__btn${completionTab === 'completed' ? ' is-on' : ''}`} onClick={() => { setCompletionTab('completed'); setStatus(''); }}>Completed</button>
        </nav>
        <div className="filterbar">
          <Dropdown
            value={status}
            onChange={(v) => setStatus(v as TicketStatus | '')}
            ariaLabel="Filter by status"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s === '' ? 'All statuses' : STATUS_LABEL[s] }))}
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
          <Dropdown value={dueBucket} onChange={(value) => setDueBucket(value as typeof dueBucket)} ariaLabel="Filter by due date" options={[{ value: '', label: 'All due dates' }, { value: 'none', label: 'No due' }, { value: 'almost', label: 'Almost due' }, { value: 'overdue', label: 'Overdue' }]} />
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
          <button className="btn btn--ghost clear-filters" type="button" onClick={() => { setStatus(''); setPriority(''); setCategory(''); setZone(''); setAssignee(''); setDueBucket(''); }}>Clear All Filters</button>
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
                  <th>Reported Time</th>
                  {scope === 'unassigned' && isAdmin && <th>Actions</th>}
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
                      {scope === 'unassigned' && isAdmin ? (
                        <Dropdown value={rowEdits[t.id]?.assigneeId ?? t.assignee_id ?? 0} onChange={(id) => setRowEdits((all) => ({ ...all, [t.id]: { ...all[t.id], assigneeId: id } }))} ariaLabel={`Assignee for ${t.ticket_no}`} options={[{ value: 0, label: 'None' }, ...staff.filter((member) => member.role === 'staff' && member.duty_status === 'on_duty').map((member) => ({ value: member.id, label: member.name }))]} />
                      ) : t.is_public && !t.assignee_id ? (
                        <span className="badge badge--demo">public pool</span>
                      ) : t.offered_staff_ids?.length ? (
                        <span className="badge badge--accepted">{user?.role === 'staff' && t.offered_staff_ids.includes(user.id) ? 'Offered to you' : `Offered · ${t.offered_staff_ids.length} staff`}</span>
                      ) : (
                        t.assignee_name ? t.assignee_name : <i className="none-value">None</i>
                      )}
                    </td>
                    <td className={`mono${t.due_at && new Date(t.due_at.replace(' ', 'T')).getTime() < Date.now() ? ' due-overdue' : ''}`} onClick={(event) => event.stopPropagation()}>{scope === 'unassigned' && isAdmin ? <Dropdown value={rowEdits[t.id]?.dueChoice ?? (t.due_at ? 'existing' : 'none')} onChange={(dueChoice) => setRowEdits((all) => ({ ...all, [t.id]: { ...all[t.id], dueChoice } }))} ariaLabel={`Due date for ${t.ticket_no}`} options={[{ value: 'existing', label: t.due_at ? dueLabel(t) : 'Existing due date' }, { value: 'none', label: 'No due' }, { value: '1', label: 'Due in 1 day' }, { value: '2', label: 'Due in 2 days' }, { value: '7', label: 'Due in 7 days' }]} /> : <i className={!t.due_at ? 'none-value' : undefined}>{dueLabel(t) === '—' ? 'None' : dueLabel(t)}</i>}</td>
                    <td className="mono">{t.created_at}</td>
                    {scope === 'unassigned' && isAdmin && <td onClick={(event) => event.stopPropagation()}>{rowEdits[t.id] ? <><button className="btn btn--sm btn--primary" onClick={() => void savePoolRow(t)}>Save</button> <button className="btn btn--sm btn--danger" onClick={() => void deletePoolRow(t)}>Delete</button></> : <span className="none-value">—</span>}</td>}
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
