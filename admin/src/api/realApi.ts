// Real implementation against P1's PHP REST API.
// The endpoint contract is documented in admin/admin-api-spec.md — hand that
// file to P1. All responses follow the standard wrapper:
//   { "success": true, "message": "...", "data": ... }
// The new role/assignment endpoints (staff, requests, edit) are marked below —
// coordinate them with P1 before switching VITE_USE_MOCK=false.

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
  StaffPatch,
  User,
} from '../models';
import { API_BASE } from './config';
import { TOKEN_KEY } from './keys';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return pairs.length ? `?${pairs.join('&')}` : '';
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  opts: { skipAuth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (!opts.skipAuth) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await res.json().catch(() => null);

  if (res.status === 401 && !opts.skipAuth) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.assign('/login');
    throw new ApiError('Session expired — please sign in again.', 401);
  }
  if (!res.ok || !body || body.success !== true) {
    throw new ApiError(body?.message ?? `Request failed (HTTP ${res.status}).`, res.status);
  }
  return (body.data ?? null) as T;
}

function jsonInit(method: string, payload: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
}

export const realApi = {
  async login(email: string, password: string): Promise<LoginResult> {
    return request<LoginResult>('/admin/login', jsonInit('POST', { email, password }), { skipAuth: true });
  },

  async listStaff(): Promise<User[]> {
    return request<User[]>('/admin/staff');
  },

  async addStaff(payload: NewStaffPayload): Promise<User> {
    return request<User>('/admin/staff', jsonInit('POST', payload));
  },

  async updateStaff(id: number, patch: StaffPatch): Promise<User> {
    return request<User>(`/admin/staff/${id}`, jsonInit('PATCH', patch));
  },

  async deleteStaff(id: number): Promise<void> {
    await request<void>(`/admin/staff/${id}`, { method: 'DELETE' });
  },

  async updateDutyStatus(id: number, duty_status: DutyStatus): Promise<User> {
    return request<User>(`/admin/staff/${id}/duty`, jsonInit('PATCH', { duty_status }));
  },

  async listCategories(): Promise<Category[]> {
    return request<Category[]>('/admin/categories');
  },

  async listTickets(filter: TicketFilter): Promise<Ticket[]> {
    return request<Ticket[]>(
      `/admin/tickets${qs({
        status: filter.status,
        category_id: filter.category_id,
        priority: filter.priority,
        zone: filter.zone,
        assignee_id: filter.assignee_id,
        scope: filter.scope,
        search: filter.search,
      })}`,
    );
  },

  async unassignedCount(): Promise<number> {
    return request<number>('/admin/tickets/unassigned-count');
  },

  async getTicket(id: number): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}`);
  },

  async acceptTicket(id: number): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/accept`, jsonInit('PATCH', {}));
  },

  async forceAccept(id: number): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/force-accept`, jsonInit('PATCH', {}));
  },

  async assignTicket(id: number, payload: AssignPayload): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/assign`, jsonInit('PATCH', payload));
  },

  async editTicket(id: number, payload: EditTicketPayload): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/edit`, jsonInit('PATCH', payload));
  },

  async startTicket(id: number): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/start`, jsonInit('PATCH', {}));
  },

  async callForSupport(id: number, helper_id: number, reason: string): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/support`, jsonInit('POST', { helper_id, reason }));
  },

  async completeTicket(id: number, payload: CompletePayload): Promise<TicketBundle> {
    const form = new FormData();
    if (payload.note) form.append('note', payload.note);
    if (payload.relay_tasks?.length) form.append('relay_tasks', JSON.stringify(payload.relay_tasks));
    payload.photos.forEach((f) => form.append('photos[]', f));
    return request<TicketBundle>(`/admin/tickets/${id}/complete`, { method: 'PATCH', body: form });
  },

  async rejectTicket(id: number, payload: RejectPayload): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/reject`, jsonInit('PATCH', payload));
  },

  async requestRejectReview(id: number, reason: string): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/request`, jsonInit('POST', { type: 'reject_review', reason }));
  },

  async requestCoWorker(id: number, toStaffId: number, reason?: string): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/request`, jsonInit('POST', { type: 'co_worker', to_staff_id: toStaffId, reason }));
  },

  async requestMoreTime(id: number, newDueAt: string, reason?: string): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/request`, jsonInit('POST', { type: 'more_time', new_due_at: newDueAt, reason }));
  },

  async requestReassign(id: number, reason: string): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/request`, jsonInit('POST', { type: 'reassign', reason }));
  },

  async requestCancel(id: number, reason: string): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/request`, jsonInit('POST', { type: 'cancel', reason }));
  },

  async approveRequest(ticketId: number, requestId: number): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${ticketId}/requests/${requestId}/approve`, jsonInit('PATCH', {}));
  },

  async rejectRequest(ticketId: number, requestId: number): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${ticketId}/requests/${requestId}/reject`, jsonInit('PATCH', {}));
  },

  async listRequests(): Promise<{ ticket_id: number; ticket_no: string; ticket_title: string; request: TicketRequest }[]> {
    return request<{ ticket_id: number; ticket_no: string; ticket_title: string; request: TicketRequest }[]>('/admin/requests');
  },

  async releaseToPool(id: number): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/release`, jsonInit('PATCH', {}));
  },

  async getStats(): Promise<Stats> {
    return request<Stats>('/admin/stats');
  },
};

export type { RequestType };
