/**
 * Progressive AllWalesSport full scrape runner with local resume state.
 * File: ingestion/run-allwalessport-full.ts
 */
import './load-env';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { supabaseAdmin } from './lib/supabaseAdmin';
import { runParse } from './parsers/run-parse';
import { runPersistAllWalesSport } from './sources/allwalessport/persist';
import { loadAllWalesSportConfig, runAllWalesSportDiscovery } from './sources/allwalessport';
import { createAllWalesSportHttpClient } from './sources/allwalessport/http';
import { discoverCompetitionsFromNav } from './sources/allwalessport/discovery';

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 3000;
const RATE_LIMIT_PER_SECOND = 2;

type State = {
  offset: number;
  lastProcessedCid?: number;
  updatedAt?: string;
};

const STATE_DIR = join(__dirname, 'state');
const STATE_PATH = join(STATE_DIR, 'allwalessport.json');

function loadState(): State {
  if (!existsSync(STATE_PATH)) return { offset: 0 };
  try {
    const raw = readFileSync(STATE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as State;
    if (typeof parsed.offset !== 'number' || !Number.isFinite(parsed.offset)) {
      return { offset: 0 };
    }
    return parsed;
  } catch {
    return { offset: 0 };
  }
}

function saveState(state: State): void {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const config = loadAllWalesSportConfig();
  config.rateLimitPerSecond = RATE_LIMIT_PER_SECOND;

  const httpClient = createAllWalesSportHttpClient({
    baseUrl: config.baseUrl,
    userAgent: config.userAgent,
    requestTimeoutMs: config.requestTimeoutMs,
    rateLimitPerSecond: config.rateLimitPerSecond,
  });

  const discovery = await discoverCompetitionsFromNav({ config, httpClient });
  if (discovery.error) {
    console.error('[ingestion] AllWalesSport full discovery failed:', discovery.error);
    process.exit(1);
  }

  const competitions = discovery.competitions
    .slice()
    .sort((a, b) => a.cid - b.cid);
  const total = competitions.length;

  const dryRun = process.env.INGEST_DRY_RUN === '1';
  const state = loadState();
  let offset = Math.max(0, Math.min(state.offset ?? 0, total));

  console.info('[ingestion] AllWalesSport full run start', {
    totalCompetitions: total,
    batchSize: BATCH_SIZE,
    batchDelayMs: BATCH_DELAY_MS,
    rateLimitPerSecond: RATE_LIMIT_PER_SECOND,
    maxConcurrentCompetitions: 3,
    offset,
    dryRun,
  });

  while (offset < total) {
    const batch = competitions.slice(offset, offset + BATCH_SIZE);
    if (batch.length === 0) break;
    const allowlist = batch.map((c) => c.cid);
    const runConfig = {
      ...config,
      competitionCidAllowlist: allowlist,
      maxCompetitionsScraped: allowlist.length,
    };

    const discoveryResult = await runAllWalesSportDiscovery({
      config: runConfig,
      httpClient,
      supabase: supabaseAdmin,
      dryRun,
    });
    if (discoveryResult.error) {
      console.error('[ingestion] AllWalesSport batch failed:', discoveryResult.error);
      process.exit(1);
    }

    const parseResult = await runParse({ supabase: supabaseAdmin });
    if (parseResult.error) {
      console.warn('[ingestion] parse stage error:', parseResult.error);
    }

    if (!dryRun) {
      const persistResult = await runPersistAllWalesSport({ supabase: supabaseAdmin });
      if (persistResult.error) {
        console.warn('[ingestion] persist stage error:', persistResult.error);
      }
    }

    offset += batch.length;
    saveState({
      offset,
      lastProcessedCid: batch[batch.length - 1]?.cid,
      updatedAt: new Date().toISOString(),
    });

    console.info('[ingestion] AllWalesSport batch complete', {
      offset,
      remaining: Math.max(0, total - offset),
    });

    if (offset < total) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.info('[ingestion] AllWalesSport full run complete', { totalCompetitions: total });
}

main().catch((err) => {
  console.error('[ingestion] fatal:', err?.message ?? String(err));
  process.exit(1);
});
