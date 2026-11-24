// Mock implementation of the admin API contract (see admin-api-spec.md).
// The seed database simulates "what the resident app submits" (persisted in
// localStorage). Demo tickets from the Test Data page live in a separate
// store and are merged by api/index.ts.

import type {
  AssignPayload,
  Category,
  CompletePayload,
  LoginResult,
  RejectPayload,
  Stats,
  Ticket,
  TicketBundle,
  TicketFilter,
  User,
} from '../../models';
import { USER_KEY } from '../keys';
import { computeStatsFor } from '../stats';
import { listZones, matchZone } from '../zones';
import { Db, buildSeed, iso } from './db';

const DB_KEY = 'cst_admin_mock_db_v1';

const PRIORITY_RANK: Record<string, number> = { urgent: 3, normal: 2, low: 1 };

function load(): Db {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as Db;
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

function currentActor(): string {
  try {
    const u = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as User | null;
    return u?.name ?? 'Administrator';
  } catch {
    return 'Administrator';
  }
}

/** Decorate a ticket with the zone auto-assignee (derived, never persisted). */
function withZone(t: Ticket, users: User[]): Ticket {
  if (t.assignee_id) return t; // a manual assignment always wins
  const zone = matchZone(t.location_desc, listZones());
  if (!zone) return t;
  const staff = users.find((u) => u.id === zone.staff_id && u.role === 'staff');
  if (!staff) return t;
  return { ...t, zone_name: zone.name, zone_staff_id: staff.id, assignee_name: staff.name };
}

async function fileToDataUrl(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Failed to read photo.'));
    r.readAsDataURL(f);
  });
}

function bundleOf(db: Db, id: number): TicketBundle {
  const raw = db.tickets.find((t) => t.id === id);
  if (!raw) throw new Error('Ticket not found.');
  const ticket = withZone(raw, db.users);
  const logs = db.logs
    .filter((l) => l.ticket_id === id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const rating = db.ratings.find((r) => r.ticket_id === id) ?? null;
  return { ticket, logs, rating };
}

export const mockApi = {
  async login(email: string, password: string): Promise<LoginResult> {
    const db = load();
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || password !== 'password123') {
      throw new Error('Invalid email or password.');
    }
    if (user.role !== 'admin') {
      throw new Error('This account is not an administrator. Use the resident app instead.');
    }
    return { ...user, token: `mock-jwt-${user.id}-${Date.now()}` };
  },

  async listStaff(): Promise<User[]> {
    return load().users.filter((u) => u.role === 'staff');
  },

  async listCategories(): Promise<Category[]> {
    return load().categories;
  },

  async listTickets(filter: TicketFilter): Promise<Ticket[]> {
    const db = load();
    const q = (filter.search ?? '').trim().toLowerCase();
    const list = db.tickets.filter((t) => {
      if (filter.status && t.status !== filter.status) return false;
      if (filter.category_id && t.category_id !== filter.category_id) return false;
      if (filter.priority && t.priority !== filter.priority) return false;
      if (q) {
        const hay = `${t.ticket_no} ${t.title} ${t.location_desc} ${t.resident_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // Pool default order: priority first, then newest.
    return list
      .map((t) => withZone(t, db.users))
      .sort((a, b) => {
        const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        if (pr !== 0) return pr;
        return b.created_at.localeCompare(a.created_at);
      });
  },

  async getTicket(id: number): Promise<TicketBundle> {
    return bundleOf(load(), id);
  },

  async acceptTicket(id: number): Promise<TicketBundle> {
    const db = load();
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'pending') throw new Error(`Only pending tickets can be accepted (current: ${t.status}).`);
    const at = iso(new Date());
    t.status = 'accepted';
    t.accepted_at = at;
    t.updated_at = at;
    db.seq.log += 1;
    db.logs.push({
      id: db.seq.log,
      ticket_id: id,
      from_status: 'pending',
      to_status: 'accepted',
      actor_name: currentActor(),
      note: 'Ticket accepted — confirmed within community jurisdiction.',
      created_at: at,
    });
    save(db);
    return bundleOf(db, id);
  },

  async assignTicket(id: number, payload: AssignPayload): Promise<TicketBundle> {
    const db = load();
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'accepted' && t.status !== 'in_progress') {
      throw new Error(`Only accepted tickets can be assigned (current: ${t.status}).`);
    }
    const staff = db.users.find((u) => u.id === payload.assignee_id && u.role === 'staff');
    if (!staff) throw new Error('Selected maintenance staff was not found.');
    if (!payload.due_at) throw new Error('A target completion time (due_at) is required.');
    const at = iso(new Date());
    const from = t.status as 'accepted' | 'in_progress';
    t.status = 'in_progress';
    t.assignee_id = staff.id;
    t.assignee_name = staff.name;
    t.priority = payload.priority;
    t.due_at = payload.due_at;
    t.updated_at = at;
    db.seq.log += 1;
    db.logs.push({
      id: db.seq.log,
      ticket_id: id,
      from_status: from,
      to_status: 'in_progress',
      actor_name: currentActor(),
      note: `Assigned to ${staff.name} (priority: ${payload.priority}, due by ${payload.due_at}).${payload.note ? ' ' + payload.note : ''}`,
      created_at: at,
    });
    save(db);
    return bundleOf(db, id);
  },

  async completeTicket(id: number, payload: CompletePayload): Promise<TicketBundle> {
    const db = load();
    const t = db.tickets.find((x) => x.id === id);
    if (!t) throw new Error('Ticket not found.');
    if (t.status !== 'in_progress') throw new Error(`Only in-progress tickets can be completed (current: ${t.status}).`);
    if (payload.photos.length > 3) throw new Error('At most 3 completion photos.');
    const at = iso(new Date());
    const photos: string[] = [];
    for (const f of payload.photos) photos.push(await fileToDataUrl(f));
    t.status = 'completed';
    t.completed_at = at;
    t.updated_at = at;
    db.seq.log += 1;
    db.logs.push({
      id: db.seq.log,
      ticket_id: id,
      from_status: 'in_progress',
      to_status: 'completed',
      actor_name: currentActor(),
      note: payload.note?.trim() || 'Work completed.',
      photo_urls: photos,
      created_at: at,
    });
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
    db.seq.log += 1;
    db.logs.push({
      id: db.seq.log,
      ticket_id: id,
      from_status: from,
      to_status: 'rejected',
      actor_name: currentActor(),
      note: `Rejected: ${payload.reason.trim()}`,
      created_at: at,
    });
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
