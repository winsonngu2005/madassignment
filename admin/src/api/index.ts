// Single entry point composing the base API (mock until P1's endpoints are
// live, real afterwards) with the demo-data overlay and the zone auto-assignee.
//
// Overlay rules:
//  - demo tickets (Test Data page) are merged into list/statistics reads;
//  - triage actions on a demo ticket are simulated locally and NEVER sent to
//    the server, so real data submitted from the resident app is untouched;
//  - in mock mode the seed db plays the role of "resident-submitted data".

import type {
  AssignPayload,
  CompletePayload,
  LoginResult,
  RejectPayload,
  Stats,
  Ticket,
  TicketBundle,
  TicketFilter,
  User,
} from '../models';
import { USE_MOCK } from './config';
import {
  clearDemoTickets,
  demoAccept,
  demoAssign,
  demoComplete,
  demoReject,
  getDemoBundle,
  isDemoTicket,
  listDemoTickets,
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

function demoMatchesFilter(t: Ticket, filter: TicketFilter): boolean {
  if (filter.status && t.status !== filter.status) return false;
  if (filter.priority && t.priority !== filter.priority) return false;
  const q = (filter.search ?? '').trim().toLowerCase();
  if (q) {
    const hay = `${t.ticket_no} ${t.title} ${t.location_desc} ${t.resident_name}`.toLowerCase();
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
    const list: User[] = await base.listStaff();
    return list.find((u) => u.id === id)?.name ?? null;
  } catch {
    return null;
  }
}

export const api = {
  async login(email: string, password: string): Promise<LoginResult> {
    return base.login(email, password);
  },

  async listStaff(): Promise<User[]> {
    return base.listStaff();
  },

  async listTickets(filter: TicketFilter): Promise<Ticket[]> {
    const [baseList, demos] = await Promise.all([
      base.listTickets(filter),
      Promise.resolve(listDemoTickets().filter((t) => demoMatchesFilter(t, filter))),
    ]);
    return sortPool([...baseList, ...demos]);
  },

  async getTicket(id: number): Promise<TicketBundle> {
    const demo = getDemoBundle(id);
    if (demo) return demo;
    return base.getTicket(id);
  },

  async acceptTicket(id: number): Promise<TicketBundle> {
    return isDemoTicket(id) ? demoAccept(id) : base.acceptTicket(id);
  },

  async assignTicket(id: number, payload: AssignPayload): Promise<TicketBundle> {
    if (isDemoTicket(id)) {
      const name = await staffName(payload.assignee_id);
      return demoAssign(id, payload, name);
    }
    return base.assignTicket(id, payload);
  },

  async completeTicket(id: number, payload: CompletePayload): Promise<TicketBundle> {
    return isDemoTicket(id) ? demoComplete(id, payload) : base.completeTicket(id, payload);
  },

  async rejectTicket(id: number, payload: RejectPayload): Promise<TicketBundle> {
    return isDemoTicket(id) ? demoReject(id, payload) : base.rejectTicket(id, payload);
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

export type AdminApi = typeof mockApi;
export { USE_MOCK };
