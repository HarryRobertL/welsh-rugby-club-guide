/**
 * Derive competition_type from competition name for ingestion.
 * Matches lib/competitionType.ts logic: women, junior, university, men.
 */

export type CompetitionTypeValue = 'men' | 'women' | 'junior' | 'university';

export function deriveCompetitionTypeFromName(name: string | null | undefined): CompetitionTypeValue {
  const n = (name ?? '').trim().toLowerCase();
  if (!n) return 'men';
  if (/\bwomen?\b/.test(n) || n.includes("women's") || n.includes('womens')) return 'women';
  if (/\bu1[2-6]s?\b|\bu20\b|age\s*grade|junior|regional\s*age|rgc\s*cup\s*u1[2-6]/i.test(n)) return 'junior';
  if (/\buniversity|universities|bucs\b/i.test(n)) return 'university';
  return 'men';
}
