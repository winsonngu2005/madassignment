import type { TicketStatus } from '../models';

const LABELS: Record<TicketStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export default function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`badge badge--${status}`}>{LABELS[status]}</span>;
}

export function statusLabel(status: TicketStatus): string {
  return LABELS[status];
}
