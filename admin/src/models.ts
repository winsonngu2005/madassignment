// Shared domain types — mirrors the six-table schema in the project brief.
// Enum values are the exact lowercase strings agreed across all three ends.

export type Role = 'resident' | 'admin' | 'staff';

export type TicketStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type Priority = 'low' | 'normal' | 'urgent';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: Role;
}

export interface Category {
  id: number;
  name: string;
  code: 'lighting' | 'garbage' | 'facility' | 'noise';
  sla_hours: number;
}

export interface StatusLog {
  id: number;
  ticket_id: number;
  from_status: TicketStatus | null;
  to_status: TicketStatus;
  actor_name: string;
  note?: string | null;
  photo_urls?: string[];
  created_at: string; // 'YYYY-MM-DD HH:MM:SS'
}

export interface Rating {
  id: number;
  ticket_id: number;
  resident_id: number;
  stars: number; // 1-5
  comment?: string | null;
  created_at: string;
}

export interface Ticket {
  id: number;
  ticket_no: string; // CS-YYYYMMDD-XXXX
  resident_id: number;
  resident_name: string;
  category_id: number;
  category_code: string;
  category_name: string;
  title: string;
  description?: string | null;
  location_desc: string;
  lat?: number | null;
  lng?: number | null;
  photo_urls: string[];
  status: TicketStatus;
  priority: Priority;
  assignee_id?: number | null;
  assignee_name?: string | null;
  due_at?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
  reject_reason?: string | null;
  cancelled_reason?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Auto-filled from the Staff Zones page when the location matches a zone. */
  zone_name?: string | null;
  zone_staff_id?: number | null;
  /** True for tickets created from the Test Data page (client-side only). */
  is_demo?: boolean;
}

export interface TicketBundle {
  ticket: Ticket;
  logs: StatusLog[];
  rating: Rating | null;
}

export interface TicketFilter {
  status?: TicketStatus | '';
  category_id?: number | '';
  priority?: Priority | '';
  search?: string;
}

// --- Statistics -----------------------------------------------------------

export interface StatsTrendPoint {
  date: string; // 'YYYY-MM-DD'
  count: number;
}

export interface StatsCategorySlice {
  code: string;
  name: string;
  count: number;
}

export interface StatsAvgHours {
  code: string;
  name: string;
  avg_hours: number | null; // completed_at - accepted_at, null when no completed ticket
  completed: number;
}

export interface StatsSummary {
  total: number;
  pending: number;
  accepted: number;
  in_progress: number;
  completed: number;
  rejected: number;
  cancelled: number;
  avg_hours_all: number | null;
  avg_stars: number | null; // resident satisfaction
  overdue: number; // in_progress tickets past their due_at
}

export interface Stats {
  trend: StatsTrendPoint[]; // last 14 days, tickets created per day
  categories: StatsCategorySlice[];
  avg_hours: StatsAvgHours[];
  summary: StatsSummary;
}

// --- Service layer contract -----------------------------------------------

export type LoginResult = User & { token: string };

export interface AssignPayload {
  assignee_id: number;
  priority: Priority;
  due_at: string;
  note?: string;
}

export interface CompletePayload {
  note?: string;
  photos: File[]; // up to 3 completion photos
}

export interface RejectPayload {
  reason: string;
}
