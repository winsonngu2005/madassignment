import type { StatusLog, Ticket, TicketStatus } from '../models';

const FLOW: { key: string; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
];

const TERMINAL_LABELS: Partial<Record<TicketStatus, string>> = {
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function reachedTime(key: string, ticket: Ticket, logs: StatusLog[]): string | null {
  if (key === 'new') return ticket.created_at;
  const log = logs.find((l) => l.to_status === key);
  if (log) return log.created_at;
  if (key === 'accepted') return ticket.accepted_at ?? null;
  if (key === 'completed') return ticket.completed_at ?? null;
  return null;
}

/**
 * Horizontal status timeline. The current status is highlighted in blue on
 * its node; when the status changes, the highlight moves to the new node.
 * Rejected / cancelled tickets stop the flow and highlight the terminal node.
 */
export default function StatusStepper({ ticket, logs }: { ticket: Ticket; logs: StatusLog[] }) {
  const status = ticket.status;
  const isTerminal = status === 'rejected' || status === 'cancelled';

  let flowIdx: number;
  if (isTerminal) {
    // where the ticket stood before it was rejected / cancelled
    const termLog = logs.find((l) => l.to_status === status);
    const from = termLog?.from_status;
    flowIdx = FLOW.findIndex((s) => s.key === from);
    if (flowIdx < 0) flowIdx = 1; // at least "pending" was reached
  } else {
    flowIdx = FLOW.findIndex((s) => s.key === status);
  }

  const visible = isTerminal ? FLOW.slice(0, flowIdx + 1) : FLOW;

  return (
    <div className="stepper" role="list">
      {visible.map((step, i) => {
        const reached = i <= flowIdx;
        const current = !isTerminal && i === flowIdx;
        return (
          <div
            key={step.key}
            role="listitem"
            className={`step${reached ? ' is-reached' : ' is-future'}${current ? ' is-current' : ''}`}
          >
            <div className="step__dot">{reached && !current ? '✓' : ''}</div>
            <div className="step__label">{step.label}</div>
            <div className="step__when">{reached ? reachedTime(step.key, ticket, logs) ?? '—' : ''}</div>
          </div>
        );
      })}
      {isTerminal && (
        <div className="step is-reached is-current">
          <div className="step__dot">✕</div>
          <div className="step__label">{TERMINAL_LABELS[status] ?? status}</div>
          <div className="step__when">
            {logs.find((l) => l.to_status === status)?.created_at ?? '—'}
          </div>
        </div>
      )}
    </div>
  );
}
