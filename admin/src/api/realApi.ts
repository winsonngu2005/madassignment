// Real implementation against P1's PHP REST API.
// The endpoint contract is documented in admin/admin-api-spec.md — hand that
// file to P1. All responses follow the standard wrapper:
//   { "success": true, "message": "...", "data": ... }

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

  async listCategories(): Promise<Category[]> {
    return request<Category[]>('/admin/categories');
  },

  async listTickets(filter: TicketFilter): Promise<Ticket[]> {
    return request<Ticket[]>(
      `/admin/tickets${qs({
        status: filter.status,
        category_id: filter.category_id,
        priority: filter.priority,
        search: filter.search,
      })}`,
    );
  },

  async getTicket(id: number): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}`);
  },

  async acceptTicket(id: number): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/accept`, jsonInit('PATCH', {}));
  },

  async assignTicket(id: number, payload: AssignPayload): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/assign`, jsonInit('PATCH', payload));
  },

  async completeTicket(id: number, payload: CompletePayload): Promise<TicketBundle> {
    const form = new FormData();
    if (payload.note) form.append('note', payload.note);
    payload.photos.slice(0, 3).forEach((f) => form.append('photos[]', f));
    return request<TicketBundle>(`/admin/tickets/${id}/complete`, { method: 'PATCH', body: form });
  },

  async rejectTicket(id: number, payload: RejectPayload): Promise<TicketBundle> {
    return request<TicketBundle>(`/admin/tickets/${id}/reject`, jsonInit('PATCH', payload));
  },

  async getStats(): Promise<Stats> {
    return request<Stats>('/admin/stats');
  },
};
