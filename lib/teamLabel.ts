/**
 * Single source of truth for team display name. Never returns "[object Object]".
 * Use for home_team_name / away_team_name from fixtures and standings.
 * Handles: null, string, array (first element), object with name/organisationName/organisation_name
 * (camel and snake_case for Supabase/WRU), and nested name objects (e.g. { en: "X" }).
 */

const PLACEHOLDER = '—';
const OBJECT_STRING = '[object Object]';

export function teamLabel(v: unknown): string {
  if (v == null) return PLACEHOLDER;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s.length === 0 || s === OBJECT_STRING) return PLACEHOLDER;
    return s;
  }
  if (Array.isArray(v)) return teamLabel(v[0]);
  if (typeof v !== 'object') return PLACEHOLDER;
  const o = v as Record<string, unknown>;
  const name = o.name ?? o.organisationName ?? o.organisation_name;
  if (name == null) return PLACEHOLDER;
  if (typeof name === 'string') {
    const s = name.trim();
    if (s.length === 0 || s === OBJECT_STRING) return PLACEHOLDER;
    return s;
  }
  if (typeof name === 'object' && name !== null) {
    const nested = name as Record<string, unknown>;
    const en = nested.en ?? nested.displayName ?? nested.value;
    if (typeof en === 'string' && en.trim() && en !== OBJECT_STRING) return en.trim();
  }
  return PLACEHOLDER;
}

/** Ensures a value is stored as a string for display; use in hooks before setting home_team_name/away_team_name. */
export function ensureString(x: unknown): string {
  if (typeof x === 'string' && x.trim() && x !== OBJECT_STRING) return x.trim();
  const fromLabel = teamLabel(x);
  return fromLabel !== OBJECT_STRING ? fromLabel : PLACEHOLDER;
}

/** Guarantees a string safe for display/params: never object, never "[object Object]". Use when setting state or passing to routes. */
export function toTeamDisplayString(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : teamLabel(v);
  if (typeof s !== 'string' || s === OBJECT_STRING || s.length === 0) return PLACEHOLDER;
  return s;
}
