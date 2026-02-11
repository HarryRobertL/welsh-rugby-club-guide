/**
 * Derive competition type from name for display and ingestion.
 * Women's competitions and age-grade (junior) must show correctly.
 */

export type CompetitionTypeLabel = 'men' | 'women' | 'junior' | 'university';

/**
 * Returns the competition type to use based on the competition name.
 * - Name contains "woman"/"women" → women
 * - Name suggests age grade (U12–U16, Age Grade, Junior, etc.) → junior
 * - Name suggests university (BUCS, University) → university
 * - Else → men
 */
export function deriveCompetitionTypeFromName(name: string | null | undefined): CompetitionTypeLabel {
  const n = (name ?? '').trim().toLowerCase();
  if (!n) return 'men';
  if (/\bwomen?\b/.test(n) || n.includes("women's") || n.includes('womens')) return 'women';
  if (/\bu1[2-6]s?\b|\bu20\b|age\s*grade|junior|regional\s*age|rgc\s*cup\s*u1[2-6]/i.test(n)) return 'junior';
  if (/\buniversity|universities|bucs\b/i.test(n)) return 'university';
  return 'men';
}
