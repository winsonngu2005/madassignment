import { useEffect, useState } from 'react';
import Dropdown from '../components/Dropdown';
import { toast } from '../util';

type MockTicket = { id: string; title: string; location: string; status: string; priority: string; assignee: string; due: string };
const KEY = 'myhanns_sandbox_tickets_v1';
const read = (): MockTicket[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as MockTicket[]; } catch { return []; } };
export default function SandboxPanel({ onExit }: { onExit: () => void }) {
  const [tickets, setTickets] = useState(read);
  const [draft, setDraft] = useState<MockTicket>({ id: '', title: '', location: '', status: 'pending', priority: 'Normal', assignee: '', due: '' });
  const persist = (rows: MockTicket[]) => { setTickets(rows); localStorage.setItem(KEY, JSON.stringify(rows)); };
  useEffect(() => { document.documentElement.classList.add('sandbox-theme'); return () => document.documentElement.classList.remove('sandbox-theme'); }, []);
  const generate = () => persist([
    { id: crypto.randomUUID(), title: 'Leaking pipe', location: 'Block A, Level 2', status: 'pending', priority: 'Urgent', assignee: '', due: '' },
    { id: crypto.randomUUID(), title: 'Replace corridor light', location: 'Block B, Level 1', status: 'in_progress', priority: 'Normal', assignee: 'Daniel Tan', due: '' },
    { id: crypto.randomUUID(), title: 'Clear garden drain', location: 'Garden path', status: 'completed', priority: 'Low', assignee: 'Mei Ling', due: '' },
  ]);
  const save = () => { if (!draft.title.trim()) { toast('Enter a ticket title.', 'err'); return; } persist(draft.id ? tickets.map((t) => t.id === draft.id ? draft : t) : [...tickets, { ...draft, id: crypto.randomUUID() }]); setDraft({ id: '', title: '', location: '', status: 'pending', priority: 'Normal', assignee: '', due: '' }); };
  return <div className="sandbox-panel"><div className="sandbox-banner"><b>Sandbox Mode — isolated local data only</b><div className="actions"><button className="btn btn--primary" onClick={generate}>Generate Test Data</button><button className="btn btn--ghost" onClick={onExit}>Exit Sandbox</button></div></div><div className="page-head"><div className="left"><h1>Sandbox Tickets</h1><p>All changes stay in this browser's localStorage and never call the application API.</p></div><button className="btn btn--danger" onClick={() => persist([])}>Clear all</button></div><div className="card"><h2>{draft.id ? 'Edit mock ticket' : 'Add mock ticket'}</h2><div className="filterbar"><input placeholder="Ticket title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}/><input placeholder="Location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })}/><Dropdown value={draft.status} onChange={(status) => setDraft({ ...draft, status })} ariaLabel="Sandbox status" options={['pending','in_progress','completed','rejected'].map((x) => ({ value: x, label: x }))}/><input placeholder="Assignee" value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}/><button className="btn btn--primary" onClick={save}>Save ticket</button></div></div><div className="card table-wrap"><table className="tbl"><thead><tr><th>Ticket</th><th>Location</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Actions</th></tr></thead><tbody>{tickets.map((t) => <tr key={t.id}><td>{t.title}</td><td>{t.location}</td><td>{t.status}</td><td>{t.priority}</td><td>{t.assignee || 'None'}</td><td><button className="btn btn--sm btn--ghost" onClick={() => setDraft(t)}>Edit</button> <button className="btn btn--sm btn--danger" onClick={() => persist(tickets.filter((x) => x.id !== t.id))}>Delete</button></td></tr>)}</tbody></table></div></div>;
}
