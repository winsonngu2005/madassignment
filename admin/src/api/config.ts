// Runtime configuration: where the real API lives and whether the mock layer is active.

export const API_BASE: string =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost/api';

// Mock stays ON by default so the panel runs out of the box with demo data.
// Flip VITE_USE_MOCK=false in .env once P1's admin endpoints are live.
export const USE_MOCK: boolean =
  (import.meta.env.VITE_USE_MOCK ?? 'true').toLowerCase() !== 'false';
