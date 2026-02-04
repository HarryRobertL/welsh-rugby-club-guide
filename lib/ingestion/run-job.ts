/**
 * Background ingestion job runner.
 * Polls ingest_jobs for status=pending, runs job_type handler. When httpClient and config
 * are provided (e.g. from ingestion/run.ts), uses the production HTTP client for sync.
 * Ingestion must pass supabaseAdmin; app callers use default anon client.
 * File: lib/ingestion/run-job.ts
 */
import type { IngestHttpClient } from '../../ingestion/lib/http';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export type IngestJobType = 'sync_teams' | 'sync_fixtures' | 'full_sync';

export type RunNextIngestJobOptions = {
  httpClient?: IngestHttpClient;
  supabase?: SupabaseClient;
  config?: { knownCompetitionOverviewUrls: string[] };
};

/**
 * Fetch next pending job and run it. When httpClient and config are provided,
 * uses the client to fetch known competition overview URLs (rate-limited, cached, retried).
 */
export async function runNextIngestJob(
  options?: RunNextIngestJobOptions
): Promise<{ jobId: string | null; error: string | null }> {
  const { httpClient, supabase: sb = supabase, config } = options ?? {};
  const { data: jobs, error: fetchErr } = await (sb
    .from('ingest_jobs') as any)
    .select('id, job_type')
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(1);
  if (fetchErr) return { jobId: null, error: (fetchErr as Error).message };
  const job = jobs?.[0] as { id: string; job_type: string } | undefined;
  if (!job) return { jobId: null, error: null };

  await (sb.from('ingest_jobs') as any)
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id);

  let result: Record<string, unknown> = { placeholder: true };
  const urls = config?.knownCompetitionOverviewUrls ?? [];

  if (httpClient && urls.length > 0) {
    const fetched: { path: string; status: number; fromCache: boolean }[] = [];
    for (const url of urls) {
      if (httpClient.hasReachedRequestLimit()) break;
      try {
        const res = await httpClient.get(url);
        let pathForResult: string;
        try {
          pathForResult = new URL(url).pathname;
        } catch {
          pathForResult = url.replace(/^https?:\/\/[^/]+/, '');
        }
        fetched.push({
          path: pathForResult,
          status: res.status,
          fromCache: res.fromCache,
        });
      } catch (e) {
        result = { error: (e as Error).message, fetched };
        await (sb.from('ingest_jobs') as any)
          .update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            result,
            error: (e as Error).message,
          })
          .eq('id', job.id);
        return { jobId: job.id, error: (e as Error).message };
      }
    }
    result = { fetched, count: fetched.length };
  }

  await (sb.from('ingest_jobs') as any)
    .update({
      status: 'completed',
      finished_at: new Date().toISOString(),
      result,
    })
    .eq('id', job.id);

  return { jobId: job.id, error: null };
}

/**
 * Placeholder: enqueue a job (e.g. for cron or manual trigger). No external source yet.
 */
export async function enqueueIngestJob(
  jobType: IngestJobType,
  options?: { scheduled_at?: string }
): Promise<{ jobId: string | null; error: string | null }> {
  const { data, error } = await (supabase.from('ingest_jobs') as any).insert({
    job_type: jobType,
    status: 'pending',
    scheduled_at: options?.scheduled_at ?? new Date().toISOString(),
  })
    .select('id')
    .single();
  if (error) return { jobId: null, error: (error as Error).message };
  return { jobId: (data as { id: string }).id, error: null };
}
