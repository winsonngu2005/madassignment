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
  EditTicketPayload,
  Priority,
  RejectPayload,
  StatusLog,
  Ticket,
  TicketBundle,
  TicketStatus,
  User,
  WorkTask,
  Zone,
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
  zone: Zone;
  category_id?: number;
  category_code?: string;
  category_name?: string;
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
    category_id: input.category_id ?? 0,
    category_code: input.category_code ?? '',
    category_name: input.category_name ?? '—',
    zone: input.zone,
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
    auto_assigned: false,
    co_assignee_id: null,
    co_assignee_name: null,
    is_public: false,
    requests: [],
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
  patch: Partial<Pick<Ticket, 'title' | 'location_desc' | 'description' | 'priority' | 'status' | 'resident_name' | 'offered_staff_ids' | 'is_public'>>,
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

export async function demoAccept(id: number, staff?: User): Promise<TicketBundle> {
  return mutateBundle(id, (b) => {
    if (b.ticket.status !== 'pending' && b.ticket.status !== 'accepted') {
      throw new Error(`Only pending tickets can be accepted (current: ${b.ticket.status}).`);
    }
    const now = isoNow();
    const from = b.ticket.status;
    if (staff) {
      if (staff.duty_status !== 'on_duty') throw new Error('You are Off Duty and cannot accept tickets.');
      if (b.ticket.assignee_id && b.ticket.assignee_id !== staff.id) throw new Error('Another staff member already claimed this ticket.');
      if (b.ticket.offered_staff_ids?.length && !b.ticket.offered_staff_ids.includes(staff.id)) throw new Error('This ticket was not offered to your job tag and zone.');
      b.ticket.assignee_id = staff.id;
      b.ticket.assignee_name = staff.name;
      b.ticket.offered_staff_ids = [];
    }
    b.ticket.status = 'accepted';
    b.ticket.accepted_at = now;
    b.ticket.updated_at = now;
    pushLog(b, from, 'accepted', 'Ticket accepted — demo action, kept client-side only.');
  });
}

export function routeDemoTicket(id: number, offers: number[], publicPool = false): void {
  const bundle = getDemoBundle(id);
  if (!bundle || bundle.ticket.status !== 'pending' || bundle.ticket.assignee_id) return;
  if (bundle.ticket.offered_staff_ids?.length || bundle.ticket.is_public) return;
  updateDemoTicket(id, { offered_staff_ids: offers, is_public: publicPool });
}

export async function demoStart(id: number): Promise<TicketBundle> {
  return mutateBundle(id, (b) => {
    if (b.ticket.status !== 'accepted') throw new Error('Accept the demo ticket before starting work.');
    const actor = (() => { try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; } })();
    if (actor?.role === 'staff' && b.ticket.assignee_id !== actor.id) throw new Error('Only the assigned staff member can start this ticket.');
    const now = isoNow();
    b.ticket.status = 'in_progress';
    b.ticket.work_tasks ??= [];
    const taskId = Math.max(0, ...b.ticket.work_tasks.map((task) => task.id)) + 1;
    b.ticket.work_tasks.push({ id: taskId, task_code: 'primary', task_label: 'Primary repair', sequence_no: 1, task_status: 'in_progress', assignee_id: b.ticket.assignee_id, assignee_name: b.ticket.assignee_name });
    b.ticket.updated_at = now;
    pushLog(b, 'accepted', 'in_progress', 'Work started by staff (demo action, client-side only).');
  });
}

export async function demoAssign(id: number, payload: AssignPayload, staffName: string | null): Promise<TicketBundle> {
  return mutateBundle(id, (b) => {
    if (b.ticket.status !== 'pending' && b.ticket.status !== 'accepted' && b.ticket.status !== 'in_progress') {
      throw new Error(`This ticket cannot be assigned in its current state (${b.ticket.status}).`);
    }
    if (!payload.due_at) throw new Error('A target completion time (due_at) is required.');
    const now = isoNow();
    const from = b.ticket.status;
    const name = staffName ?? `Staff #${payload.assignee_id}`;
    b.ticket.status = from === 'pending' ? 'accepted' : 'in_progress';
    b.ticket.assignee_id = payload.assignee_id;
    b.ticket.assignee_name = name;
    if (payload.priority) b.ticket.priority = payload.priority;
    b.ticket.due_at = payload.due_at;
    b.ticket.updated_at = now;
    pushLog(
      b,
      from,
      b.ticket.status,
      `Assigned to ${name} (priority: ${b.ticket.priority}, due by ${payload.due_at}).${payload.note ? ' ' + payload.note : ''} — demo action, client-side only.`,
    );
  });
}

export function demoEdit(id: number, payload: EditTicketPayload, staffName: string | null, prevAssignee: string | null): TicketBundle {
  const s = load();
  const b = s.bundles.find((x) => x.ticket.id === id);
  if (!b) throw new Error('Demo ticket not found.');
  const changes: string[] = [];
  if (payload.assignee_id != null) {
    const name = staffName ?? `Staff #${payload.assignee_id}`;
    if (name !== prevAssignee) {
      b.ticket.assignee_id = payload.assignee_id;
      b.ticket.assignee_name = name;
      b.ticket.auto_assigned = false;
      changes.push(`assignee → ${name}`);
    }
  }
  if (payload.due_at != null && payload.due_at !== b.ticket.due_at) {
    b.ticket.due_at = payload.due_at;
    changes.push(`target completion → ${payload.due_at}`);
  }
  if (payload.priority && payload.priority !== b.ticket.priority) {
    b.ticket.priority = payload.priority;
    changes.push(`priority → ${payload.priority}`);
  }
  b.ticket.updated_at = isoNow();
  pushLog(b, b.ticket.status, b.ticket.status, `Admin edited ticket: ${changes.join('; ') || 'no field changed'}.${payload.note ? ' ' + payload.note : ''}`);
  save(s);
  return b;
}

export async function demoComplete(id: number, payload: CompletePayload, staff: User[]): Promise<TicketBundle> {
  return mutateBundle(id, async (b) => {
    if (b.ticket.status !== 'in_progress') {
      throw new Error(`Only in-progress tickets can be completed (current: ${b.ticket.status}).`);
    }
    if (!payload.photos.length || payload.photos.length > 3) throw new Error('Add 1 to 3 after-repair photos.');
    const actor = (() => { try { return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'); } catch { return null; } })();
    if (actor?.role === 'staff' && b.ticket.assignee_id !== actor.id) throw new Error('Only the assigned staff member can complete this task.');
    const now = isoNow();
    const photos: string[] = [];
    for (const f of payload.photos) photos.push(await fileToDataUrl(f));
    b.ticket.work_tasks ??= [];
    let active = b.ticket.work_tasks.find((task) => task.task_status === 'in_progress');
    if (!active) {
      const taskId = Math.max(0, ...b.ticket.work_tasks.map((task) => task.id)) + 1;
      active = { id: taskId, task_code: 'primary', task_label: 'Primary repair', sequence_no: 1, task_status: 'in_progress', assignee_id: b.ticket.assignee_id, assignee_name: b.ticket.assignee_name };
      b.ticket.work_tasks.push(active);
    }
    active.task_status = 'completed';
    const waiting = b.ticket.work_tasks.find((task) => task.task_status === 'blocked' && task.blocked_by_task_id === active!.id);
    if (waiting) {
      waiting.task_status = 'in_progress';
      waiting.blocked_by_task_id = null;
      b.ticket.assignee_id = waiting.assignee_id;
      b.ticket.assignee_name = waiting.assignee_name;
    } else {
      const nextId = Math.max(0, ...b.ticket.work_tasks.map((task) => task.id)) + 1;
      (payload.relay_tasks ?? []).forEach((code, index) => {
        b.ticket.work_tasks!.push({ id: nextId + index, task_code: code, task_label: code === 'cleaner' ? 'Cleaning / mopping' : 'Masonry / odd-job', sequence_no: active!.sequence_no + index + 1, task_status: 'queued', blocked_by_task_id: index ? nextId + index - 1 : null });
      });
      b.ticket.handoff_count = (b.ticket.handoff_count ?? 0) + (payload.relay_tasks?.length ?? 0);
      if ((b.ticket.handoff_count ?? 0) > 3) { b.ticket.admin_attention = true; b.ticket.admin_attention_reason = 'More than three staff handoffs; admin coordination required.'; }
      const next = b.ticket.work_tasks.filter((task) => task.task_status === 'queued' || task.task_status === 'ready').sort((a, c) => a.sequence_no - c.sequence_no)[0];
      if (next) {
        const assignee = staff.find((user) => user.role === 'staff' && user.duty_status === 'on_duty' && user.zones.includes(b.ticket.zone) && user.professions.includes(next.task_code));
        if (assignee) {
          next.task_status = 'in_progress'; next.assignee_id = assignee.id; next.assignee_name = assignee.name;
          b.ticket.assignee_id = assignee.id; b.ticket.assignee_name = assignee.name;
        } else {
          b.ticket.assignee_id = null; b.ticket.assignee_name = null; b.ticket.admin_attention = true;
          b.ticket.admin_attention_reason = `No on-duty staff member matches relay job ${next.task_code}.`;
        }
      } else {
        b.ticket.status = 'completed';
        b.ticket.completed_at = now;
        b.ticket.acceptance_status = 'awaiting_acceptance';
        b.ticket.acceptance_due_at = isoNowAfterHours(48);
        b.ticket.assignee_id = null;
        b.ticket.assignee_name = null;
      }
    }
    b.ticket.updated_at = now;
    pushLog(b, 'in_progress', b.ticket.status, `${payload.note?.trim() || 'Work completed.'}${payload.relay_tasks?.length ? ` Relay sequence: ${payload.relay_tasks.join(' → ')}.` : ''}`);
    b.logs[b.logs.length - 1].photo_urls = photos;
  });
}

function isoNowAfterHours(hours: number): string {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

export function demoCallForSupport(id: number, helper: User, reason: string): TicketBundle {
  const store = load();
  const bundle = store.bundles.find((item) => item.ticket.id === id);
  if (!bundle) throw new Error('Demo ticket not found.');
  const actorId = (() => { try { return Number(JSON.parse(localStorage.getItem(USER_KEY) ?? 'null')?.id); } catch { return 0; } })();
  if (bundle.ticket.status !== 'in_progress' || bundle.ticket.assignee_id !== actorId) throw new Error('Only the assigned demo staff member can request support.');
  if (helper.duty_status !== 'on_duty' || !helper.zones.includes(bundle.ticket.zone)) throw new Error('Selected colleague is Off Duty or does not cover this zone.');
  const active = bundle.ticket.work_tasks?.find((task) => task.task_status === 'in_progress');
  if (!active) throw new Error('No active work task to block.');
  const idNext = Math.max(0, ...(bundle.ticket.work_tasks ?? []).map((task) => task.id)) + 1;
  active.task_status = 'blocked';
  active.blocked_by_task_id = idNext;
  const support: WorkTask = { id: idNext, task_code: helper.professions[0] ?? 'support', task_label: `${helper.name} prerequisite support`, sequence_no: active.sequence_no, task_status: 'in_progress', assignee_id: helper.id, assignee_name: helper.name };
  bundle.ticket.work_tasks!.push(support);
  bundle.ticket.assignee_id = helper.id;
  bundle.ticket.assignee_name = helper.name;
  bundle.ticket.handoff_count = (bundle.ticket.handoff_count ?? 0) + 1;
  if ((bundle.ticket.handoff_count ?? 0) > 3) { bundle.ticket.admin_attention = true; bundle.ticket.admin_attention_reason = 'More than three staff handoffs; admin coordination required.'; }
  bundle.ticket.updated_at = isoNow();
  pushLog(bundle, 'in_progress', 'in_progress', `Support called: ${reason.trim()}. Assigned to ${helper.name} (demo action).`);
  save(store);
  return bundle;
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

export function demoRelease(id: number): TicketBundle {
  const s = load();
  const b = s.bundles.find((x) => x.ticket.id === id);
  if (!b) throw new Error('Demo ticket not found.');
  if (b.ticket.status !== 'pending' && b.ticket.status !== 'accepted') {
    throw new Error('Only pending or accepted tickets can be released to the pool.');
  }
  const from = b.ticket.status;
  b.ticket.assignee_id = null;
  b.ticket.assignee_name = null;
  b.ticket.co_assignee_id = null;
  b.ticket.co_assignee_name = null;
  b.ticket.auto_assigned = false;
  b.ticket.is_public = true;
  b.ticket.status = 'pending';
  b.ticket.updated_at = isoNow();
  pushLog(b, from, 'pending', 'Released to the public pool — demo action, client-side only.');
  save(s);
  return b;
}
