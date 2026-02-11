/**
 * AllWalesSport competition discovery from the rugby union left nav.
 * Fetches baseUrl + sportPath (with Sport=1), parses links containing rugby-union.aspx?cid=,
 * deduplicates by cid, applies allowlist / startCompetitionCid / maxCompetitionsDiscovered.
 * Does not scrape individual competition pages.
 * File: ingestion/sources/allwalessport/discovery.ts
 */

import type { CheerioAPI } from 'cheerio';
import type { AllWalesSportConfig } from '../../../types/ingestion';
import type { AllWalesSportHttpClient } from './http';

export type DiscoveredCompetition = {
  cid: number;
  label: string;
  url: string;
  categorySlug?: string;
  sortOrder?: number;
};

const CID_PATTERN = /rugby-union\.aspx\?([^#]*?)cid=(\d+)/i;

function parseCidFromHref(href: string): number | null {
  const match = href.match(CID_PATTERN);
  if (!match) return null;
  const n = parseInt(match[2], 10);
  return Number.isNaN(n) ? null : n;
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function slugify(label: string): string {
  const base = normalizeText(label)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'category';
}

/**
 * Build entry URL: baseUrl + sportPath, with Sport=1 added if not already present.
 */
export function buildEntryUrl(config: AllWalesSportConfig): string {
  const base = config.baseUrl.replace(/\/$/, '');
  const path = config.sportPath.startsWith('/') ? config.sportPath : `/${config.sportPath}`;
  const pathAndQuery = path.split('?');
  const pathOnly = pathAndQuery[0];
  const existingQuery = pathAndQuery[1] ?? '';
  const params = new URLSearchParams(existingQuery);
  if (!params.has('Sport')) {
    params.set('Sport', '1');
  }
  const qs = params.toString();
  return qs ? `${base}${pathOnly}?${qs}` : `${base}${pathOnly}`;
}

export type CompetitionCategoryNode = {
  name: string;
  slug: string;
  sortOrder: number;
  cid?: number;
  url?: string;
  children: CompetitionCategoryNode[];
};

function absoluteUrl(baseUrl: string, href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  const base = baseUrl.replace(/\/$/, '');
  const path = href.startsWith('/') ? href : `/${href}`;
  return `${base}${path}`;
}

/**
 * Extract competition categories from the document (left nav).
 * Parses nested list structure into a tree; nodes may have cid and children.
 */
export function extractCategoryTreeFromDocument(
  $: CheerioAPI,
  baseUrl: string
): CompetitionCategoryNode[] {
  const nodes: CompetitionCategoryNode[] = [];
  const usedRoot = new Set<string>();
  const usedChildren = new Map<string, Set<string>>();
  const links = $('a[href*="rugby-union.aspx?cid="]');
  if (links.length === 0) return nodes;
  let currentParent: CompetitionCategoryNode | null = null;
  let parentIndex = 0;
  let childIndex = 0;

  links.each((_, el) => {
    const href = $(el).attr('href');
    const cid = href ? parseCidFromHref(href) : null;
    if (cid == null) return;
    const name = normalizeText($(el).text()) || (cid === 0 ? 'Category' : `Competition ${cid}`);

    if (cid === 0) {
      let slug = slugify(name);
      if (usedRoot.has(slug)) {
        let n = 2;
        while (usedRoot.has(`${slug}-${n}`)) n += 1;
        slug = `${slug}-${n}`;
      }
      usedRoot.add(slug);
      currentParent = {
        name,
        slug,
        sortOrder: parentIndex++,
        children: [],
      };
      nodes.push(currentParent);
      childIndex = 0;
      return;
    }

    if (!currentParent) {
      let slug = 'competitions';
      if (usedRoot.has(slug)) {
        let n = 2;
        while (usedRoot.has(`${slug}-${n}`)) n += 1;
        slug = `${slug}-${n}`;
      }
      usedRoot.add(slug);
      currentParent = {
        name: 'Competitions',
        slug,
        sortOrder: parentIndex++,
        children: [],
      };
      nodes.push(currentParent);
      childIndex = 0;
    }

    const childUsed = usedChildren.get(currentParent.slug) ?? new Set<string>();
    usedChildren.set(currentParent.slug, childUsed);
    let childSlug = `${currentParent.slug}-${slugify(name)}`;
    if (childUsed.has(childSlug)) {
      let n = 2;
      while (childUsed.has(`${childSlug}-${n}`)) n += 1;
      childSlug = `${childSlug}-${n}`;
    }
    childUsed.add(childSlug);
    currentParent.children.push({
      name,
      slug: childSlug,
      sortOrder: childIndex++,
      cid,
      url: href ? absoluteUrl(baseUrl, href) : undefined,
      children: [],
    });
  });

  return nodes;
}

export function collectCompetitionsFromTree(
  nodes: CompetitionCategoryNode[]
): DiscoveredCompetition[] {
  const out: DiscoveredCompetition[] = [];
  const walk = (items: CompetitionCategoryNode[]): void => {
    for (const node of items) {
      if (node.cid && node.url) {
        out.push({
          cid: node.cid,
          label: node.name,
          url: node.url,
          categorySlug: node.slug,
          sortOrder: node.sortOrder,
        });
      }
      if (node.children.length > 0) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

export function filterCategoryTreeByCids(
  nodes: CompetitionCategoryNode[],
  allowedCids: Set<number>
): CompetitionCategoryNode[] {
  const out: CompetitionCategoryNode[] = [];
  for (const node of nodes) {
    const children = filterCategoryTreeByCids(node.children, allowedCids);
    const includeSelf = node.cid != null && allowedCids.has(node.cid);
    if (includeSelf || children.length > 0) {
      out.push({ ...node, children });
    }
  }
  return out;
}

/**
 * Apply config filters: allowlist (CID and/or exact name), or startCompetitionCid, or maxCompetitionsDiscovered.
 * When allowlist is set, only allowlisted competitions are returned (All Wales Sport never competes with WRU).
 * When no allowlist and no startCompetitionCid, returns [] so we do not ingest any All Wales Sport by default.
 */
export function applyCompetitionFilters(
  list: DiscoveredCompetition[],
  config: AllWalesSportConfig
): DiscoveredCompetition[] {
  const cidAllowlist = config.competitionCidAllowlist;
  const nameAllowlist = config.competitionNameAllowlist;
  const hasAllowlist = (cidAllowlist?.length ?? 0) > 0 || (nameAllowlist?.length ?? 0) > 0;
  if (hasAllowlist) {
    const cidSet = new Set(cidAllowlist ?? []);
    const nameSet = new Set((nameAllowlist ?? []).map((n) => n.trim().toLowerCase()));
    return list.filter(
      (c) =>
        cidSet.has(c.cid) ||
        nameSet.has((c.label ?? '').trim().toLowerCase())
    );
  }
  if (config.startCompetitionCid != null) {
    return list.filter((c) => c.cid === config.startCompetitionCid);
  }
  return [];
}

export type DiscoverCompetitionsFromNavOptions = {
  config: AllWalesSportConfig;
  httpClient: AllWalesSportHttpClient;
};

export type DiscoverCompetitionsFromNavResult = {
  error: string | null;
  competitions: DiscoveredCompetition[];
  categories: CompetitionCategoryNode[];
};

/**
 * Fetch rugby union entry page, parse left nav for cid links, dedupe and apply config filters.
 */
export async function discoverCompetitionsFromNav(
  options: DiscoverCompetitionsFromNavOptions
): Promise<DiscoverCompetitionsFromNavResult> {
  const { config, httpClient } = options;
  const entryUrl = buildEntryUrl(config);
  try {
    const $ = await httpClient.fetchDocument(entryUrl);
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const tree = extractCategoryTreeFromDocument($, baseUrl);
    const raw = collectCompetitionsFromTree(tree);
    const competitions = applyCompetitionFilters(raw, config);
    const allowed = new Set(competitions.map((c) => c.cid));
    const categories = filterCategoryTreeByCids(tree, allowed);
    return { error: null, competitions, categories };
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    return { error: message, competitions: [], categories: [] };
  }
}
