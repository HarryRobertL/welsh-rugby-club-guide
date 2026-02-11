/**
 * Competition display names. WRU is authoritative.
 * NEVER render "Competition <id>" or "Default" to users.
 * File: lib/competitionDisplay.ts
 */

import { getDisplayOverride } from './competitionOverrides';

const FALLBACK_COMPETITION_NAME = 'Super Rygbi Cymru';

/**
 * Returns the user-facing name for a competition.
 * - Uses override when available (WRU Men's National League West Central 3 etc).
 * - If name is missing or "Default", returns "Super Rygbi Cymru" and logs; never "Competition <id>".
 */
export function getCompetitionDisplayName(params: {
  name: string | null | undefined;
  slug: string | null | undefined;
  source?: string | null;
  source_ref?: string | null;
}): string {
  const { name, slug, source, source_ref } = params;
  const raw = (name ?? '').trim();
  const override = getDisplayOverride(source ?? null, source_ref ?? null, raw || (slug ?? ''));
  if (override) return override;
  if (!raw || raw.toLowerCase() === 'default') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[competitionDisplay] Missing or Default competition name', { source, source_ref, slug });
    }
    return FALLBACK_COMPETITION_NAME;
  }
  return raw;
}
