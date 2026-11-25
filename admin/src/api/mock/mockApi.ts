// Mock implementation of the admin/staff API contract (see admin-api-spec.md).
// The seed database simulates "what the resident app submits" (persisted in
// localStorage). Demo tickets from the Test Data page live in a separate
// store and are merged by api/index.ts.
//
// Actor roles: mockApi reads the logged-in user from localStorage so every
// action/log row records whether it was performed by an admin or by a staff
// member, and staff are scoped to their own tickets.

import type {
  AssignPayload,
  Category,
  CompletePayload,
  DutyStatus,
  EditTicketPayload,
  LoginResult,
  NewStaffPayload,
  RejectPayload,
  RequestType,
  Stats,
  Ticket,
  TicketBundle,
  TicketFilter,
  TicketRequest,
  User,
} from '../../models';
import { CATEGORY_PROFESSIONS } from '../professions';
import { USER_KEY } from '../keys';
import { computeStatsFor } from '../stats';
import { Db, buildSeed, iso } from './db';

const DB_KEY = 'cst_admin_mock_db_v2'; // v2: new assignment model — old db discarded

const PRIORITY_RANK: Record<string, number> = { urgent: 3, normal: 2, low: 1 };

function load(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const db = JSON.parse(raw) as Db;
      // schema guard: users added in v2 carry professions/zones
      if (db.users?.every((u) => Array.isArray(u.zones))) {
        db.users.forEach((u) => { u.duty_status ??= 'on_duty'; });
        db.users.filter((u) => u.role === 'staff').forEach((u) => {
          if ((u.professions.includes('electrician') || u.professions.includes('plumber')) && !u.professions.includes('plumbing_electrical_repair')) u.professions.push('plumbing_electrical_repair');
          if (u.professions.includes('maintenance') && !u.professions.includes('masonry_odd_job')) u.professions.push('masonry_odd_job');
          if (u.email === 'worker@gmail.com' && !u.professions.includes('cleaner')) u.professions.push('cleaner');
        });
        const extraCategories: Category[] = [
          { id: 5, name: 'Leak / Plumbing & Electrical', code: 'leak_plumbing_electrical', sla_hours: 48 },
          { id: 6, name: 'Cleaning', code: 'cleaning', sla_hours: 24 },
          { id: 7, name: 'Masonry / Odd-job', code: 'masonry', sla_hours: 72 },
          { id: 8, name: 'Others', code: 'others', sla_hours: 48 },
        ];
        db.categories ??= [];
        extraCategories.forEach((category) => { if (!db.categories.some((c) => c.code === category.code)) db.categories.push(category); });
        db.tickets.forEach((ticket) => {
          ticket.offered_staff_ids ??= [];
          ticket.work_tasks ??= [];
          ticket.handoff_count ??= 0;
          ticket.admin_attention ??= false;
          ticket.acceptance_status ??= ticket.status === 'completed' ? 'awaiting_acceptance' : 'not_ready';
          if (ticket.status === 'completed' && !ticket.acceptance_due_at) {
            const completed = new Date(ticket.completed_at?.replace(' ', 'T') ?? ticket.updated_at.replace(' ', 'T'));
            ticket.acceptance_due_at = iso(new Date(completed.getTime() + 48 * 60 * 60 * 1000));
          }
        });
        let changed = false;
        db.users.filter((u) => u.role === 'admin' && u.name === 'Admin Alice').forEach((u) => { u.name = 'Jia Ying'; changed = true; });
        db.tickets.forEach((ticket) => {
          if (ticket.acceptance_status === 'awaiting_acceptance' && ticket.acceptance_due_at && new Date(ticket.acceptance_due_at.replace(' ', 'T')).getTime() <= Date.now()) {
            ticket.acceptance_status = 'accepted';
            ticket.updated_at = iso(new Date());
            db.seq.log += 1;
            db.logs.push({ id: db.seq.log, ticket_id: ticket.id, from_status: 'completed', to_status: 'completed', actor_name: 'System', note: 'Automatically accepted after 48 hours without a resident response.', created_at: ticket.updated_at });
            changed = true;
          }
        });
        if (changed) save(db);
        return db;
      }
    }
  } catch {
    /* corrupted — reseed */
  }
  const db = buildSeed();
  save(db);
  return db;
}

function save(db: Db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

interface Actor {
  id: number;
  name: string;
  role: 'admin' | 'staff' | 'resident';
}

function currentActor(): Actor | null {
  try {
    const u = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as User | null;
    if (!u) return null;
    return { id: u.id, name: u.name, role: u.role };
  } catch {
    return null;
  }
}

function actorName(fallback = 'Administrator'): string {
  return currentActor()?.name ?? fallback;
}

function assertAdmin(actor: Actor | null): void {
  if (!actor || actor.role !== 'admin') throw new Error('This action requires an administrator account.');
}

function assertStaff(actor: Actor | null): User {
  if (!actor || actor.role !== 'staff') throw new Error('This action requires a staff account.');
  const db = load();
  const u = db.users.find((x) => x.id === actor.id && x.role === 'staff');
  if (!u) throw new Error('Staff account not found.');
  return u;
}

async function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Failed to read photo.'));
    r.readAsDataURL(f);
  });
}

// ---- zone + category auto-assignment --------------------------------------

function slaFor(db: Db, ticket: Ticket): number {
  return db.categories.find((c) => c.id === ticket.category_id)?.sla_hours ?? 48;
}

function dueFromSla(slaHours: number): string {
  return iso(new Date(Date.now() + slaHours * 3_600_000));
}

function staffForTask(db: Db, jobTag: string, zone: Ticket['zone']): User | undefined {
  return db.users.find((u) => u.role === 'staff' && u.duty_status === 'on_duty' && u.professions.includes(jobTag) && u.zones.includes(zone));
}

/**
 * Auto-assign a pending, unassigned ticket: staff whose zones cover the
 * ticket's zone AND whose professions cover the ticket's category.
 * Random tie-break among candidates (staff may cover both zones).
 */
function autoAssign(db: Db, t: Ticket): boolean {
  if (t.status !== 'pending' || t.assignee_id) return false;
  if (t.offered_staff_ids?.length) return false;
  const needed = CATEGORY_PROFESSIONS[t.category_code] ?? [];
  const candidates = db.users.filter(
    (u) =>
      u.role === 'staff' &&
      u.duty_status === 'on_duty' &&
      u.zones.includes(t.zone) &&
      u.professions.some((p) => needed.includes(p)),
  );
  if (!candidates.length) {
    const adminIsOffDuty = db.users.some((u) => u.role === 'admin' && u.duty_status === 'off_duty');
    if (t.category_code === 'others' && adminIsOffDuty && !t.is_public) {
      t.is_public = true;
      db.seq.log += 1;
      db.logs.push({ id: db.seq.log, ticket_id: t.id, from_status: 'pending', to_status: 'pending', actor_name: 'Auto-routing', note: 'Others category offered to the public staff pool because no admin is on duty.', created_at: iso(new Date()) });
      return true;
    }
    return false;
  }
  // Offer to every matching on-duty worker. The first accepted claim wins.
  t.offered_staff_ids = candidates.map((u) => u.id);
  t.auto_assigned = true;
  t.due_at = t.due_at ?? dueFromSla(slaFor(db, t));
  t.requests = [];
  db.seq.log += 1;
  db.logs.push({
    id: db.seq.log,
    ticket_id: t.id,
    from_status: 'pending',
    to_status: 'pending',
    actor_name: 'Auto-routing',
    note: `Ticket offered to ${candidates.map((u) => u.name).join(', ')} (zone ${t.zone} + ${t.category_name}); first acceptance claims it.`,
    created_at: iso(new Date()),
  });
  return true;
}

/** Re-derive the auto-assignee for an already-assigned auto ticket whose
 *  original staff no longer covers the zone; called after staff profile edits. */
export function rematchAutoTickets(db: Db, changedStaffId: number): void {
  db.tickets.forEach((t) => {
    if (t.auto_assigned && t.assignee_id === changedStaffId && t.status === 'pending') {
      const needed = CATEGORY_PROFESSIONS[t.category_code] ?? [];
      const candidates = db.users.filter(
        (u) =>
          u.role === 'staff' &&
          u.duty_status === 'on_duty' &&
          u.id !== changedStaffId &&
          u.zones.includes(t.zone) &&
          u.professions.some((p) => needed.includes(p)),
      );
      if (candidates.length) {
        const pick = candidates[0];
        t.assignee_id = pick.id;
        t.assignee_name = pick.name;
        db.seq.log += 1;
        db.logs.push({
          id: db.seq.log,
          ticket_id: t.id,
          from_status: 'pending',
          to_status: 'pending',
          actor_name: 'Auto-match',
          note: `Re-assigned to ${pick.name} — ${actorName('staff')} no longer covers zone ${t.zone}.`,
          created_at: iso(new Date()),
        });
      } else {
        t.assignee_id = null;
        t.assignee_name = null;
        db.seq.log += 1;
        db.logs.push({
          id: db.seq.log,
          ticket_id: t.id,
          from_status: 'pending',
          to_status: 'pending',
          actor_name: 'Auto-match',
          note: `Unassigned — no staff currently covers zone ${t.zone} + ${t.category_name}. Admin must assign manually.`,
          created_at: iso(new Date()),
        });
      }
    }
  });
}

function bundleOf(db: Db, id: number): TicketBundle {
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) throw new Error('Ticket not found.');
  const logs = db.logs
    .filter((l) => l.ticket_id === id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const rating = db.ratings.find((r) => r.ticket_id === id) ?? null;
  return { ticket, logs, rating };
}

function pushLog(db: Db, ticket: Ticket, from: Ticket['status'] | null, to: Ticket['status'], note: string, photos?: string[]) {
  db.seq.log += 1;
  db.logs.push({
    id: db.seq.log,
    ticket_id: ticket.id,
    from_status: from,
    to_status: to,
    actor_name: actorName(),
    note,
    photo_urls: photos,
    created_at: iso(new Date()),
  });
}

function relayDescription(tasks: string[]): string {
  return tasks.length ? ` Relay sequence created: ${tasks.join(' → ')}.` : '';
}

function newRequest(db: Db, t: Ticket, type: RequestType, extra: Partial<TicketRequest>): TicketRequest {
  const actor = currentActor();
  db.seq.request += 1;
  const req: TicketRequest = {
    id: db.seq.request,
    type,
    from_staff_id: actor?.id ?? 0,
    from_staff_name: actor?.name ?? 'Staff',
    status: 'pending',
    created_at: iso(new Date()),
    ...extra,
  };
  t.requests = [...(t.requests ?? []), req];
  return req;
}

// ---- staff-visible / admin-visible scoping --------------------------------

function staffCanSee(db: Db, t: Ticket, staff: User): boolean {
  if (t.assignee_id === staff.id || t.co_assignee_id === staff.id) return true;
  if (staff.duty_status !== 'on_duty') return false;
  if (t.offered_staff_ids?.includes(staff.id)) return true;
  if (t.is_public && !t.assignee_id) return true;
  void db;
  return false;
}

export const mockApi = {
  async login(email: string, password: string): Promise<LoginResult> {
    const db = load();
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || password !== 'password123') {
      throw new Error('Invalid email or password.');
    }
    if (user.role === 'resident') {
      throw new Error('Residents sign in from the mobile app.');
    }
    return { ...user, token: `mock-jwt-${user.id}-${Date.now()}` };
  },

  async listStaff(): Promise<User[]> {
    return load().users.filter((u) => u.role === 'staff');
  },

  async addStaff(payload: NewStaffPayload): Promise<User> {
    const db = load();
    assertAdmin(currentActor());
    if (!payload.name.trim() || !payload.email.trim() || !payload.password) {
      throw new Error('Name, email and password are required.');
    }
    if (db.users.some((u) => u.email.toLowerCase() === payload.email.trim().toLowerCase())) {
      throw new Error('That email is already registered.');
    }
    const id = Math.max(0, ...db.users.map((u) => u.id)) + 1;
    const user: User = {
      id,
      name: payload.name.trim(),
      email: payload.email.trim(),
      phone: payload.phone?.trim() || undefined,
      role: 'staff',
      professions: payload.professions,
      zones: payload.zones,
    };
    db.users.push(user);
    save(db);
    return user;
  },

  /** Staff edits their own professions / zones; admin edits anyone. */
  async updateStaff(id: number, patch: import('../../models').StaffPatch): Promise<User> {
    const db = load();
    const actor = currentActor();
    const target = db.users.find((u) => u.id === id && u.role === 'staff');
    if (!target) throw new Error('Staff not found.');
    if (!actor || (actor.role !== 'admin' && actor.id !== id)) {
      throw new Error('You can only edit your own profile.');
    }
    if (patch.professions) target.professions = patch.professions;
    if (patch.zones) target.zones = patch.zones;
    if (patch.name !== undefined) target.name = patch.name.trim();
    if (patch.email !== undefined) {
      const nextEmail = patch.email.trim().toLowerCase();
      if (!nextEmail.includes('@') || db.users.some((u) => u.id !== id && u.email.toLowerCase() === nextEmail)) throw new Error('Enter a valid, unused email address.');
      target.email = patch.email.trim();
    }
    if (patch.phone !== undefined) target.phone = patch.phone.trim();
    rematchAutoTickets(db, id);
    save(db);
    return target;
  },

  async deleteStaff(id: number): Promise<void> {
    const db = load();
    assertAdmin(currentActor());
    const index = db.users.findIndex((u) => u.id === id && u.role === 'staff');
    if (index < 0) throw new Error('Staff not found.');
    db.tickets.forEach((ticket) => {
      if (ticket.assignee_id === id || ticket.co_assignee_id === id) {
        ticket.assignee_id = null;
        ticket.assignee_name = null;
        ticket.co_assignee_id = null;
        ticket.co_assignee_name = null;
        if (ticket.status === 'accepted' || ticket.status === 'in_progress') ticket.status = 'pending';
        ticket.offered_staff_ids = [];
      }
      ticket.work_tasks = (ticket.work_tasks ?? []).map((task) => task.assignee_id === id
        ? { ...task, assignee_id: null, assignee_name: null, task_status: 'queued' }
        : task);
    });
    db.users.splice(index, 1);
    save(db);
  },

  async updateDutyStatus(id: number, dutyStatus: DutyStatus): Promise<User> {
    const db = load();
    const actor = currentActor();
    const target = db.users.find((u) => u.id === id && (u.role === 'staff' || u.role === 'admin'));
    if (!target) throw new Error('Account not found.');
    if (!actor || (actor.role !== 'admin' && actor.id !== id)) throw new Error('You can only update your own duty status.');
    target.duty_status = dutyStatus;
    if (target.role === 'admin' && dutyStatus === 'on_duty') db.tickets.forEach((ticket) => {
      if (ticket.status === 'pending' && ticket.category_code === 'others' && !ticket.assignee_id) ticket.is_public = false;
    });
    if (dutyStatus === 'off_duty') {
      db.tickets.forEach((ticket) => {
        if (ticket.status === 'pending' && !ticket.assignee_id) ticket.offered_staff_ids = (ticket.offered_staff_ids ?? []).filter((staffId) => staffId !== id);
      });
    } else {
      db.tickets.forEach((ticket) => { if (ticket.status === 'pending' && !ticket.assignee_id) ticket.offered_staff_ids = []; });
    }
    db.tickets.forEach((ticket) => {
      if (ticket.status === 'in_progress' && !ticket.assignee_id) {
        const waiting = (ticket.work_tasks ?? []).find((task) => task.task_status === 'queued' || task.task_status === 'ready');
        const worker = waiting ? staffForTask(db, waiting.task_code, ticket.zone) : undefined;
        if (waiting && worker) {
          waiting.task_status = 'in_progress'; waiting.assignee_id = worker.id; waiting.assignee_name = worker.name;
          ticket.assignee_id = worker.id; ticket.assignee_name = worker.name;
          ticket.admin_attention = false; ticket.admin_attention_reason = null;
        }
      }
    });
    db.tickets.forEach((ticket) => { if (ticket.status === 'pending' && !ticket.assignee_id) autoAssign(db, ticket); });
    save(db);
    return target;
  },

  async listCategories(): Promise<Category[]> {
    return load().categories;
  },

  async listTickets(filter: TicketFilter): Promise<Ticket[]> {
    const db = load();
    const actor = currentActor();
    let list = db.tickets;

    // auto-match on read: pending unassigned tickets get their zone+category staff
    let mutated = false;
    list.forEach((t) => {
      if (autoAssign(db, t)) mutated = true;
    });
    if (mutated) save(db);

    if (actor?.role === 'staff') {
      const me = db.users.find((u) => u.id === actor.id);
      if (me) list = list.filter((t) => staffCanSee(db, t, me));
    }

    const q = (filter.search ?? '').trim().toLowerCase();
    list = list.filter((t) => {
      if (filter.status && t.status !== filter.status) return false;
      if (filter.category_id && t.category_id !== filter.category_id) return false;
      if (filter.priority && t.priority !== filter.priority) return false;
      if (filter.zone && t.zone !== filter.zone) return false;
      if (filter.assignee_id && t.assignee_id !== filter.assignee_id) return false;
      if (filter.scope === 'unassigned' && (t.status !== 'pending' || t.assignee_id || t.is_public || t.offered_staff_ids?.length)) return false;
      if (filter.scope === 'own' && t.assignee_id !== actor?.id) return false;
      if (q) {
        const hay = `${t.ticket_no} ${t.title} ${t.location_desc} ${t.resident_name} ${t.category_name} ${t.zone} ${t.assignee_name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      if (pr !== 0) return pr;
      return b.created_at.localeCompare(a.created_at);
    });
  },

  /** Count of pending tickets without an assignee — feeds the red badge. */
  async unassignedCount(): Promise<number> {
    const db = load();
    return db.tickets.filter((t) => t.status === 'pending' && !t.assignee_id && !t.is_public && !t.offered_staff_ids?.length).length;
  },

  async getTicket(id: number): Promise<TicketBundle> {
    return bundleOf(load(), id);
  },

  // ---- triage actions ------------------------------------------------------

  async acceptTicket(id: number): Promise<TicketBundle> {
    const db = load();
    const actor = currentActor();
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'pending') throw new Error(`Only pending tickets can be accepted (current: ${t.status}).`);
    if (actor?.role === 'staff') {
      const worker = db.users.find((u) => u.id === actor.id);
      if (worker?.duty_status !== 'on_duty') throw new Error('You are Off Duty and cannot accept tickets.');
      if (t.assignee_id && t.assignee_id !== actor.id) throw new Error('This ticket has already been claimed by another staff member.');
      if (t.offered_staff_ids?.length && !t.offered_staff_ids.includes(actor.id)) throw new Error('This ticket was not offered to your job tag and zone.');
      if (!t.assignee_id) {
        // First staff member to accept claims the offer or public-pool ticket.
      t.assignee_id = actor.id;
      t.assignee_name = actor.name;
      t.auto_assigned = false;
      }
    } else {
      assertAdmin(actor);
      if (!t.assignee_id) throw new Error('Assign a staff member before accepting this ticket.');
    }
    const winner = t.assignee_id;
    t.offered_staff_ids = [];
    if (winner) t.assignee_name = db.users.find((u) => u.id === winner)?.name ?? t.assignee_name;
    const at = iso(new Date());
    t.status = 'accepted';
    t.offered_staff_ids = [];
    t.accepted_at = at;
    t.updated_at = at;
    t.due_at = t.due_at ?? dueFromSla(slaFor(db, t));
    pushLog(db, t, 'pending', 'accepted', 'Ticket accepted — confirmed within community jurisdiction.');
    save(db);
    return bundleOf(db, id);
  },

  /** Admin forces the staff to accept (Pending -> Accepted, keep assignee). */
  async forceAccept(id: number): Promise<TicketBundle> {
    const db = load();
    assertAdmin(currentActor());
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'pending') throw new Error(`Only pending tickets can be force-accepted (current: ${t.status}).`);
    if (!t.assignee_id) throw new Error('Assign a staff member first, then force-accept.');
    const at = iso(new Date());
    t.status = 'accepted';
    t.offered_staff_ids = [];
    t.accepted_at = at;
    t.updated_at = at;
    t.due_at = t.due_at ?? dueFromSla(slaFor(db, t));
    // clear any pending reject_review request from the staff
    (t.requests ?? []).forEach((r) => {
      if (r.type === 'reject_review' && r.status === 'pending') r.status = 'rejected';
    });
    pushLog(db, t, 'pending', 'accepted', `Admin forced ${t.assignee_name} to accept this ticket.`);
    save(db);
    return bundleOf(db, id);
  },

  async assignTicket(id: number, payload: AssignPayload): Promise<TicketBundle> {
    const db = load();
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'pending' && t.status !== 'accepted' && t.status !== 'in_progress') {
      throw new Error(`This ticket cannot be assigned in its current state (${t.status}).`);
    }
    const staff = db.users.find((u) => u.id === payload.assignee_id && u.role === 'staff');
    if (!staff) throw new Error('Selected maintenance staff was not found.');
    if (staff.duty_status !== 'on_duty') throw new Error('Selected staff member is Off Duty.');
    if (!payload.due_at) throw new Error('A target completion time (due_at) is required.');
    const at = iso(new Date());
    const from = t.status as 'pending' | 'accepted' | 'in_progress';
    t.status = from === 'pending' ? 'accepted' : 'in_progress';
    t.assignee_id = staff.id;
    t.assignee_name = staff.name;
    t.auto_assigned = false;
    t.is_public = false;
    if (payload.priority) t.priority = payload.priority;
    if (payload.due_at) t.due_at = payload.due_at;
    t.work_tasks ??= [];
    if (t.status === 'in_progress' && !t.work_tasks.some((task) => task.task_status === 'in_progress')) {
      t.work_tasks.push({ id: Math.max(0, ...t.work_tasks.map((task) => task.id)) + 1, task_code: 'primary', task_label: 'Primary repair', sequence_no: 1, task_status: 'in_progress', assignee_id: staff.id, assignee_name: staff.name });
    }
    t.updated_at = at;
    pushLog(db, t, from, t.status, `Assigned to ${staff.name} (priority: ${t.priority}, due by ${t.due_at}).${payload.note ? ' ' + payload.note : ''}`);
    save(db);
    return bundleOf(db, id);
  },

  /** Admin: edit the responsible staff / target / priority / note (Pending). */
  async editTicket(id: number, payload: EditTicketPayload): Promise<TicketBundle> {
    const db = load();
    assertAdmin(currentActor());
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    const changes: string[] = [];
    if (payload.assignee_id != null) {
      const staff = db.users.find((u) => u.id === payload.assignee_id && u.role === 'staff');
      if (!staff) throw new Error('Selected staff was not found.');
      if (staff.duty_status !== 'on_duty') throw new Error('Selected staff member is Off Duty.');
      if (t.assignee_id !== staff.id) {
        changes.push(`assignee → ${staff.name}`);
        t.assignee_id = staff.id;
        t.assignee_name = staff.name;
        t.auto_assigned = false;
        t.is_public = false;
      }
    }
    if (payload.due_at != null && payload.due_at !== t.due_at) {
      t.due_at = payload.due_at;
      changes.push(`target completion → ${payload.due_at}`);
    }
    if (payload.priority && payload.priority !== t.priority) {
      t.priority = payload.priority;
      changes.push(`priority → ${payload.priority}`);
    }
    t.updated_at = iso(new Date());
    pushLog(db, t, t.status, t.status, `Admin edited ticket: ${changes.join('; ') || 'no field changed'}.${payload.note ? ' ' + payload.note : ''}`);
    save(db);
    return bundleOf(db, id);
  },

  async startTicket(id: number): Promise<TicketBundle> {
    const db = load();
    const actor = currentActor();
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'accepted') throw new Error(`Only accepted tickets can start (current: ${t.status}).`);
    if (!t.assignee_id) throw new Error('Assign a staff member before starting.');
    if (actor?.role === 'staff' && t.assignee_id !== actor.id) throw new Error('Only the assigned staff member can start this ticket.');
    const at = iso(new Date());
    const from = t.status as 'accepted';
    t.status = 'in_progress';
    const taskId = Math.max(0, ...(t.work_tasks ?? []).map((task) => task.id)) + 1;
    t.work_tasks ??= [];
    t.work_tasks.push({ id: taskId, task_code: 'primary', task_label: 'Primary repair', sequence_no: 1, task_status: 'in_progress', assignee_id: t.assignee_id, assignee_name: t.assignee_name });
    t.due_at = t.due_at ?? dueFromSla(slaFor(db, t));
    t.updated_at = at;
    pushLog(db, t, from, 'in_progress', 'Work started — resolving the issue.');
    save(db);
    return bundleOf(db, id);
  },

  async callForSupport(id: number, helperId: number, reason: string): Promise<TicketBundle> {
    const db = load();
    const worker = assertStaff(currentActor());
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'in_progress' || t.assignee_id !== worker.id) throw new Error('Only the assigned staff member can call for support on an in-progress ticket.');
    if (!reason.trim()) throw new Error('Explain what prerequisite work is needed.');
    const active = (t.work_tasks ?? []).find((task) => task.task_status === 'in_progress');
    if (!active) throw new Error('There is no active work task to block.');
    const helper = db.users.find((u) => u.id === helperId && u.role === 'staff' && u.duty_status === 'on_duty' && u.zones.includes(t.zone));
    if (!helper) throw new Error('Selected colleague is not On Duty or does not cover this ticket zone.');
    const supportId = Math.max(0, ...(t.work_tasks ?? []).map((task) => task.id)) + 1;
    active.task_status = 'blocked';
    active.blocked_by_task_id = supportId;
    t.work_tasks ??= [];
    t.work_tasks.push({ id: supportId, task_code: helper.professions[0] ?? 'support', task_label: `${helper.name} prerequisite support`, sequence_no: active.sequence_no, task_status: 'in_progress', assignee_id: helper.id, assignee_name: helper.name });
    t.handoff_count = (t.handoff_count ?? 0) + 1;
    t.assignee_id = helper.id;
    t.assignee_name = helper.name;
    if ((t.handoff_count ?? 0) > 3) {
      t.admin_attention = true;
      t.admin_attention_reason = 'More than three staff handoffs; admin coordination required.';
    }
    t.updated_at = iso(new Date());
    pushLog(db, t, 'in_progress', 'in_progress', `Support requested by ${worker.name}: ${reason.trim()}. Assigned to ${helper.name}.`);
    save(db);
    return bundleOf(db, id);
  },

  async completeTicket(id: number, payload: CompletePayload): Promise<TicketBundle> {
    const db = load();
    const actor = currentActor();
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'in_progress') throw new Error(`Only in-progress tickets can be completed (current: ${t.status}).`);
    if (!payload.photos.length) throw new Error('Upload at least one after-repair photo before completing the task.');
    if (payload.photos.length > 3) throw new Error('Upload no more than three after-repair photos.');
    const at = iso(new Date());
    const photos: string[] = [];
    for (const f of payload.photos) photos.push(await fileToDataUrl(f));
    let active = (t.work_tasks ?? []).find((task) => task.task_status === 'in_progress');
    if (!active) {
      const activeId = Math.max(0, ...(t.work_tasks ?? []).map((task) => task.id)) + 1;
      active = { id: activeId, task_code: 'primary', task_label: 'Primary repair', sequence_no: 1, task_status: 'in_progress', assignee_id: t.assignee_id, assignee_name: t.assignee_name };
      t.work_tasks ??= [];
      t.work_tasks.push(active);
    }
    if (actor?.role === 'staff' && active.assignee_id !== actor.id) throw new Error('Only the active task assignee can complete this work.');
    active.task_status = 'completed';
    const workTasks = t.work_tasks ?? [];
    const waitingForThis = workTasks.find((task) => task.task_status === 'blocked' && task.blocked_by_task_id === active!.id);
    if (waitingForThis) {
      waitingForThis.task_status = 'in_progress';
      waitingForThis.blocked_by_task_id = null;
      t.assignee_id = waitingForThis.assignee_id ?? null;
      t.assignee_name = waitingForThis.assignee_name ?? null;
    } else {
      const relay = payload.relay_tasks ?? [];
      const nextId = Math.max(0, ...workTasks.map((task) => task.id)) + 1;
      relay.forEach((code, index) => {
        workTasks.push({ id: nextId + index, task_code: code, task_label: code === 'cleaner' ? 'Cleaning / mopping' : 'Masonry / odd-job', sequence_no: active!.sequence_no + index + 1, task_status: 'queued', blocked_by_task_id: index ? nextId + index - 1 : null });
      });
      t.handoff_count = (t.handoff_count ?? 0) + relay.length;
      if ((t.handoff_count ?? 0) > 3) {
        t.admin_attention = true;
        t.admin_attention_reason = 'More than three staff handoffs; admin coordination required.';
      }
      const pendingTask = workTasks.filter((task) => task.task_status === 'queued' || task.task_status === 'ready').sort((a, b) => a.sequence_no - b.sequence_no)[0];
      if (pendingTask) {
        const nextWorker = staffForTask(db, pendingTask.task_code, t.zone);
        if (nextWorker) {
          pendingTask.task_status = 'in_progress';
          pendingTask.assignee_id = nextWorker.id;
          pendingTask.assignee_name = nextWorker.name;
          t.assignee_id = nextWorker.id;
          t.assignee_name = nextWorker.name;
          t.admin_attention = false;
          t.admin_attention_reason = null;
        } else {
          t.assignee_id = null;
          t.assignee_name = null;
          t.admin_attention = true;
          t.admin_attention_reason = `No on-duty staff member matches relay job ${pendingTask.task_code}.`;
        }
      } else {
        t.status = 'completed';
        t.completed_at = at;
        t.acceptance_status = 'awaiting_acceptance';
        t.acceptance_due_at = iso(new Date(Date.now() + 48 * 60 * 60 * 1000));
        t.assignee_id = null;
        t.assignee_name = null;
      }
    }
    t.updated_at = at;
    pushLog(db, t, 'in_progress', t.status, `${payload.note?.trim() || 'Work completed.'}${relayDescription(payload.relay_tasks ?? [])}`, photos);
    save(db);
    return bundleOf(db, id);
  },

  async rejectTicket(id: number, payload: RejectPayload): Promise<TicketBundle> {
    const db = load();
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'pending' && t.status !== 'accepted') {
      throw new Error(`Only pending or accepted tickets can be rejected (current: ${t.status}).`);
    }
    if (!payload.reason.trim()) throw new Error('A rejection reason is required.');
    const at = iso(new Date());
    const from = t.status as 'pending' | 'accepted';
    t.status = 'rejected';
    t.reject_reason = payload.reason.trim();
    t.updated_at = at;
    (t.requests ?? []).forEach((r) => {
      if (r.type === 'reject_review' && r.status === 'pending') r.status = 'approved';
    });
    pushLog(db, t, from, 'rejected', `Rejected: ${payload.reason.trim()}`);
    save(db);
    return bundleOf(db, id);
  },

  // ---- staff requests -> admin approvals ------------------------------------

  /** Staff asks the admin to review their rejection. */
  async requestRejectReview(id: number, reason: string): Promise<TicketBundle> {
    const db = load();
    const staff = assertStaff(currentActor());
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.assignee_id !== staff.id) throw new Error('Only the responsible staff can reject.');
    if (t.status !== 'pending' && t.status !== 'accepted') {
      throw new Error(`Only pending or accepted tickets can be rejected (current: ${t.status}).`);
    }
    if (!reason.trim()) throw new Error('A rejection reason is required.');
    newRequest(db, t, 'reject_review', { reason: reason.trim() });
    t.updated_at = iso(new Date());
    pushLog(db, t, t.status, t.status, `${staff.name} requested rejection: ${reason.trim()} — waiting for admin review.`);
    save(db);
    return bundleOf(db, id);
  },

  /** Staff pulls a co-worker in; the co-worker joins only after admin approval. */
  async requestCoWorker(id: number, toStaffId: number, reason?: string): Promise<TicketBundle> {
    const db = load();
    const staff = assertStaff(currentActor());
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'accepted' && t.status !== 'in_progress') {
      throw new Error(`Co-workers can be requested only on accepted or in-progress tickets (current: ${t.status}).`);
    }
    const to = db.users.find((u) => u.id === toStaffId && u.role === 'staff');
    if (!to) throw new Error('Selected staff was not found.');
    if (to.id === staff.id) throw new Error('You cannot pull yourself in.');
    newRequest(db, t, 'co_worker', { to_staff_id: to.id, to_staff_name: to.name, reason: reason?.trim() || null });
    t.updated_at = iso(new Date());
    pushLog(db, t, t.status, t.status, `${staff.name} requested ${to.name} to work together on this ticket — waiting for admin approval.`);
    save(db);
    return bundleOf(db, id);
  },

  async requestMoreTime(id: number, newDueAt: string, reason?: string): Promise<TicketBundle> {
    const db = load();
    const staff = assertStaff(currentActor());
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'in_progress') throw new Error(`More time can be requested only on in-progress tickets (current: ${t.status}).`);
    if (!newDueAt) throw new Error('A new target completion time is required.');
    newRequest(db, t, 'more_time', { new_due_at: newDueAt, reason: reason?.trim() || null });
    t.updated_at = iso(new Date());
    pushLog(db, t, t.status, t.status, `${staff.name} requested an extension to ${newDueAt} — waiting for admin approval.`);
    save(db);
    return bundleOf(db, id);
  },

  async requestReassign(id: number, reason: string): Promise<TicketBundle> {
    const db = load();
    const staff = assertStaff(currentActor());
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'in_progress') throw new Error(`A reassignment can be requested only on in-progress tickets (current: ${t.status}).`);
    if (!reason.trim()) throw new Error('A reason is required.');
    newRequest(db, t, 'reassign', { reason: reason.trim() });
    t.updated_at = iso(new Date());
    pushLog(db, t, t.status, t.status, `${staff.name} asked to be replaced: ${reason.trim()} — waiting for admin review.`);
    save(db);
    return bundleOf(db, id);
  },

  async requestCancel(id: number, reason: string): Promise<TicketBundle> {
    const db = load();
    const staff = assertStaff(currentActor());
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'in_progress') throw new Error(`Cancellation can be requested only on in-progress tickets (current: ${t.status}).`);
    if (!reason.trim()) throw new Error('A reason is required.');
    newRequest(db, t, 'cancel', { reason: reason.trim() });
    t.updated_at = iso(new Date());
    pushLog(db, t, t.status, t.status, `${staff.name} requested cancellation: ${reason.trim()} — waiting for admin review.`);
    save(db);
    return bundleOf(db, id);
  },

  /** Approve a staff request. co_worker adds the co-assignee, reject_review
   *  rejects the ticket; more_time shifts the due date. */
  async approveRequest(ticketId: number, requestId: number): Promise<TicketBundle> {
    const db = load();
    assertAdmin(currentActor());
    const t = db.tickets.find((x) => x.id === ticketId);
    if (!t) throw new Error('Ticket not found.');
    const req = (t.requests ?? []).find((r) => r.id === requestId && r.status === 'pending');
    if (!req) throw new Error('Request not found or already handled.');
    req.status = 'approved';
    const who = req.from_staff_name;
    switch (req.type) {
      case 'co_worker':
        t.co_assignee_id = req.to_staff_id ?? null;
        t.co_assignee_name = req.to_staff_name ?? null;
        pushLog(db, t, t.status, t.status, `Admin approved ${who}'s request — ${req.to_staff_name} now works together on this ticket.`);
        break;
      case 'reject_review':
        t.status = 'rejected';
        t.reject_reason = req.reason ?? 'Rejected after staff request review.';
        t.updated_at = iso(new Date());
        pushLog(db, t, 'pending', 'rejected', `Admin approved ${who}'s rejection: ${req.reason ?? ''}`);
        break;
      case 'more_time':
        t.due_at = req.new_due_at ?? t.due_at;
        t.updated_at = iso(new Date());
        pushLog(db, t, t.status, t.status, `Admin approved the extension — target completion moved to ${t.due_at}.`);
        break;
      case 'reassign': {
        const from = t.status;
        t.assignee_id = null;
        t.assignee_name = null;
        t.co_assignee_id = null;
        t.co_assignee_name = null;
        t.auto_assigned = false;
        t.is_public = false;
        t.status = 'pending';
        t.updated_at = iso(new Date());
        pushLog(db, t, from, 'pending', `Admin approved ${who}'s change-of-staff request — ticket is unassigned for the admin to place.`);
        break;
      }
      case 'cancel': {
        const from = t.status;
        t.status = 'cancelled';
        t.cancelled_reason = req.reason ?? 'Cancelled after staff request.';
        t.cancelled_at = iso(new Date());
        t.updated_at = t.cancelled_at;
        pushLog(db, t, from, 'cancelled', `Admin approved ${who}'s cancellation: ${req.reason ?? ''}`);
        break;
      }
      default:
        pushLog(db, t, t.status, t.status, `Admin approved ${who}'s ${req.type} request.`);
    }
    t.updated_at = iso(new Date());
    save(db);
    return bundleOf(db, ticketId);
  },

  async rejectRequest(ticketId: number, requestId: number): Promise<TicketBundle> {
    const db = load();
    assertAdmin(currentActor());
    const t = db.tickets.find((x) => x.id === ticketId);
    if (!t) throw new Error('Ticket not found.');
    const req = (t.requests ?? []).find((r) => r.id === requestId && r.status === 'pending');
    if (!req) throw new Error('Request not found or already handled.');
    req.status = 'rejected';
    if (req.type === 'reject_review') {
      // admin disagrees with the staff's rejection — ticket stays with them
      pushLog(db, t, t.status, t.status, `Admin declined ${req.from_staff_name}'s rejection — the ticket stays assigned to them.`);
    } else {
      pushLog(db, t, t.status, t.status, `Admin declined ${req.from_staff_name}'s ${req.type} request.`);
    }
    t.updated_at = iso(new Date());
    save(db);
    return bundleOf(db, ticketId);
  },

  /** All pending staff requests across all tickets (admin inbox). */
  async listRequests(): Promise<{ ticket_id: number; ticket_no: string; ticket_title: string; request: TicketRequest }[]> {
    const db = load();
    assertAdmin(currentActor());
    const out: { ticket_id: number; ticket_no: string; ticket_title: string; request: TicketRequest }[] = [];
    db.tickets.forEach((t) => {
      (t.requests ?? [])
        .filter((r) => r.status === 'pending')
        .forEach((r) => out.push({ ticket_id: t.id, ticket_no: t.ticket_no, ticket_title: t.title, request: r }));
    });
    return out.sort((a, b) => b.request.created_at.localeCompare(a.request.created_at));
  },

  /** Staff: drop an assigned ticket back into the public pool (admin action). */
  async releaseToPool(id: number): Promise<TicketBundle> {
    const db = load();
    assertAdmin(currentActor());
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'pending' && t.status !== 'accepted') {
      throw new Error('Only pending or accepted tickets can be released to the pool.');
    }
    const from = t.status;
    t.assignee_id = null;
    t.assignee_name = null;
    t.co_assignee_id = null;
    t.co_assignee_name = null;
    t.auto_assigned = false;
    t.is_public = true;
    t.status = 'pending';
    t.updated_at = iso(new Date());
    pushLog(db, t, from, 'pending', 'Admin released the ticket to the public pool — any staff can take it.');
    save(db);
    return bundleOf(db, id);
  },

  async getStats(): Promise<Stats> {
    const db = load();
    return computeStatsFor(db.tickets, db.categories, db.ratings);
  },

  async resetDemo(): Promise<void> {
    localStorage.removeItem(DB_KEY);
  },
};
