import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';
import PhotoViewer from '../components/PhotoViewer';
import PriorityTag from '../components/PriorityTag';
import StatusBadge from '../components/StatusBadge';
import StatusStepper from '../components/StatusStepper';
import type { AssignPayload, Priority, TicketBundle, User } from '../models';
import { toast } from '../util';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD HH:MM:SS' -> 'YYYY-MM-DDTHH:MM' for <input type="datetime-local"> */
function toLocalInput(ts: string): string {
  return ts.slice(0, 16).replace(' ', 'T');
}

function fromLocalInput(v: string): string {
  return `${v.replace('T', ' ')}:00`;
}

function defaultDue(slaHours: number, base: Date = new Date()): string {
  const d = new Date(base.getTime() + slaHours * 3_600_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ticketId = Number(id);

  const [bundle, setBundle] = useState<TicketBundle | null>(null);
  const [staff, setStaff] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'assign' | 'complete' | 'reject' | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setBundle(await api.getTicket(ticketId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ticket.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void api.listStaff().then(setStaff).catch(() => undefined);
  }, []);

  const ticket = bundle?.ticket;

  const slaHours = 48; // generic SLA default; zones-based flow doesn't depend on categories

  const run = async (fn: () => Promise<TicketBundle>, okMsg: string) => {
    setBusy(true);
    try {
      const result = await fn();
      setBundle(result);
      setDialog(null);
      toast(okMsg);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action failed.', 'err');
    } finally {
      setBusy(false);
    }
  };

  // ---- assign dialog state ----
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [assignPriority, setAssignPriority] = useState<Priority>('normal');
  const [assignDue, setAssignDue] = useState('');
  const [assignNote, setAssignNote] = useState('');

  const openAssign = () => {
    if (ticket) {
      const suggested = ticket.zone_staff_id ?? ticket.assignee_id ?? staff[0]?.id ?? '';
      setAssigneeId(suggested);
      setAssignPriority(ticket.priority);
      setAssignDue(ticket.due_at ? toLocalInput(ticket.due_at) : defaultDue(slaHours));
    }
    setDialog('assign');
  };

  // ---- complete dialog state ----
  const [completeNote, setCompleteNote] = useState('');
  const [completePhotos, setCompletePhotos] = useState<File[]>([]);
  const [completePreviews, setCompletePreviews] = useState<string[]>([]);

  const onPickPhotos = (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, 3);
    setCompletePhotos(picked);
    setCompletePreviews(picked.map((f) => URL.createObjectURL(f)));
  };

  // ---- reject dialog state ----
  const [rejectReason, setRejectReason] = useState('');

  if (loading && !bundle) return <div className="spinner">Loading ticket…</div>;
  if (error && !bundle) return <div className="err-box">{error}</div>;
  if (!ticket || !bundle) return null;

  return (
    <>
      <div className="detail-back">
        <button className="btn btn--ghost" onClick={() => navigate('/tickets')}>
          <i className="fa-solid fa-arrow-left" aria-hidden="true" />
          Back to pool
        </button>
      </div>

      <div className="card">
        <h1>
          <span style={{ fontFamily: 'Consolas, monospace', fontSize: 16 }}>{ticket.ticket_no}</span>{' '}
          <StatusBadge status={ticket.status} /> <PriorityTag priority={ticket.priority} />
          {ticket.is_demo && <span className="badge badge--demo">DEMO</span>}
        </h1>
        <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{ticket.title}</p>
        <StatusStepper ticket={ticket} logs={bundle.logs} />
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div>
          <div className="card">
            <h2>Report</h2>
            <dl className="dl">
              <dt>Resident</dt>
              <dd>{ticket.resident_name}</dd>
              <dt>Priority</dt>
              <dd>
                <PriorityTag priority={ticket.priority} />
              </dd>
              <dt>Reported at</dt>
              <dd>{ticket.created_at}</dd>
              <dt>Location</dt>
              <dd>{ticket.location_desc}</dd>
              <dt>Description</dt>
              <dd>{ticket.description ?? '—'}</dd>
            </dl>
          </div>

          <div className="card">
            <h2>Processing</h2>
            <dl className="dl">
              <dt>Assignee</dt>
              <dd>
                {ticket.assignee_name ?? '—'}
                {ticket.zone_name && (
                  <span className="zone-tag" title="Auto-matched from Staff Zones">auto: {ticket.zone_name}</span>
                )}
              </dd>
              <dt>Due by</dt>
              <dd>
                {ticket.due_at ? (
                  ticket.status === 'in_progress' &&
                  new Date(ticket.due_at.replace(' ', 'T')).getTime() < Date.now() ? (
                    <span className="overdue-flag">{ticket.due_at} — overdue</span>
                  ) : (
                    ticket.due_at
                  )
                ) : (
                  '—'
                )}
              </dd>
              <dt>Accepted at</dt>
              <dd>{ticket.accepted_at ?? '—'}</dd>
              <dt>Completed at</dt>
              <dd>{ticket.completed_at ?? '—'}</dd>
              {ticket.reject_reason && (
                <>
                  <dt>Rejection reason</dt>
                  <dd>{ticket.reject_reason}</dd>
                </>
              )}
              {ticket.cancelled_reason && (
                <>
                  <dt>Cancelled reason</dt>
                  <dd>{ticket.cancelled_reason}</dd>
                </>
              )}
            </dl>
          </div>

          {bundle.rating && (
            <div className="card">
              <h2>Resident rating</h2>
              <div className="rating-box">
                <span className="stars">
                  {'★'.repeat(bundle.rating.stars)}
                  {'☆'.repeat(5 - bundle.rating.stars)}
                </span>
                <span style={{ color: 'var(--ink-soft)' }}>{bundle.rating.comment ?? 'No comment.'}</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <h2>Site photos ({ticket.photo_urls.length})</h2>
            {ticket.photo_urls.length ? (
              <div className="photo-strip">
                {ticket.photo_urls.map((u, i) => (
                  <img
                    key={i}
                    className="ph"
                    src={u}
                    alt={`site photo ${i + 1}`}
                    onClick={() => setViewerPhoto(u)}
                  />
                ))}
              </div>
            ) : (
              <div className="empty">No photos attached.</div>
            )}
          </div>

          <div className="card">
            <h2>Status history</h2>
            <ul className="timeline">
              {bundle.logs.map((l) => (
                <li key={l.id}>
                  <div className="t-head">
                    {l.from_status ? (
                      <span className="badge badge--accepted">{l.from_status}</span>
                    ) : (
                      <span className="badge badge--cancelled">new</span>
                    )}
                    <span style={{ color: 'var(--ink-faint)' }}>→</span>
                    <StatusBadge status={l.to_status} />
                    <span className="t-when">{l.created_at}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>by {l.actor_name}</div>
                  {l.note && <div className="t-note">{l.note}</div>}
                  {l.photo_urls && l.photo_urls.length > 0 && (
                    <div className="t-photos">
                      {l.photo_urls.map((u, i) => (
                        <img key={i} src={u} alt={`log photo ${i + 1}`} onClick={() => setViewerPhoto(u)} />
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* actions pinned at the bottom */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Actions</h2>
        {(ticket.status === 'pending' ||
          ticket.status === 'accepted' ||
          ticket.status === 'in_progress') && (
          <div className="action-row">
            {ticket.status === 'pending' && (
              <button
                className="btn btn--ok"
                disabled={busy}
                onClick={() => void run(() => api.acceptTicket(ticket.id), 'Ticket accepted.')}
              >
                <i className="fa-solid fa-check" aria-hidden="true" />
                Accept
              </button>
            )}
            {(ticket.status === 'accepted' || ticket.status === 'in_progress') && (
              <button className="btn btn--primary" disabled={busy} onClick={openAssign}>
                <i className="fa-solid fa-user-gear" aria-hidden="true" />
                {ticket.status === 'accepted' ? 'Assign staff' : 'Reassign / adjust'}
              </button>
            )}
            {ticket.status === 'in_progress' && (
              <button className="btn btn--ok" disabled={busy} onClick={() => setDialog('complete')}>
                <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
                Mark completed
              </button>
            )}
            {(ticket.status === 'pending' || ticket.status === 'accepted') && (
              <button className="btn btn--danger" disabled={busy} onClick={() => setDialog('reject')}>
                <i className="fa-solid fa-ban" aria-hidden="true" />
                Reject
              </button>
            )}
          </div>
        )}
        <p style={{ color: 'var(--ink-soft)', margin: '10px 0 0' }}>
          Every action writes one row into the status history; the resident sees the same
          timeline in the mobile app.
        </p>
      </div>

      {/* ---------- dialogs ---------- */}

      {dialog === 'assign' && (
        <Modal title="Assign maintenance staff" onClose={() => setDialog(null)}>
          {ticket.zone_name && (
            <div className="info-banner">
              Zone <b>{ticket.zone_name}</b> matches this ticket&rsquo;s location — its owner is
              suggested below. Choosing another staff member overrides the zone suggestion.
            </div>
          )}
          <div className="field">
            <span className="lbl">Assignee</span>
            <select value={assigneeId} onChange={(e) => setAssigneeId(Number(e.target.value))}>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.id === ticket.zone_staff_id ? ' (zone owner)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="lbl">Priority</span>
            <select value={assignPriority} onChange={(e) => setAssignPriority(e.target.value as Priority)}>
              <option value="urgent">urgent</option>
              <option value="normal">normal</option>
              <option value="low">low</option>
            </select>
          </div>
          <div className="field">
            <span className="lbl">Target completion (default SLA: {slaHours} h)</span>
            <input
              type="datetime-local"
              value={assignDue}
              onChange={(e) => setAssignDue(e.target.value)}
            />
          </div>
          <div className="field">
            <span className="lbl">Note (optional)</span>
            <textarea
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              placeholder="e.g. bring a spare LED panel…"
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || !assigneeId || !assignDue}
              onClick={() =>
                void run(
                  () =>
                    api.assignTicket(ticket.id, {
                      assignee_id: Number(assigneeId),
                      priority: assignPriority,
                      due_at: fromLocalInput(assignDue),
                      note: assignNote.trim() || undefined,
                    } satisfies AssignPayload),
                  'Ticket assigned.',
                )
              }
            >
              <i className="fa-solid fa-user-gear" aria-hidden="true" />
              Assign
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'complete' && (
        <Modal title="Mark ticket completed" onClose={() => setDialog(null)}>
          <div className="field">
            <span className="lbl">Completion note</span>
            <textarea
              value={completeNote}
              onChange={(e) => setCompleteNote(e.target.value)}
              placeholder="What was done, parts replaced, follow-up needed…"
            />
          </div>
          <div className="field">
            <span className="lbl">Completion photos (max 3)</span>
            <input type="file" accept="image/*" multiple onChange={(e) => onPickPhotos(e.target.files)} />
          </div>
          {completePreviews.length > 0 && (
            <div className="photo-preview">
              {completePreviews.map((src, i) => (
                <img key={i} src={src} alt={`preview ${i + 1}`} />
              ))}
            </div>
          )}
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="btn btn--ok"
              disabled={busy}
              onClick={() =>
                void run(
                  () =>
                    api.completeTicket(ticket.id, {
                      note: completeNote.trim() || undefined,
                      photos: completePhotos,
                    }),
                  'Ticket completed.',
                )
              }
            >
              <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
              Complete
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'reject' && (
        <Modal title="Reject ticket" onClose={() => setDialog(null)}>
          <div className="field">
            <span className="lbl">Reason (required, shown to the resident)</span>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. outside community jurisdiction — forwarded to municipal council…"
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              disabled={busy || !rejectReason.trim()}
              onClick={() =>
                void run(
                  () => api.rejectTicket(ticket.id, { reason: rejectReason.trim() }),
                  'Ticket rejected.',
                )
              }
            >
              <i className="fa-solid fa-ban" aria-hidden="true" />
              Reject ticket
            </button>
          </div>
        </Modal>
      )}

      {viewerPhoto && (
        <PhotoViewer
          src={viewerPhoto}
          downloadName={`${ticket.ticket_no.replace(/[^A-Za-z0-9-]/g, '_')}.jpg`}
          onClose={() => setViewerPhoto(null)}
        />
      )}
    </>
  );
}
