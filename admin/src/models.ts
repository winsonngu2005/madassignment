// Shared domain types — mirrors the six-table schema plus the zone/profession
// assignment model. Enum values are exact lowercase strings across all ends.

export type Role = 'resident' | 'admin' | 'staff';

export type Zone = 'A' | 'B';

export type TicketStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type DutyStatus = 'on_duty' | 'off_duty';

export interface WorkTask {
  id: number;
  task_code: string;
  task_label: string;
  sequence_no: number;
  task_status: 'queued' | 'ready' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
  assignee_id?: number | null;
  assignee_name?: string | null;
  blocked_by_task_id?: number | null;
}

export type Priority = 'low' | 'normal' | 'urgent';

/** Staff request raised to the Admin for review. */
export type RequestType = 'reject_review' | 'co_worker' | 'more_time' | 'reassign' | 'cancel';

export interface TicketRequest {
  id: number;
  type: RequestType;
  from_staff_id: number;
  from_staff_name: string;
  /** co_worker only: the staff the requester wants to pull in. */
  to_staff_id?: number | null;
  to_staff_name?: string | null;
  reason?: string | null;
  /** more_time only: proposed new due_at. */
  new_due_at?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  /** Profession codes (see api/professions.ts) — staff only. */
  professions: string[];
  /** Zones this staff is responsible for — staff can cover both zones. */
  zones: Zone[];
  duty_status?: DutyStatus;
}

export type StaffPatch = Partial<Pick<User, 'name' | 'email' | 'phone' | 'professions' | 'zones'>>;

export interface Category {
  id: number;
  name: string;
  code: 'lighting' | 'garbage' | 'facility' | 'noise' | 'leak_plumbing_electrical' | 'cleaning' | 'masonry' | 'others';
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
  /** Resident-declared area — drives the zone + category auto-assignment. */
  zone: Zone;
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
  /** Set to true when the assignee came from the zone + category auto-match. */
  auto_assigned?: boolean;
  /** Second staff pulled in after the Admin approves a co_worker request. */
  co_assignee_id?: number | null;
  co_assignee_name?: string | null;
  /** Ticket released to the public pool — any staff can take it. */
  is_public: boolean;
  /** Staff → Admin requests on this ticket. */
  requests: TicketRequest[];
  due_at?: string | null;
  accepted_at?: string | null;
  completed_at?: string | null;
  reject_reason?: string | null;
  cancelled_reason?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  /** True for tickets created from the Test Data page (client-side only). */
  is_demo?: boolean;
  offered_staff_ids?: number[];
  work_tasks?: WorkTask[];
  handoff_count?: number;
  admin_attention?: boolean;
  admin_attention_reason?: string | null;
  acceptance_status?: 'not_ready' | 'awaiting_acceptance' | 'accepted' | 'rework';
  acceptance_due_at?: string | null;
  rework_reason?: string | null;
}

export interface TicketBundle {
  ticket: Ticket;
  logs: StatusLog[];
  rating: Rating | null;
}

export type TicketScope = 'all' | 'unassigned' | 'own';

export interface TicketFilter {
  status?: TicketStatus | '';
  category_id?: number | '';
  zone?: Zone | '';
  assignee_id?: number | '';
  priority?: Priority | '';
  search?: string;
  /** 'unassigned' — admin: needs manual assignment; staff: the public pool. */
  scope?: TicketScope;
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
  avg_stars: number | null;
  overdue: number;
}

export interface Stats {
  trend: StatsTrendPoint[];
  categories: StatsCategorySlice[];
  avg_hours: StatsAvgHours[];
  summary: StatsSummary;
}

// --- Service layer contract -----------------------------------------------

export type LoginResult = User & { token: string };

export interface AssignPayload {
  assignee_id: number;
  priority?: Priority;
  due_at?: string;
  note?: string;
}

export interface CompletePayload {
  note?: string;
  photos: File[];
  relay_tasks?: string[];
}

export interface RejectPayload {
  reason: string;
}

export interface EditTicketPayload {
  assignee_id?: number | null;
  due_at?: string | null;
  priority?: Priority;
  note?: string;
}

export interface NewStaffPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  professions: string[];
  zones: Zone[];
}
