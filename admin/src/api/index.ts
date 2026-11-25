// Single entry point composing the base API (mock until P1's endpoints are
// live, real afterwards) with the demo-data overlay.
//
// Overlay rules:
//  - demo tickets (Test Data page) are merged into list/statistics reads;
//  - triage actions on a demo ticket are simulated locally and NEVER sent to
//    the server, so real data submitted from the resident app is untouched;
//  - in mock mode the seed db plays the role of "resident-submitted data".
//  - staff logins only ever see tickets they are responsible for (or the
//    public pool); admins see everything.

import type {
  AssignPayload,
  CompletePayload,
  DutyStatus,
  EditTicketPayload,
  LoginResult,
  NewStaffPayload,
  RejectPayload,
  Stats,
  StaffPatch,
  Ticket,
  TicketBundle,
  TicketFilter,
  TicketRequest,
} from '../models';
import { USE_MOCK } from './config';
import { CATEGORY_PROFESSIONS } from './professions';
import {
  clearDemoTickets,
  demoAccept,
  demoAssign,
  demoComplete,
  demoCallForSupport,
  demoEdit,
  demoRelease,
  demoReject,
  demoStart,
  getDemoBundle,
  isDemoTicket,
  listDemoTickets,
  routeDemoTicket,
} from './demo';
import { mockApi } from './mock/mockApi';
import { realApi } from './realApi';
import { computeStatsFor } from './stats';

const base = USE_MOCK ? mockApi : realApi;

const PRIORITY_RANK: Record<string, number> = { urgent: 3, normal: 2, low: 1 };

function sortPool(list: Ticket[]): Ticket[] {
  return list.sort((a, b) => {
    const pr = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (pr !== 0) return pr;
    return b.created_at.localeCompare(a.created_at);
  });
}

/** Staff scoping applied after the demo merge (client-side for both modes). */
function scopeForStaff(list: Ticket[], staffId: number): Ticket[] {
  return list.filter(
    (t) =>
      t.assignee_id === staffId ||
      t.co_assignee_id === staffId ||
      t.offered_staff_ids?.includes(staffId) ||
      (t.is_public && !t.assignee_id),
  );
}

function actorFromStorage(): { role: string; id: number } | null {
  try {
    const u = JSON.parse(localStorage.getItem('cst_admin_user') ?? 'null');
    return u ? { role: u.role, id: u.id } : null;
  } catch {
    return null;
  }
}

function demoMatchesFilter(t: Ticket, filter: TicketFilter): boolean {
  if (filter.status && t.status !== filter.status) return false;
  if (filter.priority && t.priority !== filter.priority) return false;
  if (filter.category_id && t.category_id !== filter.category_id) return false;
  if (filter.zone && t.zone !== filter.zone) return false;
  if (filter.assignee_id && t.assignee_id !== filter.assignee_id) return false;
  if (filter.scope === 'unassigned' && (t.status !== 'pending' || t.assignee_id || t.is_public || t.offered_staff_ids?.length)) return false;
  if (filter.scope === 'own' && t.assignee_id !== actorFromStorage()?.id) return false;
  const q = (filter.search ?? '').trim().toLowerCase();
  if (q) {
    const hay = `${t.ticket_no} ${t.title} ${t.location_desc} ${t.resident_name} ${t.category_name} ${t.zone} ${t.assignee_name ?? ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

/** Add demo tickets into the base statistics (category charts stay base-only). */
function mergeStats(baseStats: Stats): Stats {
  const demos = listDemoTickets();
  if (!demos.length) return baseStats;
  const demoStats = computeStatsFor(demos, [], []);
  const s = baseStats.summary;
  const d = demoStats.summary;
  const completedAll = s.completed + d.completed;
  const avgAll =
    completedAll > 0
      ? Math.round((((s.avg_hours_all ?? 0) * s.completed + (d.avg_hours_all ?? 0) * d.completed) / completedAll) * 10) / 10
      : s.avg_hours_all;
  return {
    ...baseStats,
    trend: baseStats.trend.map((p) => ({
      date: p.date,
      count: p.count + (demoStats.trend.find((x) => x.date === p.date)?.count ?? 0),
    })),
    categories: baseStats.categories,
    avg_hours: baseStats.avg_hours,
    summary: {
      ...s,
      total: s.total + d.total,
      pending: s.pending + d.pending,
      accepted: s.accepted + d.accepted,
      in_progress: s.in_progress + d.in_progress,
      completed: completedAll,
      rejected: s.rejected + d.rejected,
      cancelled: s.cancelled + d.cancelled,
      overdue: s.overdue + d.overdue,
      avg_hours_all: avgAll,
    },
  };
}

async function staffName(id: number): Promise<string | null> {
  try {
    const list = await base.listStaff();
    return list.find((u) => u.id === id)?.name ?? null;
  } catch {
    return null;
  }
}

export const api = {
  async login(email: string, password: string): Promise<LoginResult> {
    return base.login(email, password);
  },

  async listStaff(): Promise<UserLike[]> {
    return base.listStaff();
  },

  async addStaff(payload: NewStaffPayload): Promise<UserLike> {
    return base.addStaff(payload);
  },

  async updateStaff(id: number, patch: StaffPatch): Promise<UserLike> {
    return base.updateStaff(id, patch);
  },

  async deleteStaff(id: number): Promise<void> {
    return base.deleteStaff(id);
  },

  async updateDutyStatus(id: number, status: DutyStatus): Promise<UserLike> {
    return base.updateDutyStatus(id, status);
  },

  async listCategories(): Promise<CategoryLike[]> {
    return base.listCategories();
  },

  async listTickets(filter: TicketFilter): Promise<Ticket[]> {
    const [baseList, staff] = await Promise.all([base.listTickets(filter), base.listStaff().catch(() => [])]);
    const adminOnDuty = !USE_MOCK || (() => {
      try { const db = JSON.parse(localStorage.getItem('cst_admin_mock_db_v2') ?? 'null'); return !db?.users?.some((u: { role: string; duty_status?: string }) => u.role === 'admin' && u.duty_status === 'off_duty'); }
      catch { return true; }
    })();
    listDemoTickets().forEach((ticket) => {
      if (ticket.status !== 'pending' || ticket.assignee_id || ticket.offered_staff_ids?.length || ticket.is_public) return;
      const jobs = CATEGORY_PROFESSIONS[ticket.category_code] ?? [];
      const candidates = staff.filter((member) => member.role === 'staff' && member.duty_status === 'on_duty' && member.zones.includes(ticket.zone) && member.professions.some((profession) => jobs.includes(profession)));
      routeDemoTicket(ticket.id, candidates.map((member) => member.id), ticket.category_code === 'others' && !adminOnDuty);
    });
    const demos = listDemoTickets().filter((t) => demoMatchesFilter(t, filter));
    const merged = [...baseList, ...demos];
    const actor = actorFromStorage();
    if (actor?.role === 'staff') return sortPool(scopeForStaff(merged, actor.id));
    return sortPool(merged);
  },

  async unassignedCount(): Promise<number> {
    const [baseCount, demos] = await Promise.all([
      base.unassignedCount().catch(() => 0),
      Promise.resolve(listDemoTickets().filter((t) => t.status === 'pending' && !t.assignee_id && !t.is_public && !t.offered_staff_ids?.length).length),
    ]);
    return baseCount + demos;
  },

  async getTicket(id: number): Promise<TicketBundle> {
    const demo = getDemoBundle(id);
    if (demo) return demo;
    return base.getTicket(id);
  },

  async acceptTicket(id: number): Promise<TicketBundle> {
    if (isDemoTicket(id)) {
      const actor = actorFromStorage();
      const staff = actor?.role === 'staff' ? (await base.listStaff()).find((member) => member.id === actor.id) : undefined;
      return demoAccept(id, staff);
    }
    return base.acceptTicket(id);
  },

  async forceAccept(id: number): Promise<TicketBundle> {
    return isDemoTicket(id) ? demoAccept(id) : base.forceAccept(id);
  },

  async assignTicket(id: number, payload: AssignPayload): Promise<TicketBundle> {
    if (isDemoTicket(id)) {
      const name = await staffName(payload.assignee_id);
      return demoAssign(id, payload, name);
    }
    return base.assignTicket(id, payload);
  },

  async editTicket(id: number, payload: EditTicketPayload): Promise<TicketBundle> {
    if (isDemoTicket(id)) {
      const b = getDemoBundle(id)!;
      const name = payload.assignee_id != null ? await staffName(payload.assignee_id) : null;
      return demoEdit(id, payload, name, b.ticket.assignee_name ?? null);
    }
    return base.editTicket(id, payload);
  },

  async startTicket(id: number): Promise<TicketBundle> {
    return isDemoTicket(id) ? demoStart(id) : base.startTicket(id);
  },

  async callForSupport(id: number, helperId: number, reason: string): Promise<TicketBundle> {
    if (isDemoTicket(id)) {
      const staff = await base.listStaff();
      const helper = staff.find((member) => member.id === helperId);
      if (!helper) throw new Error('Selected colleague was not found.');
      return demoCallForSupport(id, helper, reason);
    }
    return base.callForSupport(id, helperId, reason);
  },

  async completeTicket(id: number, payload: CompletePayload): Promise<TicketBundle> {
    return isDemoTicket(id) ? demoComplete(id, payload, await base.listStaff()) : base.completeTicket(id, payload);
  },

  async rejectTicket(id: number, payload: RejectPayload): Promise<TicketBundle> {
    return isDemoTicket(id) ? demoReject(id, payload) : base.rejectTicket(id, payload);
  },

  // ---- staff requests -> admin approvals (demo tickets: not supported) ------

  async requestRejectReview(id: number, reason: string): Promise<TicketBundle> {
    return base.requestRejectReview(id, reason);
  },

  async requestCoWorker(id: number, toStaffId: number, reason?: string): Promise<TicketBundle> {
    return base.requestCoWorker(id, toStaffId, reason);
  },

  async requestMoreTime(id: number, newDueAt: string, reason?: string): Promise<TicketBundle> {
    return base.requestMoreTime(id, newDueAt, reason);
  },

  async requestReassign(id: number, reason: string): Promise<TicketBundle> {
    return base.requestReassign(id, reason);
  },

  async requestCancel(id: number, reason: string): Promise<TicketBundle> {
    return base.requestCancel(id, reason);
  },

  async approveRequest(ticketId: number, requestId: number): Promise<TicketBundle> {
    return base.approveRequest(ticketId, requestId);
  },

  async rejectRequest(ticketId: number, requestId: number): Promise<TicketBundle> {
    return base.rejectRequest(ticketId, requestId);
  },

  async listRequests(): Promise<{ ticket_id: number; ticket_no: string; ticket_title: string; request: TicketRequest }[]> {
    return base.listRequests().catch(() => []);
  },

  async releaseToPool(id: number): Promise<TicketBundle> {
    return isDemoTicket(id) ? demoRelease(id) : base.releaseToPool(id);
  },

  async getStats(): Promise<Stats> {
    return mergeStats(await base.getStats());
  },

  /** Restores the seed database (mock mode only — used by the Test Data page). */
  async resetSeed(): Promise<void> {
    await (base as { resetDemo?: () => Promise<void> }).resetDemo?.();
  },

  /** Removes every demo ticket (client-side only). */
  async clearDemo(): Promise<void> {
    clearDemoTickets();
  },
};

type UserLike = Awaited<ReturnType<typeof mockApi.listStaff>>[number];
type CategoryLike = Awaited<ReturnType<typeof mockApi.listCategories>>[number];

export type AdminApi = typeof mockApi;
export { USE_MOCK };
