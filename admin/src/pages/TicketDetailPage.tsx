import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';
import PhotoViewer from '../components/PhotoViewer';
import PriorityTag from '../components/PriorityTag';
import StatusBadge from '../components/StatusBadge';
import StatusStepper from '../components/StatusStepper';
import Dropdown from '../components/Dropdown';
import { useAuth } from '../auth';
import type { AssignPayload, EditTicketPayload, Priority, TicketBundle, TicketRequest, User } from '../models';
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

const REQ_LABEL: Record<string, string> = {
  reject_review: 'rejection',
  co_worker: 'co-worker',
  more_time: 'extension',
  reassign: 'reassignment',
  cancel: 'cancellation',
};

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const ticketId = Number(id);

  const [bundle, setBundle] = useState<TicketBundle | null>(null);
  const [staff, setStaff] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null);
  const [dialog, setDialog] = useState<
    | 'assign'
    | 'complete'
    | 'reject'
    | 'edit'
    | 'release'
    | 'coWorker'
    | 'moreTime'
    | 'reassignReq'
    | 'cancelReq'
    | 'support'
    | null
  >(null);
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
  const slaHours = ticket?.category_code
    ? { lighting: 48, garbage: 24, facility: 72, noise: 48 }[ticket.category_code] ?? 48
    : 48;

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
      setAssigneeId(ticket.assignee_id ?? staff.find((member) => member.duty_status === 'on_duty')?.id ?? '');
      setAssignPriority(ticket.priority);
      setAssignDue(ticket.due_at ? toLocalInput(ticket.due_at) : defaultDue(slaHours));
    }
    setDialog('assign');
  };

  // ---- admin edit dialog state (assignee + target + priority + note) ----
  const [editAssignee, setEditAssignee] = useState<number | ''>('');
  const [editDue, setEditDue] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('normal');
  const [editNote, setEditNote] = useState('');

  const openEdit = () => {
    if (ticket) {
      setEditAssignee(ticket.assignee_id ?? staff.find((member) => member.duty_status === 'on_duty')?.id ?? '');
      setEditPriority(ticket.priority);
      setEditDue(ticket.due_at ? toLocalInput(ticket.due_at) : defaultDue(slaHours));
      setEditNote('');
    }
    setDialog('edit');
  };

  // ---- complete dialog state ----
  const [completeNote, setCompleteNote] = useState('');
  const [completePhotos, setCompletePhotos] = useState<File[]>([]);
  const [completePreviews, setCompletePreviews] = useState<string[]>([]);
  const [relayTasks, setRelayTasks] = useState<string[]>([]);
  const [supportStaffId, setSupportStaffId] = useState<number | ''>('');
  const [supportReason, setSupportReason] = useState('');

  const onPickPhotos = (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, 3);
    setCompletePhotos(picked);
    setCompletePreviews(picked.map((f) => URL.createObjectURL(f)));
  };

  // ---- reject dialog state ----
  const [rejectReason, setRejectReason] = useState('');

  // ---- staff request dialog state ----
  const [coWorkerId, setCoWorkerId] = useState<number | ''>('');
  const [coWorkerNote, setCoWorkerNote] = useState('');
  const [moreTimeDue, setMoreTimeDue] = useState('');
  const [moreTimeNote, setMoreTimeNote] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  // ---- admin request decisions ----
  const decideRequest = (req: TicketRequest, approve: boolean) => {
    void run(
      () =>
        approve
          ? api.approveRequest(ticketId, req.id)
          : api.rejectRequest(ticketId, req.id),
      approve ? 'Request approved.' : 'Request declined.',
    );
  };

  if (loading && !bundle) return <div className="spinner">Loading ticket…</div>;
  if (error && !bundle) return <div className="err-box">{error}</div>;
  if (!ticket || !bundle) return null;

  const staffOptions = staff.filter((s) => s.duty_status === 'on_duty').map((s) => ({ value: s.id, label: s.name }));
  const priorityOptions = [
    { value: 'urgent' as const, label: 'urgent' },
    { value: 'normal' as const, label: 'normal' },
    { value: 'low' as const, label: 'low' },
  ];

  const pendingRequests = (ticket.requests ?? []).filter((r) => r.status === 'pending');
  const handledRequests = (ticket.requests ?? []).filter((r) => r.status !== 'pending');
  const isMine = user?.id === ticket.assignee_id || user?.id === ticket.co_assignee_id || ticket.offered_staff_ids?.includes(user?.id ?? -1);

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
          {ticket.acceptance_status === 'awaiting_acceptance' ? <span className="badge badge--completed">Awaiting Acceptance</span> : <StatusBadge status={ticket.status} />} <PriorityTag priority={ticket.priority} />
          {ticket.is_demo && <span className="badge badge--demo">DEMO</span>}
          {ticket.auto_assigned && (
            <span className="zone-tag" title="Auto-matched from zone + category">
              auto-assigned
            </span>
          )}
          {ticket.is_public && !ticket.assignee_id && <span className="badge badge--demo">public pool</span>}
        </h1>
        <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{ticket.title}</p>
        <StatusStepper ticket={ticket} logs={bundle.logs} />
        {(ticket.admin_attention || ticket.acceptance_status === 'rework') && <div className="ticket-alert"><b>Admin coordination needed.</b> {ticket.admin_attention_reason || 'This ticket needs review.'} Handoffs: {ticket.handoff_count ?? 0}. {ticket.rework_reason && <>Rework reason: {ticket.rework_reason}</>}</div>}
        {ticket.acceptance_status === 'awaiting_acceptance' && <div className="info-banner"><b>Awaiting resident acceptance.</b> Auto-accept is due {ticket.acceptance_due_at || '48 hours after completion'}.</div>}
      </div>

      {ticket.work_tasks && ticket.work_tasks.length > 0 && <div className="card" style={{ marginTop: 16 }}><h2>Work plan</h2><div className="work-task-list">{ticket.work_tasks.map((task) => <div key={task.id} className={`work-task${task.task_status === 'blocked' ? ' is-blocked' : ''}`}><span><b>{task.sequence_no}. {task.task_label}</b><small style={{ display: 'block', color: 'var(--ink-soft)' }}>{task.assignee_name || 'Awaiting assignment'}{task.blocked_by_task_id ? ' · waiting for prerequisite' : ''}</small></span><span className={`badge badge--${task.task_status === 'completed' ? 'completed' : task.task_status === 'blocked' ? 'rejected' : task.task_status === 'in_progress' ? 'in_progress' : 'pending'}`}>{task.task_status.replace('_', ' ')}</span></div>)}</div></div>}

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div>
          <div className="card">
            <h2>Report</h2>
            <dl className="dl">
              <dt>Resident</dt>
              <dd>{ticket.resident_name}</dd>
              <dt>Category</dt>
              <dd>{ticket.category_name}</dd>
              <dt>Zone</dt>
              <dd>Zone {ticket.zone}</dd>
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
                {ticket.auto_assigned && (
                  <span className="zone-tag" title="Auto-matched from zone + category">
                    auto: {ticket.zone}
                  </span>
                )}
              </dd>
              {ticket.co_assignee_name && (
                <>
                  <dt>Co-worker</dt>
                  <dd>{ticket.co_assignee_name}</dd>
                </>
              )}
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
                      <StatusBadge status={l.from_status} />
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

      {/* ---------- staff requests to the admin ---------- */}
      {isAdmin && pendingRequests.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Staff requests on this ticket</h2>
          <div className="req-list">
            {pendingRequests.map((r) => (
              <div key={r.id} className="req-row">
                <div className="req-text">
                  <b>{r.from_staff_name}</b> requests {REQ_LABEL[r.type] ?? r.type}
                  {r.type === 'co_worker' && <> — pull in {r.to_staff_name}</>}
                  {r.type === 'more_time' && <> — new target {r.new_due_at}</>}
                  {r.reason ? `: ${r.reason}` : ''}
                  <div className="req-when">{r.created_at}</div>
                </div>
                <div className="req-actions">
                  <button
                    className="btn btn--sm btn--ok"
                    disabled={busy}
                    onClick={() => decideRequest(r, true)}
                  >
                    <i className="fa-solid fa-check" aria-hidden="true" />
                    Approve
                  </button>
                  <button
                    className="btn btn--sm btn--danger"
                    disabled={busy}
                    onClick={() => decideRequest(r, false)}
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {handledRequests.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Request history</h2>
          <ul className="timeline">
            {handledRequests.map((r) => (
              <li key={r.id}>
                <div className="t-head">
                  <span className={`badge badge--${r.status === 'approved' ? 'completed' : 'rejected'}`}>
                    {r.status}
                  </span>
                  <span>{REQ_LABEL[r.type] ?? r.type} — {r.from_staff_name}</span>
                  <span className="t-when">{r.created_at}</span>
                </div>
                {r.reason && <div className="t-note">{r.reason}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------- actions pinned at the bottom ---------- */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Actions</h2>

        {isAdmin && (
          <div className="action-row">
            {ticket.status === 'pending' && (
              <>
                <button
                  className="btn btn--primary"
                  disabled={busy || !ticket.assignee_id}
                  onClick={() => void run(() => api.forceAccept(ticket.id), 'Staff forced to accept.')}
                  title={ticket.assignee_id ? 'Force the assigned staff to accept' : 'Assign a staff first'}
                >
                  <i className="fa-solid fa-user-check" aria-hidden="true" />
                  Force accept
                </button>
                <button className="btn btn--primary" disabled={busy} onClick={openEdit}>
                  <i className="fa-solid fa-pen" aria-hidden="true" />
                  Edit
                </button>
                <button className="btn btn--danger" disabled={busy} onClick={() => setDialog('reject')}>
                  <i className="fa-solid fa-ban" aria-hidden="true" />
                  Reject
                </button>
                <button
                  className="btn btn--ghost"
                  disabled={busy}
                  onClick={() => setDialog('release')}
                  title="Clear the assignee so any staff can take it"
                >
                  <i className="fa-solid fa-share-nodes" aria-hidden="true" />
                  Put in public pool
                </button>
              </>
            )}
            {ticket.status === 'accepted' && (
              <>
                <button className="btn btn--primary" disabled={busy} onClick={openAssign}>
                  <i className="fa-solid fa-user-gear" aria-hidden="true" />
                  Adjust
                </button>
                <button
                  className="btn btn--ok"
                  disabled={busy}
                  onClick={() => void run(() => api.startTicket(ticket.id), 'Work started.')}
                >
                  <i className="fa-solid fa-play" aria-hidden="true" />
                  Start solving
                </button>
                <button
                  className="btn btn--ghost"
                  disabled={busy}
                  onClick={() => setDialog('release')}
                  title="Send it back to pending in the public pool"
                >
                  <i className="fa-solid fa-share-nodes" aria-hidden="true" />
                  Put in public pool
                </button>
              </>
            )}
            {ticket.status === 'in_progress' && (
              <>
                <button className="btn btn--primary" disabled={busy} onClick={openAssign}>
                  <i className="fa-solid fa-user-gear" aria-hidden="true" />
                  Adjust
                </button>
                <button className="btn btn--primary" disabled={busy} onClick={openAssign}>
                  <i className="fa-solid fa-people-arrows" aria-hidden="true" />
                  Reassign
                </button>
                <button className="btn btn--ok" disabled={busy} onClick={() => setDialog('complete')}>
                  <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
                  Mark completed
                </button>
              </>
            )}
          </div>
        )}

        {!isAdmin && isMine && (
          <div className="action-row">
            {ticket.status === 'pending' && (
              <>
                <button
                  className="btn btn--ok"
                  disabled={busy}
                  onClick={() => void run(() => api.acceptTicket(ticket.id), 'Ticket accepted.')}
                >
                  <i className="fa-solid fa-check" aria-hidden="true" />
                  Accept
                </button>
                <button className="btn btn--danger" disabled={busy} onClick={() => setDialog('reject')}>
                  <i className="fa-solid fa-ban" aria-hidden="true" />
                  Reject
                </button>
              </>
            )}
            {ticket.status === 'accepted' && (
              <>
                <button className="btn btn--ok" disabled={busy} onClick={() => void run(() => api.startTicket(ticket.id), 'Work started.')}>
                  <i className="fa-solid fa-play" aria-hidden="true" />
                  Start Processing
                </button>
                <button
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={() => {
                    setCoWorkerId(staff.find((s) => s.id !== user?.id)?.id ?? '');
                    setDialog('coWorker');
                  }}
                >
                  <i className="fa-solid fa-user-plus" aria-hidden="true" />
                  Pull a co-worker
                </button>
                <button className="btn btn--danger" disabled={busy} onClick={() => setDialog('reject')}>
                  <i className="fa-solid fa-ban" aria-hidden="true" />
                  Reject
                </button>
              </>
            )}
            {ticket.status === 'in_progress' && (
              <>
                <button className="btn btn--ok" disabled={busy} onClick={() => setDialog('complete')}>
                  <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
                  Mark completed
                </button>
                <button className="btn btn--primary" disabled={busy} onClick={() => { setSupportStaffId(staff.find((s) => s.id !== user?.id && s.duty_status === 'on_duty' && s.zones.includes(ticket.zone))?.id ?? ''); setSupportReason(''); setDialog('support'); }}>
                  <i className="fa-solid fa-life-ring" aria-hidden="true" />
                  Call for Support
                </button>
                <button
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={() => {
                    setMoreTimeDue(ticket.due_at ? toLocalInput(ticket.due_at) : defaultDue(slaHours));
                    setDialog('moreTime');
                  }}
                >
                  <i className="fa-regular fa-clock" aria-hidden="true" />
                  Ask for more time
                </button>
                <button className="btn btn--primary" disabled={busy} onClick={() => setDialog('reassignReq')}>
                  <i className="fa-solid fa-people-arrows" aria-hidden="true" />
                  Ask to change staff
                </button>
                <button className="btn btn--danger" disabled={busy} onClick={() => setDialog('cancelReq')}>
                  <i className="fa-solid fa-circle-xmark" aria-hidden="true" />
                  Ask to cancel
                </button>
                <button
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={() => {
                    setCoWorkerId(staff.find((s) => s.id !== user?.id)?.id ?? '');
                    setDialog('coWorker');
                  }}
                >
                  <i className="fa-solid fa-user-plus" aria-hidden="true" />
                  Pull a co-worker
                </button>
              </>
            )}
          </div>
        )}

        <p style={{ color: 'var(--ink-soft)', margin: '10px 0 0' }}>
          {isAdmin
            ? 'Every action writes one row into the status history; the resident sees the same timeline in the mobile app.'
            : 'Reject / co-worker / extension / reassignment / cancellation requests go to the admin for approval.'}
        </p>
      </div>

      {/* ---------- dialogs ---------- */}

      {dialog === 'assign' && (
        <Modal title="Assign / adjust ticket" onClose={() => setDialog(null)}>
          <div className="field">
            <span className="lbl">Assignee</span>
            <Dropdown
              value={assigneeId}
              onChange={(v) => setAssigneeId(v)}
              ariaLabel="Assignee"
              options={staffOptions}
            />
          </div>
          <div className="field">
            <span className="lbl">Priority</span>
            <Dropdown
              value={assignPriority}
              onChange={(v) => setAssignPriority(v as Priority)}
              ariaLabel="Priority"
              options={priorityOptions}
            />
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

      {dialog === 'edit' && (
        <Modal title="Edit ticket" onClose={() => setDialog(null)}>
          <div className="info-banner">
            Change the responsible staff, the target completion, the priority — the note goes into the
            status history.
          </div>
          <div className="field">
            <span className="lbl">Responsible staff</span>
            <Dropdown
              value={editAssignee}
              onChange={(v) => setEditAssignee(v)}
              ariaLabel="Responsible staff"
              options={staffOptions}
            />
          </div>
          <div className="field">
            <span className="lbl">Priority</span>
            <Dropdown
              value={editPriority}
              onChange={(v) => setEditPriority(v as Priority)}
              ariaLabel="Priority"
              options={priorityOptions}
            />
          </div>
          <div className="field">
            <span className="lbl">Target completion</span>
            <input
              type="datetime-local"
              value={editDue}
              onChange={(e) => setEditDue(e.target.value)}
            />
          </div>
          <div className="field">
            <span className="lbl">Note (optional, into status history)</span>
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Why this change, instructions for the new staff…"
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || !editAssignee || !editDue}
              onClick={() =>
                void run(
                  () =>
                    api.editTicket(ticket.id, {
                      assignee_id: Number(editAssignee),
                      priority: editPriority,
                      due_at: fromLocalInput(editDue),
                      note: editNote.trim() || undefined,
                    } satisfies EditTicketPayload),
                  'Ticket edited.',
                )
              }
            >
              <i className="fa-solid fa-floppy-disk" aria-hidden="true" />
              Save changes
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'release' && (
        <Modal title="Put ticket in the public pool" onClose={() => setDialog(null)}>
          <div className="info-banner">
            The ticket keeps its zone + category but loses its assignee; any staff (from either zone)
            can accept it from their Ticket Pool.
          </div>
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              disabled={busy}
              onClick={() => void run(() => api.releaseToPool(ticket.id), 'Ticket released to the public pool.')}
            >
              <i className="fa-solid fa-share-nodes" aria-hidden="true" />
              Release
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'complete' && (
        <Modal title="Mark ticket completed" onClose={() => setDialog(null)}>
          <div className="field">
            <span className="lbl">Does another colleague need to relay / wrap up?</span>
            <div className="chip-row">{[{ code: 'cleaner', label: 'Cleaning / mopping' }, { code: 'masonry_odd_job', label: 'Masonry / odd-job' }].map((task) => <button key={task.code} type="button" className={`chip${relayTasks.includes(task.code) ? ' is-on' : ''}`} onClick={() => setRelayTasks((current) => current.includes(task.code) ? current.filter((x) => x !== task.code) : [...current, task.code])}>{task.label}{relayTasks.includes(task.code) ? ` · Step ${relayTasks.indexOf(task.code) + 1}` : ''}</button>)}</div>
            <small className="muted">Select relay jobs in the order they should happen.</small>
          </div>
          <div className="field">
            <span className="lbl">Completion note</span>
            <textarea
              value={completeNote}
              onChange={(e) => setCompleteNote(e.target.value)}
              placeholder="What was done, parts replaced, follow-up needed…"
            />
          </div>
          <div className="field">
            <span className="lbl">After-repair photos (maximum 3)</span>
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
              disabled={busy || !completePhotos.length}
              onClick={() =>
                void run(
                  () =>
                    api.completeTicket(ticket.id, {
                      note: completeNote.trim() || undefined,
                      photos: completePhotos,
                      relay_tasks: relayTasks,
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

      {dialog === 'support' && (
        <Modal title="Call for Support / Prerequisite Handling" onClose={() => setDialog(null)}>
          <div className="info-banner">Your task will pause as blocked. Select an on-duty colleague who covers this ticket’s zone.</div>
          <div className="field"><span className="lbl">On-duty colleague</span><Dropdown value={supportStaffId} onChange={(value) => setSupportStaffId(value)} ariaLabel="Support colleague" options={staff.filter((s) => s.id !== user?.id && s.duty_status === 'on_duty' && s.zones.includes(ticket.zone)).map((s) => ({ value: s.id, label: `${s.name} · ${s.professions.map((p) => p.replace(/_/g, ' ')).join(', ')}` }))}/></div>
          <div className="field"><span className="lbl">Prerequisite work needed</span><textarea value={supportReason} onChange={(e) => setSupportReason(e.target.value)} placeholder="e.g. ceiling leak must be fixed before cleaning can continue"/></div>
          <div className="modal-actions"><button className="btn btn--ghost" onClick={() => setDialog(null)}>Cancel</button><button className="btn btn--primary" disabled={busy || !supportStaffId || !supportReason.trim()} onClick={() => void run(() => api.callForSupport(ticket.id, Number(supportStaffId), supportReason.trim()), 'Support task assigned; current work is blocked until it is completed.')}>Send support task</button></div>
        </Modal>
      )}

      {dialog === 'reject' && (
        <Modal
          title={isAdmin ? 'Reject ticket' : 'Request rejection'}
          onClose={() => setDialog(null)}
        >
          {isAdmin ? (
            <div className="info-banner">
              The staff asked to reject this ticket — check the requests panel before rejecting on
              their behalf.
            </div>
          ) : (
            <div className="info-banner">
              Your rejection goes to the admin first. If they approve, the ticket is rejected; if
              they decline, it stays with you.
            </div>
          )}
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
                  () =>
                    isAdmin
                      ? api.rejectTicket(ticket.id, { reason: rejectReason.trim() })
                      : api.requestRejectReview(ticket.id, rejectReason.trim()),
                  isAdmin ? 'Ticket rejected.' : 'Rejection request sent to the admin.',
                )
              }
            >
              <i className="fa-solid fa-ban" aria-hidden="true" />
              {isAdmin ? 'Reject ticket' : 'Send request'}
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'coWorker' && (
        <Modal title="Pull a co-worker in" onClose={() => setDialog(null)}>
          <div className="info-banner">
            The admin must approve before {`they`} join; after approval both of you appear on the
            ticket.
          </div>
          <div className="field">
            <span className="lbl">Co-worker</span>
            <Dropdown
              value={coWorkerId}
              onChange={(v) => setCoWorkerId(v)}
              ariaLabel="Co-worker"
              options={staff.filter((s) => s.id !== user?.id).map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div className="field">
            <span className="lbl">Why you need them (optional)</span>
            <textarea
              value={coWorkerNote}
              onChange={(e) => setCoWorkerNote(e.target.value)}
              placeholder="e.g. needs a licensed electrician for the panel…"
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || !coWorkerId}
              onClick={() =>
                void run(
                  () =>
                    api.requestCoWorker(
                      ticket.id,
                      Number(coWorkerId),
                      coWorkerNote.trim() || undefined,
                    ),
                  'Co-worker request sent to the admin.',
                )
              }
            >
              <i className="fa-solid fa-user-plus" aria-hidden="true" />
              Send request
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'moreTime' && (
        <Modal title="Ask for more time" onClose={() => setDialog(null)}>
          <div className="field">
            <span className="lbl">New target completion</span>
            <input
              type="datetime-local"
              value={moreTimeDue}
              onChange={(e) => setMoreTimeDue(e.target.value)}
            />
          </div>
          <div className="field">
            <span className="lbl">Reason (optional)</span>
            <textarea
              value={moreTimeNote}
              onChange={(e) => setMoreTimeNote(e.target.value)}
              placeholder="e.g. waiting for a spare part delivery…"
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || !moreTimeDue}
              onClick={() =>
                void run(
                  () =>
                    api.requestMoreTime(
                      ticket.id,
                      fromLocalInput(moreTimeDue),
                      moreTimeNote.trim() || undefined,
                    ),
                  'Extension request sent to the admin.',
                )
              }
            >
              <i className="fa-regular fa-clock" aria-hidden="true" />
              Send request
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'reassignReq' && (
        <Modal title="Ask to change staff" onClose={() => setDialog(null)}>
          <div className="info-banner">
            The admin decides: send you back, assign someone else, or release the ticket to the
            public pool.
          </div>
          <div className="field">
            <span className="lbl">Reason (required)</span>
            <textarea
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              placeholder="e.g. this needs a noise-control officer, not an electrician…"
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="btn btn--primary"
              disabled={busy || !reassignReason.trim()}
              onClick={() =>
                void run(() => api.requestReassign(ticket.id, reassignReason.trim()), 'Reassignment request sent to the admin.')
              }
            >
              <i className="fa-solid fa-people-arrows" aria-hidden="true" />
              Send request
            </button>
          </div>
        </Modal>
      )}

      {dialog === 'cancelReq' && (
        <Modal title="Ask to cancel the ticket" onClose={() => setDialog(null)}>
          <div className="info-banner">
            Only the admin can actually cancel; if they approve, the resident sees the ticket as
            cancelled with your reason.
          </div>
          <div className="field">
            <span className="lbl">Reason (required)</span>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. resident confirmed the issue fixed itself…"
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn--ghost" onClick={() => setDialog(null)}>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              disabled={busy || !cancelReason.trim()}
              onClick={() =>
                void run(() => api.requestCancel(ticket.id, cancelReason.trim()), 'Cancellation request sent to the admin.')
              }
            >
              <i className="fa-solid fa-circle-xmark" aria-hidden="true" />
              Send request
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
