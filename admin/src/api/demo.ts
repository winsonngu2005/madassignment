// Demo / test data store — the engine behind the "Test Data" page.
//
// Isolation rule (important): demo tickets live ONLY in this browser's
// localStorage. They are never POSTed/PATCHed to the PHP API, and they use
// ticket_no prefix "DEMO-" + ids >= 900000 so they can never collide with real
// tickets submitted from the resident app. In mock mode the seed database
// represents "what the mobile side submitted" and this store is a separate
// overlay on top of it; in real-API mode the overlay is purely visual and all
// triage actions on demo tickets are simulated locally.

import type {
  AssignPayload,
  CompletePayload,
  Priority,
  RejectPayload,
  StatusLog,
  Ticket,
  TicketBundle,
  TicketStatus,
} from '../models';
import { USER_KEY } from './keys';

const KEY = 'cst_demo_bundles_v1';
const DEMO_ID_BASE = 900000;

interface Store {
  bundles: TicketBundle[];
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* corrupted — start empty */
  }
  return { bundles: [] };
}

function save(s: Store) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function isoNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

function currentActor(): string {
  try {
    const u = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
    return u?.name ? `${u.name} (demo)` : 'Administrator (demo)';
  } catch {
    return 'Administrator (demo)';
  }
}

function nextId(bundles: TicketBundle[]): number {
  const max = bundles.reduce((m, b) => Math.max(m, b.ticket.id), DEMO_ID_BASE - 1);
  return max + 1;
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Failed to read photo.'));
    r.readAsDataURL(f);
  });
}

// ---- reads ----------------------------------------------------------------

export function listDemoBundles(): TicketBundle[] {
  return load().bundles;
}

export function listDemoTickets(): Ticket[] {
  return load().bundles.map((b) => b.ticket);
}

export function getDemoBundle(id: number): TicketBundle | null {
  return load().bundles.find((b) => b.ticket.id === id) ?? null;
}

export function isDemoTicket(id: number): boolean {
  return getDemoBundle(id) !== null;
}

// ---- CRUD from the Test Data page -----------------------------------------

export interface DemoInput {
  title: string;
  location_desc: string;
  description?: string;
  priority: Priority;
  status: TicketStatus;
  resident_name: string;
}

export function addDemoTicket(input: DemoInput): TicketBundle {
  const s = load();
  const id = nextId(s.bundles);
  const now = isoNow();
  const ticket: Ticket = {
    id,
    ticket_no: `DEMO-${now.slice(0, 10).replace(/-/g, '')}-${String(id - DEMO_ID_BASE).padStart(4, '0')}`,
    resident_id: 0,
    resident_name: input.resident_name.trim() || 'Demo Resident',
    category_id: 0,
    category_code: '',
    category_name: '—',
    title: input.title.trim(),
    description: input.description?.trim() || null,
    location_desc: input.location_desc.trim(),
    lat: null,
    lng: null,
    photo_urls: [],
    status: input.status,
    priority: input.priority,
    assignee_id: null,
    assignee_name: null,
    due_at: null,
    accepted_at: null,
    completed_at: null,
    reject_reason: null,
    cancelled_reason: null,
    cancelled_at: null,
    created_at: now,
    updated_at: now,
    is_demo: true,
  };
  const log: StatusLog = {
    id: (s.bundles.reduce((m, b) => Math.max(m, ...b.logs.map((l) => l.id)), 0) || 0) + 1,
    ticket_id: id,
    from_status: null,
    to_status: input.status,
    actor_name: ticket.resident_name,
    note: 'Demo ticket created from the Test Data page.',
    created_at: now,
  };
  const bundle: TicketBundle = { ticket, logs: [log], rating: null };
  s.bundles.push(bundle);
  save(s);
  return bundle;
}

export function updateDemoTicket(
  id: number,
  patch: Partial<Pick<Ticket, 'title' | 'location_desc' | 'description' | 'priority' | 'status' | 'resident_name'>>,
): TicketBundle | null {
  const s = load();
  const b = s.bundles.find((x) => x.ticket.id === id);
  if (!b) return null;
  const now = isoNow();
  const oldStatus = b.ticket.status;
  Object.assign(b.ticket, patch, { updated_at: now });
  if (patch.status && patch.status !== oldStatus) {
    b.logs.push({
      id: (b.logs.reduce((m, l) => Math.max(m, l.id), 0) || 0) + 1,
      ticket_id: id,
      from_status: oldStatus,
      to_status: patch.status,
      actor_name: currentActor(),
      note: `Status changed to ${patch.status} from the Test Data page.`,
      created_at: now,
    });
  }
  save(s);
  return b;
}

export function deleteDemoTicket(id: number): boolean {
  const s = load();
  const before = s.bundles.length;
  s.bundles = s.bundles.filter((b) => b.ticket.id !== id);
  save(s);
  return s.bundles.length < before;
}

export function clearDemoTickets() {
  save({ bundles: [] });
}

// ---- locally simulated triage actions (never reach the server) ------------

async function mutateBundle(
  id: number,
  mutate: (b: TicketBundle) => void | Promise<void>,
): Promise<TicketBundle> {
  const s = load();
  const b = s.bundles.find((x) => x.ticket.id === id);
  if (!b) throw new Error('Demo ticket not found.');
  await mutate(b);
  save(s);
  return b;
}

function pushLog(b: TicketBundle, from: TicketStatus | null, to: TicketStatus, note: string) {
  b.logs.push({
    id: (b.logs.reduce((m, l) => Math.max(m, l.id), 0) || 0) + 1,
    ticket_id: b.ticket.id,
    from_status: from,
    to_status: to,
    actor_name: currentActor(),
    note,
    created_at: isoNow(),
  });
}

export async function demoAccept(id: number): Promise<TicketBundle> {
  return mutateBundle(id, (b) => {
    if (b.ticket.status !== 'pending') {
      throw new Error(`Only pending tickets can be accepted (current: ${b.ticket.status}).`);
    }
    const now = isoNow();
    const from = b.ticket.status;
    b.ticket.status = 'accepted';
    b.ticket.accepted_at = now;
    b.ticket.updated_at = now;
    pushLog(b, from, 'accepted', 'Ticket accepted — demo action, kept client-side only.');
  });
}

export async function demoAssign(id: number, payload: AssignPayload, staffName: string | null): Promise<TicketBundle> {
  return mutateBundle(id, (b) => {
    if (b.ticket.status !== 'accepted' && b.ticket.status !== 'in_progress') {
      throw new Error(`Only accepted tickets can be assigned (current: ${b.ticket.status}).`);
    }
    if (!payload.due_at) throw new Error('A target completion time (due_at) is required.');
    const now = isoNow();
    const from = b.ticket.status;
    const name = staffName ?? `Staff #${payload.assignee_id}`;
    b.ticket.status = 'in_progress';
    b.ticket.assignee_id = payload.assignee_id;
    b.ticket.assignee_name = name;
    b.ticket.priority = payload.priority;
    b.ticket.due_at = payload.due_at;
    b.ticket.updated_at = now;
    pushLog(
      b,
      from,
      'in_progress',
      `Assigned to ${name} (priority: ${payload.priority}, due by ${payload.due_at}).${payload.note ? ' ' + payload.note : ''} — demo action, client-side only.`,
    );
  });
}

export async function demoComplete(id: number, payload: CompletePayload): Promise<TicketBundle> {
  return mutateBundle(id, async (b) => {
    if (b.ticket.status !== 'in_progress') {
      throw new Error(`Only in-progress tickets can be completed (current: ${b.ticket.status}).`);
    }
    if (payload.photos.length > 3) throw new Error('At most 3 completion photos.');
    const now = isoNow();
    const from = b.ticket.status;
    const photos: string[] = [];
    for (const f of payload.photos) photos.push(await fileToDataUrl(f));
    b.ticket.status = 'completed';
    b.ticket.completed_at = now;
    b.ticket.updated_at = now;
    pushLog(b, from, 'completed', payload.note?.trim() || 'Work completed.');
    if (photos.length) b.logs[b.logs.length - 1].photo_urls = photos;
  });
}

export async function demoReject(id: number, payload: RejectPayload): Promise<TicketBundle> {
  return mutateBundle(id, (b) => {
    if (b.ticket.status !== 'pending' && b.ticket.status !== 'accepted') {
      throw new Error(`Only pending or accepted tickets can be rejected (current: ${b.ticket.status}).`);
    }
    if (!payload.reason.trim()) throw new Error('A rejection reason is required.');
    const now = isoNow();
    const from = b.ticket.status;
    b.ticket.status = 'rejected';
    b.ticket.reject_reason = payload.reason.trim();
    b.ticket.updated_at = now;
    pushLog(b, from, 'rejected', `Rejected: ${payload.reason.trim()} — demo action, client-side only.`);
  });
}
