/**
 * Production HTTP client for ingestion.
 * - baseUrl, rate limiting, retries (429/5xx) with exponential backoff, timeout
 * - Persistent cache in ingestion/.cache (sha256 key); respects --no-cache via DISABLE_CACHE
 * - Logs never include full URLs, headers, or body (no secrets).
 * File: ingestion/lib/http.ts
 */

import { createHash } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

declare const __dirname: string;
const getCacheDir = (): string => {
  if (typeof __dirname !== 'undefined') return join(__dirname, '..', '.cache');
  const g = globalThis as unknown as { __ingestCacheDir?: string };
  if (typeof g.__ingestCacheDir === 'string') {
    return g.__ingestCacheDir;
  }
  return join(process.cwd(), 'ingestion', '.cache');
};

const USER_AGENT =
  'CymruRugbyIngest/1.0 (contact: admin@yourdomain)';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MIN_DELAY_MS = 1000;
const MAX_RETRIES = 4;
const INITIAL_BACKOFF_MS = 1000;

/** Sanitize URL for logging: pathname only, no query/fragment or host. */
function sanitizeForLog(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname || '/';
  } catch {
    return '[invalid-url]';
  }
}

function cacheKey(url: string, method: string): string {
  return createHash('sha256').update(`${method}:${url}`).digest('hex');
}

export type IngestHttpClientOptions = {
  baseUrl: string;
  minDelayMs?: number;
  timeoutMs?: number;
  cacheDir?: string;
  /** When true, skip reading and writing cache. Set by DISABLE_CACHE=1 or --no-cache. */
  skipCache?: boolean;
  maxRequestsPerRun?: number;
  /** Optional User-Agent; default is CymruRugbyIngest/1.0. */
  userAgent?: string;
};

export type IngestHttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  fromCache: boolean;
};

export function createIngestHttpClient(options: IngestHttpClientOptions): IngestHttpClient {
  return new IngestHttpClient(options);
}

export class IngestHttpClient {
  private readonly baseUrl: string;
  private readonly minDelayMs: number;
  private readonly timeoutMs: number;
  private readonly cacheDir: string;
  private readonly skipCache: boolean;
  private readonly maxRequestsPerRun: number;
  private readonly userAgent: string;
  private lastRequestTime = 0;
  private requestCountThisRun = 0;

  constructor(options: IngestHttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.minDelayMs = options.minDelayMs ?? DEFAULT_MIN_DELAY_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.cacheDir = options.cacheDir ?? getCacheDir();
    this.skipCache = options.skipCache ?? process.env.DISABLE_CACHE === '1';
    this.maxRequestsPerRun = options.maxRequestsPerRun ?? 500;
    this.userAgent = options.userAgent ?? USER_AGENT;
  }

  /** Resolve URL: path can be absolute URL or path relative to baseUrl. */
  resolveUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return `${this.baseUrl}${path}`;
  }

  /** Enforce rate limit: wait until minDelayMs has passed since last request. */
  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /** Check if we've hit max requests per run. */
  hasReachedRequestLimit(): boolean {
    return this.requestCountThisRun >= this.maxRequestsPerRun;
  }

  /** Read from cache if present and cache not disabled. */
  private readCache(key: string): string | null {
    if (this.skipCache) return null;
    const filePath = join(this.cacheDir, key);
    try {
      if (existsSync(filePath)) {
        return readFileSync(filePath, 'utf8');
      }
    } catch {
      // ignore read errors
    }
    return null;
  }

  /** Write to cache if cache not disabled. */
  private writeCache(key: string, body: string): void {
    if (this.skipCache) return;
    try {
      if (!existsSync(this.cacheDir)) {
        mkdirSync(this.cacheDir, { recursive: true });
      }
      const filePath = join(this.cacheDir, key);
      writeFileSync(filePath, body, 'utf8');
    } catch (e) {
      const pathForLog = sanitizeForLog(this.baseUrl);
      console.warn(`[IngestHttp] cache write failed for ${pathForLog}:`, (e as Error).message);
    }
  }

  /**
   * GET with rate limiting, retries (429/5xx + exponential backoff), timeout, and cache.
   * Logs use pathname only (no query/fragment) and never print headers or body.
   */
  async get(pathOrUrl: string): Promise<IngestHttpResponse> {
    if (this.hasReachedRequestLimit()) {
      throw new Error(
        `IngestHttpClient: maxRequestsPerRun (${this.maxRequestsPerRun}) reached`
      );
    }

    const url = this.resolveUrl(pathOrUrl);
    const pathForLog = sanitizeForLog(url);
    const key = cacheKey(url, 'GET');

    const cached = this.readCache(key);
    if (cached != null) {
      console.info(`[IngestHttp] GET ${pathForLog} from cache`);
      return {
        status: 200,
        headers: {},
        body: cached,
        fromCache: true,
      };
    }

    this.requestCountThisRun += 1;
    let lastError: Error | null = null;
    let backoffMs = INITIAL_BACKOFF_MS;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.rateLimit();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const start = Date.now();
        const res = await fetch(url, {
          method: 'GET',
          headers: { 'User-Agent': this.userAgent },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const duration = Date.now() - start;

        const status = res.status;
        const shouldRetry =
          status === 429 || (status >= 500 && status < 600);
        const body = await res.text();

        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          headers[k.toLowerCase()] = v;
        });

        if (shouldRetry && attempt < MAX_RETRIES) {
          console.warn(
            `[IngestHttp] GET ${pathForLog} ${status} (attempt ${attempt + 1}), retry in ${backoffMs}ms`
          );
          await new Promise((r) => setTimeout(r, backoffMs));
          backoffMs = Math.min(backoffMs * 2, 30_000);
          continue;
        }

        console.info(
          `[IngestHttp] GET ${pathForLog} ${status} ${duration}ms`
        );

        if (status >= 200 && status < 300) {
          this.writeCache(key, body);
        }

        return {
          status,
          headers,
          body,
          fromCache: false,
        };
      } catch (e) {
        lastError = e as Error;
        const message =
          lastError.name === 'AbortError'
            ? 'timeout'
            : (lastError.message || 'unknown');
        console.warn(
          `[IngestHttp] GET ${pathForLog} error (attempt ${attempt + 1}): ${message}`
        );
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, backoffMs));
          backoffMs = Math.min(backoffMs * 2, 30_000);
        }
      }
    }

    throw lastError ?? new Error(`GET ${pathForLog} failed after retries`);
  }
}
