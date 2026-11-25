// Profession catalogue for the community service staff, and the mapping from
// each ticket category to the professions that can handle it. Auto-assignment
// matches: staff zone == ticket zone AND professions ∩ category professions.

export interface Profession {
  code: string;
  label: string;
}

export const PROFESSIONS: Profession[] = [
  { code: 'electrician', label: 'Electrician' },
  { code: 'sanitation', label: 'Sanitation Worker' },
  { code: 'maintenance', label: 'Maintenance Technician' },
  { code: 'noise_control', label: 'Noise Control Officer' },
  { code: 'plumber', label: 'Plumber' },
  { code: 'gardener', label: 'Gardener' },
  { code: 'cleaner', label: 'Cleaner' },
  { code: 'security', label: 'Security Officer' },
  { code: 'lift_technician', label: 'Lift Technician' },
  { code: 'pest_control', label: 'Pest Control Technician' },
  { code: 'plumbing_electrical_repair', label: 'Plumbing & Electrical Repair' },
  { code: 'masonry_odd_job', label: 'Masonry / Odd-job' },
];

export const CATEGORY_PROFESSIONS: Record<string, string[]> = {
  lighting: ['electrician'],
  garbage: ['sanitation'],
  facility: ['maintenance'],
  noise: ['noise_control'],
  leak_plumbing_electrical: ['plumbing_electrical_repair'],
  cleaning: ['cleaner'],
  masonry: ['masonry_odd_job'],
  others: [],
};

export function professionLabel(code: string): string {
  return PROFESSIONS.find((p) => p.code === code)?.label ?? code;
}
