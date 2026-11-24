// Shared, pure statistics computation — used by the mock layer and by the
// demo-data overlay so both sides derive numbers the same way ("state and
// statistics share one source": everything is computed from tickets/logs).

import type {
  Category,
  Rating,
  Stats,
  StatsAvgHours,
  StatsCategorySlice,
  StatsTrendPoint,
  Ticket,
} from '../models';

export function hoursBetween(a: string, b: string): number {
  const ms = new Date(b.replace(' ', 'T')).getTime() - new Date(a.replace(' ', 'T')).getTime();
  return ms / 3_600_000;
}

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function computeStatsFor(
  tickets: Ticket[],
  categories: Category[],
  ratings: Rating[],
): Stats {
  const trend: StatsTrendPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = isoDate(d);
    trend.push({ date: key, count: tickets.filter((t) => t.created_at.slice(0, 10) === key).length });
  }

  const categoriesSlices: StatsCategorySlice[] = categories.map((c) => ({
    code: c.code,
    name: c.name,
    count: tickets.filter((t) => t.category_id === c.id).length,
  }));

  const avg_hours: StatsAvgHours[] = categories.map((c) => {
    const done = tickets.filter(
      (t) => t.category_id === c.id && t.status === 'completed' && t.accepted_at && t.completed_at,
    );
    const total = done.reduce((acc, t) => acc + hoursBetween(t.accepted_at!, t.completed_at!), 0);
    return {
      code: c.code,
      name: c.name,
      avg_hours: done.length ? Math.round((total / done.length) * 10) / 10 : null,
      completed: done.length,
    };
  });

  const completedAll = tickets.filter((t) => t.status === 'completed');
  const totalHours = completedAll.reduce(
    (acc, t) => acc + (t.accepted_at && t.completed_at ? hoursBetween(t.accepted_at, t.completed_at) : 0),
    0,
  );
  const avgStars = ratings.length
    ? ratings.reduce((acc, r) => acc + r.stars, 0) / ratings.length
    : null;

  const summary = {
    total: tickets.length,
    pending: tickets.filter((t) => t.status === 'pending').length,
    accepted: tickets.filter((t) => t.status === 'accepted').length,
    in_progress: tickets.filter((t) => t.status === 'in_progress').length,
    completed: completedAll.length,
    rejected: tickets.filter((t) => t.status === 'rejected').length,
    cancelled: tickets.filter((t) => t.status === 'cancelled').length,
    avg_hours_all: completedAll.length ? Math.round((totalHours / completedAll.length) * 10) / 10 : null,
    avg_stars: avgStars === null ? null : Math.round(avgStars * 10) / 10,
    overdue: tickets.filter(
      (t) => t.status === 'in_progress' && t.due_at && new Date(t.due_at.replace(' ', 'T')).getTime() < Date.now(),
    ).length,
  };

  return { trend, categories: categoriesSlices, avg_hours, summary };
}
