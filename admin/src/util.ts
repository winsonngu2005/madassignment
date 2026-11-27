// Tiny DOM-level toast so any module can surface a message without wiring context.

let toastEl: HTMLDivElement | null = null;

function ensureEl(): HTMLDivElement {
  if (toastEl && document.body.contains(toastEl)) return toastEl;
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  document.body.appendChild(toastEl);
  return toastEl;
}

export function toast(message: string, kind: 'ok' | 'err' = 'ok') {
  const el = ensureEl();
  el.textContent = message;
  el.className = `toast toast--${kind} toast--show`;
  window.setTimeout(() => {
    el.className = `toast toast--${kind}`;
  }, 2600);
}

export function fmtDateTime(v?: string | null): string {
  if (!v) return '—';
  return v;
}

export function dueLabel(ticket: { due_at?: string | null; status: string }): string {
  if (!ticket.due_at) return '—';
  const diff = new Date(ticket.due_at.replace(' ', 'T')).getTime() - Date.now();
  if (diff < 0) return `${ticket.due_at} (Overdue for ${Math.max(1, Math.floor(Math.abs(diff) / 86_400_000))} days)`;
  if (diff <= 86_400_000) return `${ticket.due_at} (Almost Overdue)`;
  return ticket.due_at;
}

export function mapLink(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return '';
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}
