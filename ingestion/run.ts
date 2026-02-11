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

// Side-effect: register allwalessport, sixnations, sixnations_www so getSource(...) works
import './sources/allwalessport';
import './sources/sixnations';
import './sources/sixnations-www';

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
    const startTime = Date.now();
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
    let persistResult: {
      competitionsProcessed: number;
      totalFixtures: number;
      totalResults: number;
      totalStandings: number;
      totalTeamsCreated: number;
      failures: string[];
    } = {
      competitionsProcessed: 0,
      totalFixtures: 0,
      totalResults: 0,
      totalStandings: 0,
      totalTeamsCreated: 0,
      failures: [],
    };
    if (!dryRun) {
      const { runPersistAllWalesSport } = await import('./sources/allwalessport/persist');
      const pr = await runPersistAllWalesSport({ supabase: supabaseAdmin });
      persistResult = pr;
      if (pr.error) {
        console.warn('[ingestion] AllWalesSport persist error:', pr.error);
      }
      if (pr.competitionsProcessed > 0) {
        console.info('[ingestion] AllWalesSport persist:', {
          competitions: pr.competitionsProcessed,
          fixtures: pr.totalFixtures,
          results: pr.totalResults,
          standings: pr.totalStandings,
          teamsCreated: pr.totalTeamsCreated,
        });
      }
      if (pr.failures.length > 0) {
        console.warn('[ingestion] AllWalesSport persist failures:', pr.failures.length, pr.failures.slice(0, 5));
      }
    } else {
      console.info('[ingestion] dry run: skipping persist stage.');
    }
    const durationMs = Date.now() - startTime;
    const summary = {
      competitionsDiscovered: result.metrics?.competitionsDiscovered ?? 0,
      competitionsScraped: result.metrics?.competitionsScraped ?? 0,
      competitionsPersisted: persistResult.competitionsProcessed,
      fixturesParsed: result.metrics?.fixturesParsed ?? 0,
      resultsParsed: result.metrics?.resultsParsed ?? 0,
      standingsParsed: result.metrics?.standingsParsed ?? 0,
      fixturesWritten: persistResult.totalFixtures,
      resultsWritten: persistResult.totalResults,
      standingsWritten: persistResult.totalStandings,
      teamsCreated: persistResult.totalTeamsCreated,
      errorsCount: (result.metrics?.errorsCount ?? 0) + persistResult.failures.length,
      durationMs,
    };
    console.info('[ingestion] AllWalesSport summary', JSON.stringify(summary));
    return;
  }

  if (source === 'sixnations') {
    const dryRun = process.env.INGEST_DRY_RUN === '1';
    const descriptor = getSource('sixnations');
    if (!descriptor) {
      console.error('[ingestion] source sixnations not registered');
      process.exit(1);
    }
    const result = await descriptor.run({ noCache, dryRun });
    if (result.error) {
      console.error('[ingestion] sixnations failed:', result.error);
      process.exit(1);
    }
    console.info('[ingestion] Six Nations summary', result.metrics ?? {});
    return;
  }

  if (source === 'sixnations_www') {
    const dryRun = process.env.INGEST_DRY_RUN === '1';
    const descriptor = getSource('sixnations_www');
    if (!descriptor) {
      console.error('[ingestion] source sixnations_www not registered');
      process.exit(1);
    }
    const result = await descriptor.run({ noCache, dryRun });
    if (result.error) {
      console.error('[ingestion] sixnations_www failed:', result.error);
      process.exit(1);
    }
    console.info('[ingestion] Six Nations (www) summary', result.metrics ?? {});
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
  const apiClient = discoveryClient;

  const runMyWruStages = (config.roots && config.roots.length > 0) || config.useActiveCompetitions;
  if (runMyWruStages) {
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

  if (runMyWruStages) {
    const { runMyWruSync } = await import('./sources/mywru/sync');
    const syncResult = await runMyWruSync({
      config,
      httpClient: apiClient,
      supabase: supabaseAdmin,
    });
    if (syncResult.error) {
      console.warn('[ingestion] MyWRU sync failed:', syncResult.error);
    } else {
      console.info('[ingestion] MyWRU sync:', {
        groups: syncResult.groups,
        fixturesFetched: syncResult.fixturesFetched,
        resultsFetched: syncResult.resultsFetched,
        standingsFetched: syncResult.standingsFetched,
        ingestItems: syncResult.ingestItems,
      });
    }
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

  if (runMyWruStages) {
    const { runPersistMyWru } = await import('./sources/mywru/persist');
    const persistResult = await runPersistMyWru({ supabase: supabaseAdmin });
    if (persistResult.error) {
      console.warn('[ingestion] MyWRU persist error:', persistResult.error);
    } else if (persistResult.groupsProcessed > 0) {
      console.info('[ingestion] MyWRU persist:', {
        groups: persistResult.groupsProcessed,
        fixtures: persistResult.fixturesWritten,
        results: persistResult.resultsWritten,
        standings: persistResult.standingsWritten,
        teamsCreated: persistResult.teamsCreated,
      });
    }
    if (persistResult.failures.length > 0) {
      console.warn(
        '[ingestion] MyWRU persist failures:',
        persistResult.failures.length,
        persistResult.failures.slice(0, 5)
      );
    }
  }
}

main().catch((err) => {
  const message = err?.message ?? String(err);
  console.error('[ingestion] fatal:', message);
  printMigrationReminderIfNeeded(message);
  process.exit(1);
});
