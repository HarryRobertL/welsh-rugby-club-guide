/**
 * Single source of truth for team display name.
 * Use for home_team_name / away_team_name from fixtures and standings.
 * Handles: null, string, array (first element), object with name/organisationName/organisation_name
 * (camel and snake_case for Supabase/WRU), and nested name objects (e.g. { en: "X" }).
 */

const PLACEHOLDER = 'TBC';
const OBJECT_STRING = '[object Object]';

export function isBadTeamString(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length === 0) return true;
  const lowered = trimmed.toLowerCase();
  return (
    lowered === OBJECT_STRING.toLowerCase() ||
    lowered.includes('object object') ||
    lowered === 'null' ||
    lowered === 'undefined'
  );
}

export function teamLabel(v: unknown): string {
  if (v == null) return PLACEHOLDER;
  if (typeof v === 'string') {
    const s = v.trim();
    if (isBadTeamString(s)) return PLACEHOLDER;
    return s;
  }
  if (Array.isArray(v)) return teamLabel(v[0]);
  if (typeof v !== 'object') return PLACEHOLDER;
  const o = v as Record<string, unknown>;
  const name = o.name ?? o.organisationName ?? o.organisation_name;
  if (name == null) return PLACEHOLDER;
  if (typeof name === 'string') {
    const s = name.trim();
    if (isBadTeamString(s)) return PLACEHOLDER;
    return s;
  }
  if (typeof name === 'object' && name !== null) {
    const nested = name as Record<string, unknown>;
    const en = nested.en ?? nested.displayName ?? nested.value;
    if (typeof en === 'string') {
      const s = en.trim();
      if (!isBadTeamString(s)) return s;
    }
  }
  return PLACEHOLDER;
}

/** Ensures a value is stored as a string for display; use in hooks before setting home_team_name/away_team_name. */
export function ensureString(x: unknown): string {
  if (typeof x === 'string' && !isBadTeamString(x)) return x.trim();
  const fromLabel = teamLabel(x);
  return isBadTeamString(fromLabel) ? PLACEHOLDER : fromLabel;
}

/** Guarantees a string safe for display/params: never object, never "[object Object]". Use when setting state or passing to routes. */
export function toTeamDisplayString(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : teamLabel(v);
  if (typeof s !== 'string' || isBadTeamString(s)) return PLACEHOLDER;
  return s;
}
