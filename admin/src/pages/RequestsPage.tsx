import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { toast } from '../util';
import type { TicketRequest } from '../models';

interface Row {
  ticket_id: number;
  ticket_no: string;
  ticket_title: string;
  request: TicketRequest;
}

const TYPE_LABEL: Record<string, string> = {
  reject_review: 'Reject review',
  co_worker: 'Co-worker',
  more_time: 'More time',
  reassign: 'Change staff',
  cancel: 'Cancel ticket',
};

export default function RequestsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await api.listRequests());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const decide = async (ticketId: number, requestId: number, approve: boolean) => {
    try {
      const bundle = approve
        ? await api.approveRequest(ticketId, requestId)
        : await api.rejectRequest(ticketId, requestId);
      toast(
        approve
          ? `Approved — ${bundle.ticket.ticket_no} updated.`
          : 'Declined — the ticket stays as it was.',
      );
      void reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'err');
    }
  };

  return (
    <>
      <div className="page-head">
        <div className="left">
          <h1>
            Staff Requests
            <span className="mock-flag">{rows.length} pending</span>
          </h1>
          <p>Staff asking for help: rejections, co-workers, extensions, reassignment or cancellation.</p>
        </div>
        <div className="actions">
          <button className="btn btn--ghost" onClick={() => void reload()} title="Refresh">
            <i className="fa-solid fa-rotate-right" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="err-box">{error}</div>}

      <div className="card">
        {loading ? (
          <div className="spinner">Loading requests…</div>
        ) : rows.length === 0 ? (
          <div className="empty">No pending staff requests — you are all caught up.</div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Ticket</th>
                  <th>From</th>
                  <th>Detail</th>
                  <th>Raised</th>
                  <th style={{ textAlign: 'right' }}>Decision</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ ticket_id, ticket_no, ticket_title, request }) => (
                  <tr key={`${ticket_id}-${request.id}`} style={{ cursor: 'default' }}>
                    <td>
                      <span className={`badge badge--${request.type === 'cancel' ? 'cancelled' : 'accepted'}`}>
                        {TYPE_LABEL[request.type] ?? request.type}
                      </span>
                    </td>
                    <td>
                      <button
                        className="linklike mono"
                        onClick={() => navigate(`/tickets/${ticket_id}`)}
                        title="Open the ticket"
                      >
                        {ticket_no}
                      </button>
                      <div style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>{ticket_title}</div>
                    </td>
                    <td>{request.from_staff_name}</td>
                    <td style={{ maxWidth: 340 }}>
                      {request.type === 'co_worker' && <>Pull in <b>{request.to_staff_name}</b>{request.reason ? ` — ${request.reason}` : ''}</>}
                      {request.type === 'more_time' && <>New target: <b className="mono">{request.new_due_at}</b>{request.reason ? ` — ${request.reason}` : ''}</>}
                      {request.type === 'reject_review' && <>{request.reason}</>}
                      {request.type === 'reassign' && <>{request.reason}</>}
                      {request.type === 'cancel' && <>{request.reason}</>}
                    </td>
                    <td className="mono">{request.created_at}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn--sm btn--ok"
                        onClick={() => void decide(ticket_id, request.id, true)}
                      >
                        <i className="fa-solid fa-check" aria-hidden="true" />
                        Approve
                      </button>{' '}
                      <button
                        className="btn btn--sm btn--danger"
                        onClick={() => void decide(ticket_id, request.id, false)}
                      >
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                        Decline
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
