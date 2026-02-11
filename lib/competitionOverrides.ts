/**
 * Explicit display overrides for competitions prone to mislabel.
 * Prevents AllWalesSport "Division 1/2/3" etc from being confused with WRU regional names.
 * Map by (source, source_ref) or (source, normalised raw name) -> displayName.
 * File: lib/competitionOverrides.ts
 */

export type OverrideKey = { source: string; source_ref: string };
export type DisplayOverride = { displayName: string };

/** By (source, source_ref). Use when source_ref is stable (e.g. AllWalesSport cid, MyWRU groupId). */
const BY_SOURCE_REF = new Map<string, DisplayOverride>();

function srKey(source: string, source_ref: string): string {
  return `${source}:${source_ref}`;
}

/** By (source, normalised name) for fallback when source_ref not in map. */
const BY_RAW_NAME = new Map<string, DisplayOverride>();

function nameKey(source: string, rawName: string): string {
  return `${source}:${(rawName ?? '').toLowerCase().trim()}`;
}

/** Register override by source_ref (preferred). */
export function addOverrideBySourceRef(source: string, source_ref: string, displayName: string): void {
  BY_SOURCE_REF.set(srKey(source, source_ref), { displayName });
}

/** Register override by raw name (fallback for "Division 1", "Pool A", etc.). */
export function addOverrideByRawName(source: string, rawName: string, displayName: string): void {
  BY_RAW_NAME.set(nameKey(source, rawName), { displayName });
}

/**
 * Get display name override for a competition. Returns override displayName or null.
 */
export function getDisplayOverride(
  source: string | null,
  source_ref: string | null,
  rawName: string
): string | null {
  if (!source) return null;
  if (source_ref != null && source_ref !== '') {
    const o = BY_SOURCE_REF.get(srKey(source, String(source_ref)));
    if (o) return o.displayName;
  }
  const o = BY_RAW_NAME.get(nameKey(source, rawName));
  return o ? o.displayName : null;
}

/** True if name looks like a placeholder (Default, Competition <id>, or UUID). */
function isPlaceholderName(name: string): boolean {
  const n = (name ?? '').trim().toLowerCase();
  if (!n || n === 'default') return true;
  if (/^competition\s+[\da-f-]+$/i.test(n)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(n)) return true;
  return false;
}

/** User-facing competition name. Never returns "Default" or "Competition <id>". Uses overrides then competitions.name or "Super Rygbi Cymru". */
export function getCompetitionDisplayName(
  source: string | null,
  source_ref: string | null,
  rawName: string,
  slug?: string | null
): string {
  const override = getDisplayOverride(source, source_ref, rawName ?? '');
  if (override) return override;
  const name = (rawName ?? '').trim();
  if (isPlaceholderName(name)) {
    if (__DEV__ && typeof console !== 'undefined' && console.warn) {
      console.warn('[competition] Missing or Default name – showing Super Rygbi Cymru', { source, source_ref, slug });
    }
    return 'Super Rygbi Cymru';
  }
  return name;
}

// --- Explicit overrides: Division, West/East/Central/North Wales, Pool A/B/C/D, Age grade ---
// These are applied in addition to category taxonomy so "Default" and generic names get clearer labels.

function initOverrides(): void {
  // Division entries: avoid confusion with regional "West Central 3" etc. Be explicit.
  for (const d of [1, 2, 3, 4, 5, 6]) {
    addOverrideByRawName('allwalessport', `Division ${d}`, `Welsh National Leagues – Division ${d}`);
    addOverrideByRawName('mywru', `Division ${d}`, `Welsh National Leagues – Division ${d}`);
  }
  // Division splits as listed on WRU (East/West/North/Central etc).
  const divisionSplits = [
    'East',
    'West',
    'North',
    'Central',
    'East Central',
    'West Central',
    'North East',
    'North West',
    'East Wales',
    'West Wales',
  ];
  for (const d of [1, 2, 3, 4, 5, 6]) {
    for (const s of divisionSplits) {
      addOverrideByRawName('mywru', `Division ${d} ${s}`, `Welsh National Leagues – Division ${d} ${s}`);
    }
  }
  // Generic geography: do not merge with specific WRU divisions.
  const regions = ['West Wales', 'East Wales', 'Central Wales', 'North Wales', 'West Central', 'East Central'];
  for (const r of regions) {
    addOverrideByRawName('allwalessport', r, `Welsh Regional – ${r}`);
    addOverrideByRawName('mywru', r, `Welsh Regional – ${r}`);
  }
  // WRU Men's National League: canonical display (WRU is authoritative).
  for (const n of [1, 2, 3]) {
    addOverrideByRawName('mywru', `West Central ${n}`, `WRU Men's National League West Central ${n}`);
    addOverrideByRawName('mywru', `East ${n}`, `WRU Men's National League East ${n}`);
    addOverrideByRawName('mywru', `West ${n}`, `WRU Men's National League West ${n}`);
    addOverrideByRawName('mywru', `North ${n}`, `WRU Men's National League North ${n}`);
  }
  addOverrideByRawName('mywru', 'West Central 3', `WRU Men's National League West Central 3`);
  addOverrideByRawName('mywru', 'East Central 2', `WRU Men's National League East Central 2`);
  addOverrideByRawName('mywru', 'North West 3', `WRU Men's National League North West 3`);
  // Pool A/B/C/D: show under parent competition name.
  for (const p of ['A', 'B', 'C', 'D']) {
    addOverrideByRawName('allwalessport', `Pool ${p}`, `Pool ${p}`);
    addOverrideByRawName('mywru', `Pool ${p}`, `Pool ${p}`);
  }
  // Age grade: title so they are clearly U12–U16 and in their own category.
  addOverrideByRawName('mywru', 'Regional Age Grade U12s to U16s', 'Regional Age Grade (U12–U16)');
  addOverrideByRawName('allwalessport', 'Regional Age Grade U12s to U16s', 'Regional Age Grade (U12–U16)');
  for (const age of [12, 13, 14, 15, 16]) {
    addOverrideByRawName('mywru', `U${age}`, `Regional Age Grade U${age}`);
    addOverrideByRawName('allwalessport', `U${age}`, `Regional Age Grade U${age}`);
    addOverrideByRawName('mywru', `U${age}s`, `Regional Age Grade U${age}`);
    addOverrideByRawName('allwalessport', `U${age}s`, `Regional Age Grade U${age}`);
  }
  // WRU regional leagues (Cardiff, Dragons, Ospreys, Blues).
  const regionsByName = ['Cardiff Rugby', 'Dragons', 'Ospreys', 'Blues', 'Scarlets'];
  for (const r of regionsByName) {
    addOverrideByRawName('mywru', r, `WRU Regional Leagues – ${r}`);
  }
}

initOverrides();
