import { useCallback, useEffect, useState } from 'react';
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
import type { Category, Priority, Ticket, TicketStatus, Zone } from '../models';
import { toast } from '../util';

const STATUS_OPTIONS: TicketStatus[] = [
  'pending',
  'accepted',
  'in_progress',
  'completed',
  'rejected',
  'cancelled',
];

const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: 'Lighting', code: 'lighting', sla_hours: 48 },
  { id: 2, name: 'Garbage Collection', code: 'garbage', sla_hours: 24 },
  { id: 3, name: 'Public Facility', code: 'facility', sla_hours: 72 },
  { id: 4, name: 'Noise Disturbance', code: 'noise', sla_hours: 48 },
  { id: 5, name: 'Leak / Plumbing & Electrical', code: 'leak_plumbing_electrical', sla_hours: 48 },
  { id: 6, name: 'Cleaning', code: 'cleaning', sla_hours: 24 },
  { id: 7, name: 'Masonry / Odd-job', code: 'masonry', sla_hours: 72 },
  { id: 8, name: 'Others', code: 'others', sla_hours: 48 },
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
  const testTabs = ['Ticket Pool', 'Unassigned', 'Statistics', 'Staff Zones', 'Requests'] as const;
  const [activeTab, setActiveTab] = useState<(typeof testTabs)[number]>('Ticket Pool');
  const [mockStaff, setMockStaff] = useState(() => JSON.parse(localStorage.getItem('myhanns_test_staff_v1') ?? '[]') as { name: string; email: string; phone: string; zones: string; profession: string }[]);
  const [mockRequests, setMockRequests] = useState(() => JSON.parse(localStorage.getItem('myhanns_test_requests_v1') ?? '[]') as { staff: string; request: string; status: string }[]);
  const [staffDraft, setStaffDraft] = useState({ name: '', email: '', phone: '', zones: 'A', profession: 'Plumbing' });
  const [requestDraft, setRequestDraft] = useState({ staff: '', request: '' });
  const [demos, setDemos] = useState<Ticket[]>([]);
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const categories = MOCK_CATEGORIES;

  // new ticket draft
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [status, setStatus] = useState<TicketStatus>('pending');
  const [resident, setResident] = useState('');
  const [zone, setZone] = useState<Zone>('A');
  const [category, setCategory] = useState<number | ''>('');

  const refresh = useCallback(() => {
    setDemos(listDemoBundles().map((b) => b.ticket));
  }, []);

  const saveMockStaff = (next: typeof mockStaff) => { setMockStaff(next); localStorage.setItem('myhanns_test_staff_v1', JSON.stringify(next)); };
  const saveMockRequests = (next: typeof mockRequests) => { setMockRequests(next); localStorage.setItem('myhanns_test_requests_v1', JSON.stringify(next)); };

  useEffect(() => {
    refresh();
    setCategory(MOCK_CATEGORIES[0].id);
  }, [refresh]);

  const add = () => {
    if (!title.trim() || !location.trim()) {
      toast('Title and location are required.', 'err');
      return;
    }
    const cat = categories.find((c) => c.id === category);
    addDemoTicket({
      title,
      location_desc: location,
      description: description || undefined,
      priority,
      status: activeTab === 'Unassigned' ? 'pending' : status,
      resident_name: resident,
      zone,
      category_id: cat?.id,
      category_code: cat?.code,
      category_name: cat?.name,
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

      <nav className="subnav test-data-nav" aria-label="Test data sections">
        {testTabs.map((tab) => <button key={tab} type="button" className={`subnav__btn${activeTab === tab ? ' is-on' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </nav>

      {(activeTab === 'Ticket Pool' || activeTab === 'Unassigned') && <>
      <div className="card">
        <h2>{activeTab === 'Unassigned' ? 'Add an unassigned demo ticket' : 'Add a demo ticket'}</h2>
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
            value={zone}
            onChange={(v) => setZone(v as Zone)}
            ariaLabel="Demo zone"
            options={[
              { value: 'A' as const, label: 'Zone A' },
              { value: 'B' as const, label: 'Zone B' },
            ]}
          />
          <Dropdown
            value={category}
            onChange={(v) => setCategory(v as number | '')}
            ariaLabel="Demo category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
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
            value={activeTab === 'Unassigned' ? 'pending' : status}
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
        <h2>{activeTab === 'Unassigned' ? 'Unassigned demo tickets' : 'Demo tickets'} ({(activeTab === 'Unassigned' ? demos.filter((t) => t.status === 'pending' && !t.assignee_id) : demos).length})</h2>
        {(activeTab === 'Unassigned' ? demos.filter((t) => t.status === 'pending' && !t.assignee_id) : demos).length === 0 ? (
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
                {(activeTab === 'Unassigned' ? demos.filter((t) => t.status === 'pending' && !t.assignee_id) : demos).map((t) => (
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
      </>}

      {activeTab === 'Statistics' && <div className="card"><h2>Mock ticket statistics</h2><div className="stats-grid">{(['total', 'pending', 'in_progress', 'completed', 'rejected'] as const).map((key) => <div className="stat-card" key={key}><span>{key.replace('_', ' ')}</span><strong>{key === 'total' ? demos.length : demos.filter((t) => t.status === key).length}</strong></div>)}</div><p className="muted">Counts are calculated from this browser’s demo tickets only.</p></div>}

      {activeTab === 'Staff Zones' && <div className="card"><h2>Mock staff zones</h2><p className="muted">Test staff records are saved separately in this browser and never sent to the staff database.</p><div className="filterbar"><input placeholder="Staff name" value={staffDraft.name} onChange={(e) => setStaffDraft({ ...staffDraft, name: e.target.value })}/><input placeholder="Email" value={staffDraft.email} onChange={(e) => setStaffDraft({ ...staffDraft, email: e.target.value })}/><input placeholder="Phone" value={staffDraft.phone} onChange={(e) => setStaffDraft({ ...staffDraft, phone: e.target.value })}/><Dropdown value={staffDraft.zones} onChange={(v) => setStaffDraft({ ...staffDraft, zones: v })} ariaLabel="Mock staff zone" options={[{ value: 'A', label: 'Zone A' }, { value: 'B', label: 'Zone B' }]}/><Dropdown value={staffDraft.profession} onChange={(v) => setStaffDraft({ ...staffDraft, profession: v })} ariaLabel="Mock staff profession" options={['Plumbing', 'Electrical', 'Cleaning', 'Masonry'].map((value) => ({ value, label: value }))}/><button className="btn btn--primary" onClick={() => { if (!staffDraft.name.trim() || !staffDraft.email.includes('@') || !staffDraft.phone.trim()) { toast('Enter a name, valid email and phone.', 'err'); return; } saveMockStaff([...mockStaff, staffDraft]); setStaffDraft({ name: '', email: '', phone: '', zones: 'A', profession: 'Plumbing' }); }}>Add mock staff</button></div><div className="table-wrap"><table className="tbl"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Zone</th><th>Profession</th><th /></tr></thead><tbody>{mockStaff.map((s, i) => <tr key={`${s.email}-${i}`}><td>{s.name}</td><td>{s.email}</td><td>{s.phone}</td><td>Zone {s.zones}</td><td>{s.profession}</td><td><button className="btn btn--sm btn--danger" onClick={() => saveMockStaff(mockStaff.filter((_, index) => index !== i))}>Delete</button></td></tr>)}</tbody></table></div></div>}

      {activeTab === 'Requests' && <div className="card"><h2>Mock staff requests</h2><p className="muted">Create presentation requests without touching live requests.</p><div className="filterbar"><input placeholder="Staff name" value={requestDraft.staff} onChange={(e) => setRequestDraft({ ...requestDraft, staff: e.target.value })}/><input placeholder="Request / reason" value={requestDraft.request} onChange={(e) => setRequestDraft({ ...requestDraft, request: e.target.value })}/><button className="btn btn--primary" onClick={() => { if (!requestDraft.staff.trim() || !requestDraft.request.trim()) { toast('Enter staff name and request details.', 'err'); return; } saveMockRequests([...mockRequests, { ...requestDraft, status: 'Pending' }]); setRequestDraft({ staff: '', request: '' }); }}>Add mock request</button></div><div className="table-wrap"><table className="tbl"><thead><tr><th>Staff</th><th>Request</th><th>Status</th><th>Action</th></tr></thead><tbody>{mockRequests.map((r, i) => <tr key={`${r.staff}-${i}`}><td>{r.staff}</td><td>{r.request}</td><td>{r.status}</td><td><button className="btn btn--sm btn--ghost" onClick={() => saveMockRequests(mockRequests.map((item, index) => index === i ? { ...item, status: item.status === 'Pending' ? 'Approved' : 'Pending' } : item))}>{r.status === 'Pending' ? 'Approve' : 'Reset'}</button> <button className="btn btn--sm btn--danger" onClick={() => saveMockRequests(mockRequests.filter((_, index) => index !== i))}>Delete</button></td></tr>)}</tbody></table></div></div>}

      {edit && (activeTab === 'Ticket Pool' || activeTab === 'Unassigned') && (
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
