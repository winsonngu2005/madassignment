// Staff Zones: each staff member claims an area by keywords. When a resident's
// location text matches, that staff is auto-suggested as assignee.
// Stored client-side (localStorage) — in mock mode it decorates mock tickets,
// against the real API it works as a front-end suggestion layer.

export interface Zone {
  id: number;
  name: string; // e.g. "Block A area"
  keywords: string; // comma separated, e.g. "block a, level 3, staircase"
  staff_id: number;
}

const KEY = 'cst_admin_zones_v1';

export function listZones(): Zone[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Zone[];
  } catch {
    /* corrupted — start empty */
  }
  return [];
}

function save(zones: Zone[]) {
  localStorage.setItem(KEY, JSON.stringify(zones));
}

export function addZone(name: string, keywords: string, staffId: number): Zone {
  const zones = listZones();
  const zone: Zone = { id: Date.now(), name, keywords, staff_id: staffId };
  zones.push(zone);
  save(zones);
  return zone;
}

export function updateZone(id: number, patch: Partial<Omit<Zone, 'id'>>) {
  const zones = listZones();
  const z = zones.find((x) => x.id === id);
  if (!z) return;
  Object.assign(z, patch);
  save(zones);
}

export function deleteZone(id: number) {
  save(listZones().filter((z) => z.id !== id));
}

export function zoneKeywords(zone: Zone): string[] {
  return zone.keywords
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
}

/** First zone whose keyword appears anywhere in the resident's location text. */
export function matchZone(locationDesc: string, zones: Zone[]): Zone | null {
  const loc = (locationDesc ?? '').toLowerCase();
  if (!loc) return null;
  return zones.find((z) => zoneKeywords(z).some((k) => loc.includes(k))) ?? null;
}
