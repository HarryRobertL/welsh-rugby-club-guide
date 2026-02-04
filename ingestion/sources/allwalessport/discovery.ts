/**
 * AllWalesSport competition discovery from the rugby union left nav.
 * Fetches baseUrl + sportPath (with Sport=1), parses links containing rugby-union.aspx?cid=,
 * deduplicates by cid, applies allowlist / startCompetitionCid / maxCompetitions.
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
};

const CID_PATTERN = /rugby-union\.aspx\?([^#]*?)cid=(\d+)/i;

function parseCidFromHref(href: string): number | null {
  const match = href.match(CID_PATTERN);
  if (!match) return null;
  const n = parseInt(match[2], 10);
  return Number.isNaN(n) ? null : n;
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

/**
 * Extract competition links from the document (left nav).
 * Selects all a[href*="rugby-union.aspx?cid="], extracts cid and label, deduplicates by cid (first wins).
 */
export function extractCompetitionsFromDocument(
  $: CheerioAPI,
  baseUrl: string
): DiscoveredCompetition[] {
  const base = baseUrl.replace(/\/$/, '');
  const seen = new Set<number>();
  const out: DiscoveredCompetition[] = [];

  $('a[href*="rugby-union.aspx?cid="]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const cid = parseCidFromHref(href);
    if (cid === null || cid === 0) return;
    if (seen.has(cid)) return;
    seen.add(cid);

    let label = $(el).text().trim();
    if (!label) label = `Competition ${cid}`;

    let url: string;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      url = href;
    } else {
      const path = href.startsWith('/') ? href : `/${href}`;
      url = `${base}${path}`;
    }

    out.push({ cid, label, url });
  });

  return out;
}

/**
 * Apply config filters: allowlist, or startCompetitionCid, or maxCompetitions.
 */
export function applyCompetitionFilters(
  list: DiscoveredCompetition[],
  config: AllWalesSportConfig
): DiscoveredCompetition[] {
  const allowlist = config.competitionCidAllowlist;
  if (allowlist && allowlist.length > 0) {
    const set = new Set(allowlist);
    return list.filter((c) => set.has(c.cid));
  }
  if (config.startCompetitionCid != null) {
    return list.filter((c) => c.cid === config.startCompetitionCid);
  }
  const max = config.maxCompetitions ?? 200;
  return list.slice(0, max);
}

export type DiscoverCompetitionsFromNavOptions = {
  config: AllWalesSportConfig;
  httpClient: AllWalesSportHttpClient;
};

export type DiscoverCompetitionsFromNavResult = {
  error: string | null;
  competitions: DiscoveredCompetition[];
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
    const raw = extractCompetitionsFromDocument($, baseUrl);
    const competitions = applyCompetitionFilters(raw, config);
    return { error: null, competitions };
  } catch (e) {
    const message = (e as Error).message ?? String(e);
    return { error: message, competitions: [] };
  }
}
