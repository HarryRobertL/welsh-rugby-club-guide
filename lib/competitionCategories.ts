/**
 * Competition category taxonomy for the Competitions tab.
 * Maps competition name/slug to category so leagues are grouped correctly.
 * File: lib/competitionCategories.ts
 */

export type CategoryId =
  | 'international'
  | 'professional'
  | 'welsh_regions'
  | 'national_leagues'
  | 'regional_leagues'
  | 'age_grade'
  | 'cups_plates'
  | 'memorial_cups'
  | 'services_district'
  | 'universities'
  | 'other';

export type CompetitionCategory = {
  id: CategoryId;
  title: string;
  order: number;
};

export const COMPETITION_CATEGORIES: CompetitionCategory[] = [
  { id: 'international', title: '🌍 International Rugby', order: 1 },
  { id: 'professional', title: '🏟️ Professional & Elite Rugby', order: 2 },
  { id: 'welsh_regions', title: '🟥 Welsh Regions', order: 3 },
  { id: 'national_leagues', title: '🏆 Welsh National Leagues', order: 4 },
  { id: 'regional_leagues', title: '🧭 Regional Leagues', order: 5 },
  { id: 'age_grade', title: '🏉 Regional Age Grade (U12–U16)', order: 6 },
  { id: 'cups_plates', title: '🏉 Cups & Plates', order: 7 },
  { id: 'memorial_cups', title: '🏅 Memorial & Invitational Cups', order: 8 },
  { id: 'services_district', title: '🚓 Services & District Rugby', order: 9 },
  { id: 'universities', title: '🎓 Universities & Colleges', order: 10 },
  { id: 'other', title: 'Other', order: 11 },
];

/** Patterns (lowercase) that match competition name. First matching category wins. More specific (e.g. regional) before broad (national). */
const CATEGORY_PATTERNS: { id: CategoryId; patterns: string[] }[] = [
  {
    id: 'international',
    patterns: [
      '6 nations',
      'six nations',
      'autumn series',
      'summer series',
      'rugby world cup',
      'world cup',
      'british & irish lions',
      'b & i lions',
      'international',
      'friendlies',
      'u20',
      'u20s',
    ],
  },
  {
    id: 'professional',
    patterns: [
      'united rugby championship',
      'urc',
      'gallagher premiership',
      'rugby championship',
      'super rugby',
      'european champions cup',
      'europe champions cup',
      'european challenge cup',
      'europe challenge cup',
      'rfu championship',
    ],
  },
  {
    id: 'welsh_regions',
    patterns: ['cardiff rugby', 'scarlets', 'ospreys', 'dragons', 'blues', 'welsh regions', 'regions'],
  },
  {
    id: 'regional_leagues',
    patterns: [
      '1 east',
      '1 west',
      '1 central',
      '1 north',
      '2 east',
      '2 west',
      'east wales',
      'west wales',
      'north wales',
      'east ospreys',
      'wru east',
      'wru west',
      'wru north',
      'west central',
      'east central',
    ],
  },
  {
    id: 'national_leagues',
    patterns: [
      'championship east',
      'championship west',
      'championship',
      'premiership',
      'premier 15',
      'division 1',
      'division 1 east',
      'division 1 west',
      'division 1 north',
      'division 1 central',
      'division 2',
      'division 2 east',
      'division 2 west',
      'division 2 north',
      'division 2 central',
      'division 3',
      'division 3 east',
      'division 3 west',
      'division 3 north',
      'division 3 north east',
      'division 3 north west',
      'division 3 central',
      'division 4',
      'division 4 east',
      'division 4 west',
      'division 4 north',
      'division 4 central',
      'division 5',
      'division 5 east',
      'division 5 west',
      'division 5 north',
      'division 5 central',
      'division 6',
      'division 6 east',
      'division 6 west',
      'division 6 north',
      'division 6 central',
    ],
  },
  {
    id: 'age_grade',
    patterns: [
      'regional age grade',
      'age grade',
      'u12',
      'u13',
      'u14',
      'u15',
      'u16',
      'under 12',
      'under 13',
      'under 14',
      'under 15',
      'under 16',
    ],
  },
  {
    id: 'cups_plates',
    patterns: [
      'championship cup',
      'premiership cup',
      'division 1 cup',
      'division 2 cup',
      'division 3 cup',
      'division 4 cup',
      'division 5 cup',
      'division 6 cup',
      'plate',
      'bowl',
      'shield',
      'src cup',
      'src trophy',
    ],
  },
  {
    id: 'memorial_cups',
    patterns: [
      'ben francis',
      'bryn meredith',
      'colin tuckwell',
      'cyrus davis',
      'enoch lewis',
      'ivor jones',
      'ivor williams',
      'keith jones',
      'malcolm thomas',
      'mallett cup',
      'mel davies',
      'ninian stuart',
      'reg buttress',
      'ron lucock',
      'vaughan sound',
      'ajt recycling',
    ],
  },
  {
    id: 'services_district',
    patterns: [
      'inter district',
      'police cup',
      'police plate',
      'police shield',
      'district',
      'psuk',
      'british police',
    ],
  },
  {
    id: 'universities',
    patterns: ['bucs', 'universities', 'colleges', 'tier 1 women'],
  },
];

function normalise(s: string): string {
  return (s ?? '').toLowerCase().trim();
}

/**
 * Returns the category id for a competition based on its name (and optionally slug).
 * Uses first matching category; if none match, returns 'other'.
 */
export function getCategoryForCompetition(name: string, _slug?: string): CategoryId {
  const n = normalise(name);
  if (!n) return 'other';

  for (const { id, patterns } of CATEGORY_PATTERNS) {
    if (id === 'other') continue;
    for (const p of patterns) {
      if (n.includes(p) || n === p) return id;
    }
  }

  return 'other';
}

/**
 * Group competitions by category, ordered by category order, then by name within each.
 */
export function groupCompetitionsByCategory<T extends { name: string; slug: string }>(
  competitions: T[]
): Map<CategoryId, T[]> {
  const byCategory = new Map<CategoryId, T[]>();

  for (const c of competitions) {
    const cat = getCategoryForCompetition(c.name, c.slug);
    const list = byCategory.get(cat) ?? [];
    list.push(c);
    byCategory.set(cat, list);
  }

  for (const list of byCategory.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  return byCategory;
}
