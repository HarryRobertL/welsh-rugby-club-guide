/**
 * Single source of truth for team display name. Never returns "[object Object]".
 * Use for home_team_name / away_team_name from fixtures and standings.
 */

export function teamLabel(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v.trim() || '—';
  if (Array.isArray(v)) return teamLabel(v[0]);
  if (typeof v !== 'object') return '—';
  const o = v as Record<string, unknown>;
  const name = o.name ?? o.organisationName;
  if (typeof name !== 'string') return '—';
  return name.trim() || '—';
}

/** Ensures a value is stored as a string for display; use in hooks before setting home_team_name/away_team_name. */
export function ensureString(x: unknown): string {
  if (typeof x === 'string' && x.trim()) return x.trim();
  return '—';
}
