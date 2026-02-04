/**
 * Ingestion runner entrypoint. Supports --no-cache to disable persistent cache.
 * Runs MyWRU discovery (when config has roots), then processes next pending job.
 * Use INGEST_SOURCE=allwalessport or --source=allwalessport to run only the AllWalesSport source.
 * Loads .env and .env.local so Supabase env vars are available.
 * Usage: npm run ingest [-- --no-cache] | INGEST_SOURCE=allwalessport npm run ingest
 * File: ingestion/run.ts
 */
import './load-env';

import { createIngestHttpClient } from './lib/http';
import { supabaseAdmin } from './lib/supabaseAdmin';
import { runNextIngestJob } from '../lib/ingestion/run-job';
import { runParse } from './parsers/run-parse';
import { loadMyWruConfig, runMyWruDiscovery } from './sources/mywru';
import { getSource } from './sources/registry';

// Side-effect: register allwalessport so getSource('allwalessport') works
import './sources/allwalessport';

function parseArgv(): { noCache: boolean; source?: string } {
  const args = process.argv.slice(2);
  const noCache = args.includes('--no-cache');
  let source: string | undefined;
  const sourceFlag = args.find((a) => a.startsWith('--source='));
  if (sourceFlag) {
    source = sourceFlag.slice('--source='.length).trim() || undefined;
  } else {
    const idx = args.indexOf('--source');
    if (idx >= 0 && args[idx + 1]) source = args[idx + 1].trim();
  }
  return { noCache, source };
}

function printMigrationReminderIfNeeded(message: string): void {
  if (
    /schema cache|relation .* does not exist|Could not find the table/i.test(
      message
    )
  ) {
    console.error(
      '[ingestion] Reminder: ensure Supabase migrations are applied (e.g. supabase db push or run migrations in the dashboard).'
    );
  }
}

async function main(): Promise<void> {
  const { noCache, source: sourceArg } = parseArgv();
  const source = sourceArg ?? process.env.INGEST_SOURCE;
  if (noCache) {
    process.env.DISABLE_CACHE = '1';
  }

  if (source === 'allwalessport') {
    const dryRun = process.env.INGEST_DRY_RUN === '1';
    if (dryRun) {
      console.info('[ingestion] AllWalesSport dry run: discovery and parsing only; DB persist skipped.');
    }
    const descriptor = getSource('allwalessport');
    if (!descriptor) {
      console.error('[ingestion] source allwalessport not registered');
      process.exit(1);
    }
    const result = await descriptor.run({ noCache, dryRun });
    if (result.error) {
      console.error('[ingestion] allwalessport failed:', result.error);
      printMigrationReminderIfNeeded(result.error);
      process.exit(1);
    }
    const parseResult = await runParse({ supabase: supabaseAdmin });
    if (parseResult.error) {
      console.warn('[ingestion] parse stage error:', parseResult.error);
      printMigrationReminderIfNeeded(parseResult.error);
    } else if (parseResult.processed > 0) {
      console.info('[ingestion] parse stage:', parseResult.processed, 'items');
    }
    if (dryRun) {
      console.info('[ingestion] dry run: skipping persist stage.');
      return;
    }
    const { runPersistAllWalesSport } = await import('./sources/allwalessport/persist');
    const persistResult = await runPersistAllWalesSport({ supabase: supabaseAdmin });
    if (persistResult.error) {
      console.warn('[ingestion] AllWalesSport persist error:', persistResult.error);
    }
    if (persistResult.competitionsProcessed > 0) {
      console.info('[ingestion] AllWalesSport persist:', {
        competitions: persistResult.competitionsProcessed,
        fixtures: persistResult.totalFixtures,
        results: persistResult.totalResults,
        standings: persistResult.totalStandings,
        teamsCreated: persistResult.totalTeamsCreated,
      });
    }
    if (persistResult.failures.length > 0) {
      console.warn('[ingestion] AllWalesSport persist failures:', persistResult.failures.length, persistResult.failures.slice(0, 5));
    }
    return;
  }

  const config = loadMyWruConfig();
  const requestOpts = config.request ?? {};
  const client = createIngestHttpClient({
    baseUrl: config.baseUrl,
    minDelayMs: requestOpts.minDelayMs ?? 1500,
    maxRequestsPerRun: requestOpts.maxRequestsPerRun ?? 400,
    skipCache: noCache || process.env.DISABLE_CACHE === '1',
  });
  const discoveryClient =
    config.groupsApiBaseUrl && config.groupsApiBaseUrl !== config.baseUrl
      ? createIngestHttpClient({
          baseUrl: config.groupsApiBaseUrl,
          minDelayMs: requestOpts.minDelayMs ?? 1500,
          maxRequestsPerRun: requestOpts.maxRequestsPerRun ?? 400,
          skipCache: noCache || process.env.DISABLE_CACHE === '1',
        })
      : client;

  if (config.roots && config.roots.length > 0) {
    const discovery = await runMyWruDiscovery({
      config,
      httpClient: discoveryClient,
      supabase: supabaseAdmin,
    });
    if (discovery.error) {
      console.error('[ingestion] MyWRU discovery failed:', discovery.error);
      printMigrationReminderIfNeeded(discovery.error);
      process.exit(1);
    }
    console.info('[ingestion] MyWRU discovery:', discovery.stats);
  }

  const result = await runNextIngestJob({
    httpClient: client,
    supabase: supabaseAdmin,
    config: {
      knownCompetitionOverviewUrls:
        config.knownCompetitionOverviewUrls ?? [],
    },
  });

  if (result.error) {
    console.error('[ingestion] run failed:', result.error);
    printMigrationReminderIfNeeded(result.error);
    process.exit(1);
  }
  if (result.jobId) {
    console.info('[ingestion] job completed:', result.jobId);
  }

  const parseResult = await runParse({ supabase: supabaseAdmin });
  if (parseResult.error) {
    console.warn('[ingestion] parse stage error:', parseResult.error);
    printMigrationReminderIfNeeded(parseResult.error);
  } else if (parseResult.processed > 0) {
    console.info('[ingestion] parse stage:', parseResult.processed, 'items');
  }
}

main().catch((err) => {
  const message = err?.message ?? String(err);
  console.error('[ingestion] fatal:', message);
  printMigrationReminderIfNeeded(message);
  process.exit(1);
});
