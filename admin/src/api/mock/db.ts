// In-memory seed database used by the mock API layer.
// Seeded once, persisted to localStorage so triage actions survive reloads.
// Dates are generated relative to "today" so the demo dashboard is never stale.

import type {
  Category,
  Priority,
  Rating,
  StatusLog,
  Ticket,
  TicketStatus,
  User,
  Zone,
} from '../../models';

export interface Db {
  users: User[];
  categories: Category[];
  tickets: Ticket[];
  logs: StatusLog[];
  ratings: Rating[];
  seq: { ticket: number; log: number; rating: number; request: number };
}

const now = () => new Date();

function iso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

/** Timestamp N days ago at hh:mm (local), MySQL-style string. */
function daysAgo(n: number, h = 9, m = 5): string {
  const d = now();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return iso(d);
}

/** SVG placeholder "photo" — works fully offline. */
function photo(label: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
<rect width="640" height="480" fill="hsl(${hue}, 40%, 72%)"/>
<rect x="24" y="24" width="592" height="432" fill="none" stroke="hsl(${hue}, 40%, 30%)" stroke-width="6"/>
<text x="320" y="235" font-family="Arial, sans-serif" font-size="38" fill="#1f2937" text-anchor="middle" font-weight="bold">${label}</text>
<text x="320" y="280" font-family="Arial, sans-serif" font-size="20" fill="#374151" text-anchor="middle">site photo</text>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Default passwords are 'password123' for every seeded account.

const users: User[] = [
  { id: 1, name: 'Jia Ying', email: 'admin@gmail.com', phone: '+60111222333', role: 'admin', professions: [], zones: [] },
  { id: 2, name: 'Mei Ling', email: 'meiling@uts.edu.my', phone: '+60123456789', role: 'resident', professions: [], zones: [] },
  { id: 3, name: 'Daniel Tan', email: 'daniel@uts.edu.my', phone: '+60199887766', role: 'resident', professions: [], zones: [] },
  { id: 4, name: 'Winson Ngu', email: 'winson@uts.edu.my', phone: '+60111222333', role: 'resident', professions: [], zones: [] },
  {
    id: 10,
    name: 'Technician Lim',
    email: 'lim.wk@gmail.com',
    phone: '+60165550001',
    role: 'staff',
    professions: ['electrician', 'maintenance', 'plumbing_electrical_repair'],
    zones: ['A'],
  },
  {
    id: 11,
    name: 'Technician Wong',
    email: 'wong.ch@gmail.com',
    phone: '+60165550002',
    role: 'staff',
    professions: ['maintenance', 'plumber', 'plumbing_electrical_repair', 'masonry_odd_job'],
    zones: ['A', 'B'],
  },
  {
    id: 12,
    name: 'Technician Ahmad',
    email: 'ahmad.r@gmail.com',
    phone: '+60165550003',
    role: 'staff',
    professions: ['noise_control', 'security', 'cleaner'],
    zones: ['B'],
  },
  {
    // default worker login account
    id: 14,
    name: 'Worker Wong',
    email: 'worker@gmail.com',
    phone: '+60167770088',
    role: 'staff',
    professions: ['lift_technician', 'maintenance', 'cleaner', 'masonry_odd_job'],
    zones: ['A'],
  },
];

const categories: Category[] = [
  { id: 1, name: 'Lighting', code: 'lighting', sla_hours: 48 },
  { id: 2, name: 'Garbage Collection', code: 'garbage', sla_hours: 24 },
  { id: 3, name: 'Public Facility', code: 'facility', sla_hours: 72 },
  { id: 4, name: 'Noise Disturbance', code: 'noise', sla_hours: 48 },
  { id: 5, name: 'Leak / Plumbing & Electrical', code: 'leak_plumbing_electrical', sla_hours: 48 },
  { id: 6, name: 'Cleaning', code: 'cleaning', sla_hours: 24 },
  { id: 7, name: 'Masonry / Odd-job', code: 'masonry', sla_hours: 72 },
  { id: 8, name: 'Others', code: 'others', sla_hours: 48 },
];

interface SeedTicket {
  residentId: number;
  catId: number;
  zone: Zone;
  title: string;
  desc?: string;
  loc: string;
  lat?: number;
  lng?: number;
  photos?: string[];
  priority: Priority;
  created: string;
  status: TicketStatus;
  assignee?: number;
  auto?: boolean;
  public?: boolean;
  acceptedAt?: string;
  dueAt?: string;
  completedAt?: string;
  rejectReason?: string;
  cancelledReason?: string;
  cancelledAt?: string;
  rating?: { stars: number; comment: string; at: string };
  actorAccepted?: string;
  actorAssigned?: string;
  actorCompleted?: string;
  assignNote?: string;
  completeNote?: string;
}

const seedTickets: SeedTicket[] = [
  {
    residentId: 2, catId: 1, zone: 'A',
    title: 'Corridor light out for three nights',
    desc: 'The ceiling light near the staircase does not turn on.',
    loc: 'Block A, Level 3, end of corridor',
    lat: 3.1414, lng: 101.6912,
    photos: [photo('Lighting / corridor', 28)],
    priority: 'urgent',
    created: daysAgo(0, 8, 15),
    status: 'pending',
  },
  {
    residentId: 3, catId: 2, zone: 'B',
    title: 'Garbage bins overflowing at Block B',
    desc: 'Collection missed twice this week; smell near lift lobby.',
    loc: 'Block B, ground floor, lift lobby',
    lat: 3.1405, lng: 101.6902,
    photos: [photo('Garbage / bin area', 120), photo('Garbage / overflow', 120)],
    priority: 'normal',
    created: daysAgo(0, 7, 40),
    status: 'pending',
  },
  {
    residentId: 4, catId: 1, zone: 'A',
    title: 'Street lamp flickering on Jalan 3/12',
    desc: 'Flickers after 8 PM, path to guardhouse is dark.',
    loc: 'Jalan 3/12, near guardhouse',
    lat: 3.142, lng: 101.6955,
    priority: 'normal',
    created: daysAgo(1, 21, 5),
    status: 'pending',
  },
  // noise in Zone A: no noise-control staff covers Zone A -> stays unassigned
  {
    residentId: 2, catId: 4, zone: 'A',
    title: 'Late-night generator vibration noise',
    desc: 'Persistent humming sound after 11 PM near utility room.',
    loc: 'Block A annex, near utility room',
    priority: 'urgent',
    created: daysAgo(1, 23, 30),
    status: 'pending',
  },
  {
    residentId: 3, catId: 3, zone: 'A',
    title: 'Broken bench at playground',
    desc: 'One plank missing, children could trip.',
    loc: 'Zone A playground, beside swing set',
    lat: 3.1398, lng: 101.6885,
    photos: [photo('Facility / playground', 210)],
    priority: 'low',
    created: daysAgo(2, 10, 20),
    status: 'pending',
  },
  // public-pool ticket: released by the admin for any staff to take
  {
    residentId: 4, catId: 3, zone: 'B',
    title: 'Broken swing chain at Zone B playground',
    loc: 'Zone B playground, swing set 2',
    priority: 'normal',
    created: daysAgo(1, 11, 0),
    status: 'pending',
    public: true,
  },
  {
    residentId: 4, catId: 1, zone: 'A',
    title: 'Two lights out at car park entrance',
    loc: 'Zone A car park P1 entrance ramp',
    photos: [photo('Lighting / car park', 28)],
    priority: 'normal',
    created: daysAgo(1, 9, 0),
    status: 'accepted',
    assignee: 10,
    acceptedAt: daysAgo(0, 9, 10),
    actorAccepted: 'Admin Alice',
  },
  {
    residentId: 2, catId: 2, zone: 'B',
    title: 'Recycle point not cleared for a week',
    loc: 'Zone B recycle point behind Block D',
    priority: 'low',
    created: daysAgo(2, 15, 45),
    status: 'accepted',
    assignee: 11,
    acceptedAt: daysAgo(1, 9, 0),
    actorAccepted: 'Admin Alice',
  },
  {
    residentId: 3, catId: 3, zone: 'A',
    title: 'Lift button panel faulty in Block A',
    desc: 'Level 5 button unresponsive.',
    loc: 'Block A, Lift 2',
    lat: 3.1414, lng: 101.6912,
    priority: 'urgent',
    created: daysAgo(2, 8, 30),
    status: 'in_progress',
    acceptedAt: daysAgo(2, 9, 5),
    assignee: 14,
    auto: true,
    dueAt: daysAgo(0, 9, 5),
    actorAccepted: 'Admin Alice',
    actorAssigned: 'Auto-match (zone A + Public Facility)',
    assignNote: 'Auto-assigned by zone + category match; vendor quote pending.',
  },
  {
    residentId: 4, catId: 4, zone: 'B',
    title: 'Construction noise before 7 AM',
    desc: 'Renovation in unit C-12 starts around 6:40 AM daily.',
    loc: 'Zone B, unit C-12',
    priority: 'normal',
    created: daysAgo(3, 7, 15),
    status: 'in_progress',
    acceptedAt: daysAgo(2, 8, 0),
    assignee: 12,
    auto: true,
    dueAt: daysAgo(0, 8, 0),
    actorAccepted: 'Admin Alice',
    actorAssigned: 'Auto-match (zone B + Noise Disturbance)',
    assignNote: 'Notice letter issued to unit owner; follow-up visit.',
  },
  {
    residentId: 2, catId: 1, zone: 'A',
    title: 'Staircase light replaced — follow-up',
    desc: 'Light was replaced but flickers again after two days.',
    loc: 'Block A, Level 3, staircase',
    photos: [photo('Lighting / staircase', 28)],
    priority: 'normal',
    created: daysAgo(6, 20, 0),
    status: 'completed',
    acceptedAt: daysAgo(6, 21, 30),
    assignee: 10,
    completedAt: daysAgo(5, 11, 30),
    dueAt: daysAgo(4, 21, 30),
    actorAccepted: 'Admin Alice',
    actorAssigned: 'Admin Alice',
    actorCompleted: 'Technician Lim',
    assignNote: 'Same gang as previous visit.',
    completeNote: 'Replaced worn anti-vibration pads and ballast.',
    rating: { stars: 5, comment: 'Fast and quiet fix!', at: daysAgo(5, 18, 0) },
  },
  {
    residentId: 3, catId: 2, zone: 'B',
    title: 'Missed collection at Block B',
    loc: 'Zone B bin centre',
    priority: 'normal',
    created: daysAgo(5, 8, 0),
    status: 'completed',
    acceptedAt: daysAgo(5, 9, 0),
    assignee: 11,
    completedAt: daysAgo(4, 14, 0),
    dueAt: daysAgo(4, 9, 0),
    actorAccepted: 'Admin Alice',
    actorAssigned: 'Auto-match (zone B + Garbage Collection)',
    actorCompleted: 'Technician Wong',
    completeNote: 'Contractor re-routed the truck; schedule restored.',
    rating: { stars: 4, comment: 'Good but took one extra day.', at: daysAgo(4, 20, 0) },
  },
  {
    residentId: 4, catId: 3, zone: 'B',
    title: 'Drinking fountain leaking',
    loc: 'Zone B community centre lobby',
    lat: 3.1395, lng: 101.688,
    photos: [photo('Facility / fountain', 210), photo('Facility / leak close-up', 210)],
    priority: 'low',
    created: daysAgo(8, 13, 10),
    status: 'completed',
    acceptedAt: daysAgo(7, 9, 0),
    assignee: 11,
    completedAt: daysAgo(6, 10, 0),
    dueAt: daysAgo(4, 9, 0),
    actorAccepted: 'Admin Alice',
    actorAssigned: 'Admin Alice',
    actorCompleted: 'Technician Wong',
    completeNote: 'Replaced cartridge and tightened inlet joint.',
  },
  {
    residentId: 2, catId: 1, zone: 'B',
    title: 'Back lane lighting outside community boundary',
    desc: 'Back lane behind row houses belongs to municipal council.',
    loc: 'Zone B back lane, west of Block D',
    priority: 'low',
    created: daysAgo(3, 12, 0),
    status: 'rejected',
    rejectReason: 'Outside community jurisdiction — forwarded to municipal council.',
    actorAccepted: 'Admin Alice',
  },
  {
    residentId: 3, catId: 4, zone: 'B',
    title: 'Noise from karaoke session',
    desc: 'Loud karaoke past midnight over the weekend.',
    loc: 'Zone B, Block C, Level 5',
    priority: 'normal',
    created: daysAgo(1, 22, 45),
    status: 'cancelled',
    cancelledReason: 'Issue resolved on its own — unit stopped the session.',
    cancelledAt: daysAgo(0, 10, 30),
  },
];

function ticketNoFor(created: string, seq: number): string {
  const datePart = created.slice(0, 10).replace(/-/g, '');
  return `CS-${datePart}-${String(seq).padStart(4, '0')}`;
}

export function buildSeed(): Db {
  const db: Db = {
    users,
    categories,
    tickets: [],
    logs: [],
    ratings: [],
    seq: { ticket: 0, log: 0, rating: 0, request: 0 },
  };

  const userName = (id: number) => users.find((u) => u.id === id)?.name ?? `User#${id}`;
  const cat = (id: number) => categories.find((c) => c.id === id)!;

  seedTickets.forEach((s, i) => {
    db.seq.ticket += 1;
    const id = db.seq.ticket;
    const created = s.created;
    const c = cat(s.catId);

    db.tickets.push({
      id,
      ticket_no: ticketNoFor(created, i + 1),
      resident_id: s.residentId,
      resident_name: userName(s.residentId),
      category_id: c.id,
      category_code: c.code,
      category_name: c.name,
      zone: s.zone,
      title: s.title,
      description: s.desc ?? null,
      location_desc: s.loc,
      lat: s.lat ?? null,
      lng: s.lng ?? null,
      photo_urls: s.photos ?? [],
      status: s.status,
      priority: s.priority,
      assignee_id: s.assignee ?? null,
      assignee_name: s.assignee ? userName(s.assignee) : null,
      auto_assigned: s.auto ?? false,
      co_assignee_id: null,
      co_assignee_name: null,
      is_public: s.public ?? false,
      requests: [],
      due_at: s.dueAt ?? null,
      accepted_at: s.acceptedAt ?? null,
      completed_at: s.completedAt ?? null,
      reject_reason: s.rejectReason ?? null,
      cancelled_reason: s.cancelledReason ?? null,
      cancelled_at: s.cancelledAt ?? null,
      created_at: created,
      updated_at: s.completedAt ?? s.cancelledAt ?? created,
    });

    const pushLog = (
      from: TicketStatus | null,
      to: TicketStatus,
      actor: string,
      at: string,
      note?: string,
    ) => {
      db.seq.log += 1;
      db.logs.push({
        id: db.seq.log,
        ticket_id: id,
        from_status: from,
        to_status: to,
        actor_name: actor,
        note: note ?? null,
        created_at: at,
      });
    };

    pushLog(null, 'pending', userName(s.residentId), created, 'Ticket submitted by resident.');

    if (s.actorAccepted && s.acceptedAt) {
      pushLog('pending', 'accepted', s.actorAccepted, s.acceptedAt, 'Ticket accepted — within community jurisdiction.');
    }
    if (s.actorAssigned && s.acceptedAt && s.dueAt) {
      pushLog('accepted', 'in_progress', s.actorAssigned, s.acceptedAt, s.assignNote ?? 'Assigned.');
    }
    if (s.actorCompleted && s.completedAt) {
      pushLog('in_progress', 'completed', s.actorCompleted, s.completedAt, s.completeNote ?? 'Work completed.');
    }
    if (s.rejectReason) {
      pushLog('pending', 'rejected', s.actorAccepted ?? 'Admin Alice', s.created, `Rejected: ${s.rejectReason}`);
    }
    if (s.cancelledReason && s.cancelledAt) {
      pushLog('pending', 'cancelled', userName(s.residentId), s.cancelledAt, s.cancelledReason);
    }

    if (s.rating) {
      db.seq.rating += 1;
      db.ratings.push({
        id: db.seq.rating,
        ticket_id: id,
        resident_id: s.residentId,
        stars: s.rating.stars,
        comment: s.rating.comment,
        created_at: s.rating.at,
      });
    }
  });

  db.users.forEach((u) => { u.duty_status ??= 'on_duty'; });
  return db;
}

export { iso };
