import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Dropdown from '../components/Dropdown';
import PriorityTag from '../components/PriorityTag';
import StatusBadge from '../components/StatusBadge';
import type { Priority, Ticket, TicketStatus } from '../models';
import { dueLabel } from '../util';

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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('priority');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTickets(
        await api.listTickets({ status, priority, search: search.trim() }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [status, priority, search]);

  // debounce search
  useEffect(() => {
    const id = window.setTimeout(() => {
      void reload();
    }, 250);
    return () => window.clearTimeout(id);
  }, [reload]);

  const sorted = useMemo(() => {
    const list = [...tickets];
    if (sort === 'newest') return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === 'due') return list.sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'));
    return list.sort((a, b) => {
      const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (pr !== 0) return pr;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [tickets, sort]);

  return (
    <>
      <div className="page-head">
        <div className="left">
          <h1>Ticket Pool</h1>
          <p>All reported community issues — triage, assign and close.</p>
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
          <div className="search-wrap">
            <input
              type="text"
              placeholder="Search ticket no / title / location / resident…"
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
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Due</th>
                  <th>Reported</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr key={t.id} onClick={() => navigate(`/tickets/${t.id}`)}>
                    <td className="mono">
                      {t.ticket_no}
                      {t.is_demo && <span className="badge badge--demo">DEMO</span>}
                    </td>
                    <td>
                      <div className="strong">{t.title}</div>
                      <div style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>
                        {t.location_desc}
                        {t.zone_name && <span className="zone-tag">{t.zone_name}</span>}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      <PriorityTag priority={t.priority} />
                    </td>
                    <td>{t.assignee_name ?? '—'}</td>
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
