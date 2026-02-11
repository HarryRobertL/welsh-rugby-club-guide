/**
 * Production-grade HTTP client for AllWalesSport ingestion.
 * - fetch in Node (global fetch)
 * - Headers: User-Agent from config, Accept text/html, Accept-Language en-GB
 * - Retries: network failures and 429, 502, 503, 504 with exponential backoff (max 4 attempts)
 * - In-memory response cache keyed by URL for a single run
 * - Structured logging (url, status, bytes, durationMs, retry count)
 * - fetchHtml(url) -> html string; fetchDocument(url) -> Cheerio root
 * Unit-friendly: no process.exit; logger injectable.
 * File: ingestion/sources/allwalessport/http.ts
 */

import * as cheerio from 'cheerio';

const MAX_ATTEMPTS = 4;
const INITIAL_BACKOFF_MS = 1000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

export type AllWalesSportHttpLogData = {
  url?: string;
  status?: number;
  bytes?: number;
  durationMs?: number;
  retryCount?: number;
  fromCache?: boolean;
  error?: string;
};

export type AllWalesSportHttpLogger = {
  info: (message: string, data?: AllWalesSportHttpLogData) => void;
  warn: (message: string, data?: AllWalesSportHttpLogData) => void;
  error: (message: string, data?: AllWalesSportHttpLogData) => void;
};

/** Only these fields are safe to log (no secrets, no cookies). */
const SAFE_LOG_KEYS = new Set(['url', 'status', 'bytes', 'durationMs', 'retryCount', 'fromCache']);

function defaultLogger(): AllWalesSportHttpLogger {
  const prefix = '[AllWalesSportHttp]';
  const format = (msg: string, data?: AllWalesSportHttpLogData) => {
    if (!data || Object.keys(data).length === 0) return `${prefix} ${msg}`;
    const safe: Record<string, unknown> = {};
    for (const k of Object.keys(data)) {
      if (SAFE_LOG_KEYS.has(k)) (safe as Record<string, unknown>)[k] = (data as Record<string, unknown>)[k];
    }
    return `${prefix} ${msg} ${JSON.stringify(safe)}`;
  };
  return {
    info: (msg, data) => console.info(format(msg, data)),
    warn: (msg, data) => console.warn(format(msg, data)),
    error: (msg, data) => console.error(format(msg, data)),
  };
}

export type AllWalesSportHttpClientOptions = {
  baseUrl: string;
  userAgent: string;
  requestTimeoutMs: number;
  /** Requests per second; delay between requests in ms = 1000 / rateLimitPerSecond */
  rateLimitPerSecond?: number;
  logger?: AllWalesSportHttpLogger;
};

export type AllWalesSportHttpClient = {
  fetchHtml: (url: string) => Promise<string>;
  fetchDocument: (url: string) => Promise<cheerio.CheerioAPI>;
  /** Resolve path relative to baseUrl to full URL */
  resolveUrl: (pathOrUrl: string) => string;
};

export function createAllWalesSportHttpClient(
  options: AllWalesSportHttpClientOptions
): AllWalesSportHttpClient {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const timeoutMs = options.requestTimeoutMs ?? 15000;
  const rateLimitPerSecond = options.rateLimitPerSecond ?? 2;
  const minDelayMs = rateLimitPerSecond > 0 ? Math.ceil(1000 / rateLimitPerSecond) : 500;
  const logger = options.logger ?? defaultLogger();
  const cache = new Map<string, string>();
  let lastRequestTime = 0;
  /** Serialize rate limit so concurrent callers still respect req/s. */
  let slotPromise: Promise<void> = Promise.resolve();

  const defaultHeaders: Record<string, string> = {
    'User-Agent': options.userAgent,
    Accept: 'text/html',
    'Accept-Language': 'en-GB',
  };

  function resolveUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${baseUrl}${path}`;
  }

  async function rateLimit(): Promise<void> {
    const myTurn = slotPromise;
    let release: () => void;
    slotPromise = new Promise<void>((r) => {
      release = r;
    });
    await myTurn;
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    const waitMs = Math.max(0, minDelayMs - elapsed);
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    lastRequestTime = Date.now();
    release!();
  }

  async function fetchHtml(url: string): Promise<string> {
    const resolved = resolveUrl(url);
    const cached = cache.get(resolved);
    if (cached !== undefined) {
      logger.info('GET (from cache)', {
        url: resolved,
        status: 200,
        bytes: cached.length,
        durationMs: 0,
        retryCount: 0,
        fromCache: true,
      });
      return cached;
    }

    await rateLimit();
    let lastError: Error | null = null;
    let backoffMs = INITIAL_BACKOFF_MS;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(resolved, {
          method: 'GET',
          headers: defaultHeaders,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const durationMs = Date.now() - start;
        const body = await res.text();
        const bytes = body.length;

        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_ATTEMPTS - 1) {
          logger.warn('GET retryable status', {
            url: resolved,
            status: res.status,
            bytes,
            durationMs,
            retryCount: attempt + 1,
          });
          await new Promise((r) => setTimeout(r, backoffMs));
          backoffMs = Math.min(backoffMs * 2, 30_000);
          continue;
        }

        if (res.status < 200 || res.status >= 300) {
          lastError = new Error(`HTTP ${res.status}`);
          logger.error('GET failed', {
            url: resolved,
            status: res.status,
            bytes,
            durationMs,
            retryCount: attempt + 1,
            error: lastError.message,
          });
          throw lastError;
        }

        logger.info('GET', {
          url: resolved,
          status: res.status,
          bytes,
          durationMs,
          retryCount: attempt,
        });
        cache.set(resolved, body);
        return body;
      } catch (e) {
        const err = e as Error;
        lastError = err;
        const durationMs = Date.now() - start;
        const isNetwork = err.name === 'AbortError' || err.message?.includes('fetch') || !err.message?.startsWith('HTTP');
        logger.warn('GET error', {
          url: resolved,
          durationMs,
          retryCount: attempt + 1,
          error: err.message || String(e),
        });
        if (attempt < MAX_ATTEMPTS - 1 && isNetwork) {
          await new Promise((r) => setTimeout(r, backoffMs));
          backoffMs = Math.min(backoffMs * 2, 30_000);
          continue;
        }
        if (attempt < MAX_ATTEMPTS - 1 && !isNetwork) continue;
        throw lastError ?? err;
      }
    }

    throw lastError ?? new Error(`GET ${resolved} failed after ${MAX_ATTEMPTS} attempts`);
  }

  async function fetchDocument(url: string): Promise<cheerio.CheerioAPI> {
    const html = await fetchHtml(url);
    return cheerio.load(html);
  }

  return {
    fetchHtml,
    fetchDocument,
    resolveUrl,
  };
}

/** WRU Premiership competition id on AllWalesSport (for smoke test). */
export const WRU_PREMIERSHIP_CID = 16481;

/**
 * Smoke test: fetch WRU Premiership page by cid and log document title.
 * Call when DEBUG_ALLWALESSPORT=1. No process.exit; throws on failure.
 */
export async function runSmoke(options?: {
  baseUrl?: string;
  userAgent?: string;
  logger?: AllWalesSportHttpLogger;
}): Promise<void> {
  const baseUrl = options?.baseUrl ?? 'https://www.allwalessport.co.uk';
  const userAgent =
    options?.userAgent ??
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const client = createAllWalesSportHttpClient({
    baseUrl,
    userAgent,
    requestTimeoutMs: 15000,
    rateLimitPerSecond: 2,
    logger: options?.logger,
  });
  const url = `${baseUrl}/rugby-union.aspx?cid=${WRU_PREMIERSHIP_CID}`;
  const $ = await client.fetchDocument(url);
  const title = $('title').text().trim() || '(no title)';
  const logger = options?.logger ?? defaultLogger();
  logger.info(`Smoke: WRU Premiership page title: ${title}`, { url });
}

if (process.env.DEBUG_ALLWALESSPORT === '1') {
  setImmediate(() => {
    runSmoke().catch((e) => {
      console.error('[AllWalesSportHttp] smoke error', (e as Error).message);
    });
  });
}
