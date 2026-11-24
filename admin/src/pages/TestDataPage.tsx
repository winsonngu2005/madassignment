import { useCallback, useEffect, useState } from 'react';
import { api, USE_MOCK } from '../api';
import {
  addDemoTicket,
  clearDemoTickets,
  deleteDemoTicket,
  listDemoBundles,
  updateDemoTicket,
} from '../api/demo';
import Dropdown from '../components/Dropdown';
import PriorityTag from '../components/PriorityTag';
import StatusBadge from '../components/StatusBadge';
import type { Priority, Ticket, TicketStatus } from '../models';
import { toast } from '../util';

const STATUS_OPTIONS: TicketStatus[] = [
  'pending',
  'accepted',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
];

interface EditDraft {
  id: number;
  title: string;
  location_desc: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  resident_name: string;
}

export default function TestDataPage() {
  const [demos, setDemos] = useState<Ticket[]>([]);
  const [edit, setEdit] = useState<EditDraft | null>(null);

  // new ticket draft
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [status, setStatus] = useState<TicketStatus>('pending');
  const [resident, setResident] = useState('');

  const refresh = useCallback(() => {
    setDemos(listDemoBundles().map((b) => b.ticket));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = () => {
    if (!title.trim() || !location.trim()) {
      toast('Title and location are required.', 'err');
      return;
    }
    addDemoTicket({
      title,
      location_desc: location,
      description: description || undefined,
      priority,
      status,
      resident_name: resident,
    });
    refresh();
    setTitle('');
    setLocation('');
    setDescription('');
    setResident('');
    toast('Demo ticket added — visible in Ticket Pool & Statistics.');
  };

  const remove = (id: number) => {
    deleteDemoTicket(id);
    refresh();
    toast('Demo ticket deleted.');
  };

  const saveEdit = () => {
    if (!edit) return;
    updateDemoTicket(edit.id, {
      title: edit.title,
      location_desc: edit.location_desc,
      description: edit.description,
      priority: edit.priority,
      status: edit.status,
      resident_name: edit.resident_name,
    });
    setEdit(null);
    refresh();
    toast('Demo ticket updated.');
  };

  const clearAll = () => {
    clearDemoTickets();
    refresh();
    toast('All demo tickets removed.');
  };

  const reseed = async () => {
    await api.resetSeed();
    toast('Seed database restored (resident-submitted simulation).');
    window.location.reload();
  };

  return (
    <>
      <div className="page-head">
        <div className="left">
          <h1>
            Test Data
            <span className="mock-flag">CLIENT-SIDE ONLY</span>
          </h1>
          <p>Add, modify and delete demo tickets used to exercise Ticket Pool and Statistics.</p>
        </div>
        <div className="actions">
          <button className="btn btn--ghost" onClick={() => void reseed()} title="Restore seed data">
            <i className="fa-solid fa-database" aria-hidden="true" />
            {USE_MOCK ? 'Reset seed db' : 'Reset seed db (mock only)'}
          </button>
          <button className="btn btn--danger" onClick={clearAll}>
            <i className="fa-solid fa-trash-can" aria-hidden="true" />
            Delete all demo tickets
          </button>
        </div>
      </div>

      <div className="info-banner">
        <b>Isolation guarantee:</b> demo tickets are stored only in this browser
        (<code>localStorage</code>). They carry <code>DEMO-</code> ticket numbers and ids ≥ 900000, and
        every triage action on them is simulated locally — <b>nothing is ever sent to the PHP API</b>,
        so real tickets submitted from the resident app are never affected. When P1&rsquo;s real API is
        switched on, this page keeps working exactly the same way.
      </div>

      <div className="card">
        <h2>Add a demo ticket</h2>
        <div className="field">
          <span className="lbl">Title *</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lift door stuck on Level 5"
          />
        </div>
        <div className="field">
          <span className="lbl">Location *</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Block A, Level 5, Lift 1"
          />
        </div>
        <div className="field">
          <span className="lbl">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details…"
          />
        </div>
        <div className="field">
          <span className="lbl">Resident name</span>
          <input
            type="text"
            value={resident}
            onChange={(e) => setResident(e.target.value)}
            placeholder="e.g. Demo Resident"
          />
        </div>
        <div className="filterbar">
          <Dropdown
            value={priority}
            onChange={(v) => setPriority(v)}
            ariaLabel="Demo priority"
            options={[
              { value: 'urgent', label: 'urgent' },
              { value: 'normal', label: 'normal' },
              { value: 'low', label: 'low' },
            ]}
          />
          <Dropdown
            value={status}
            onChange={(v) => setStatus(v)}
            ariaLabel="Demo status"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
          />
          <button className="btn btn--primary" onClick={add}>
            <i className="fa-solid fa-plus" aria-hidden="true" />
            Add
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Demo tickets ({demos.length})</h2>
        {demos.length === 0 ? (
          <div className="empty">No demo tickets yet — add one above to test the pool and statistics.</div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Ticket No</th>
                  <th>Issue</th>
                  <th>Resident</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Operations</th>
                </tr>
              </thead>
              <tbody>
                {demos.map((t) => (
                  <tr key={t.id} style={{ cursor: 'default' }}>
                    <td className="mono">
                      <span className="badge badge--demo">DEMO</span>
                      {t.ticket_no}
                    </td>
                    <td>
                      <div className="strong">{t.title}</div>
                      <div style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>{t.location_desc}</div>
                    </td>
                    <td>{t.resident_name}</td>
                    <td>
                      <StatusBadge status={t.status} />
                    </td>
                    <td>
                      <PriorityTag priority={t.priority} />
                    </td>
                    <td className="mono">{t.created_at}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn--sm btn--ghost"
                        onClick={() =>
                          setEdit({
                            id: t.id,
                            title: t.title,
                            location_desc: t.location_desc,
                            description: t.description ?? '',
                            priority: t.priority,
                            status: t.status,
                            resident_name: t.resident_name,
                          })
                        }
                      >
                        <i className="fa-solid fa-pen" aria-hidden="true" />
                        Modify
                      </button>{' '}
                      <button className="btn btn--sm btn--danger" onClick={() => remove(t.id)}>
                        <i className="fa-solid fa-trash-can" aria-hidden="true" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <div className="modal-back" onClick={(e) => e.target === e.currentTarget && setEdit(null)}>
          <div className="modal">
            <h2>Modify demo ticket</h2>
            <div className="field">
              <span className="lbl">Title</span>
              <input type="text" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </div>
            <div className="field">
              <span className="lbl">Location</span>
              <input
                type="text"
                value={edit.location_desc}
                onChange={(e) => setEdit({ ...edit, location_desc: e.target.value })}
              />
            </div>
            <div className="field">
              <span className="lbl">Description</span>
              <textarea
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              />
            </div>
            <div className="field">
              <span className="lbl">Resident name</span>
              <input
                type="text"
                value={edit.resident_name}
                onChange={(e) => setEdit({ ...edit, resident_name: e.target.value })}
              />
            </div>
            <div className="filterbar">
              <Dropdown
                value={edit.priority}
                onChange={(v) => setEdit({ ...edit, priority: v })}
                ariaLabel="Edit priority"
                options={[
                  { value: 'urgent', label: 'urgent' },
                  { value: 'normal', label: 'normal' },
                  { value: 'low', label: 'low' },
                ]}
              />
              <Dropdown
                value={edit.status}
                onChange={(v) => setEdit({ ...edit, status: v })}
                ariaLabel="Edit status"
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn--ghost" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={saveEdit}>
                <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
