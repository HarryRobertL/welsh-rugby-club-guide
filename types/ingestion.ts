/**
 * Ingestion pipeline types. Structure only; no external source yet.
 * File: types/ingestion.ts
 */

export type IngestEntityType =
  | 'team'
  | 'fixture'
  | 'competition'
  | 'venue'
  | 'season'
  | 'standing'
  | 'result'
  | 'form_table';

/** Config for AllWalesSport ingestion source. */
export type AllWalesSportConfig = {
  baseUrl: string;
  sportPath: string;
  startCompetitionCid?: number;
  competitionCidAllowlist?: number[];
  requestTimeoutMs: number;
  userAgent: string;
  rateLimitPerSecond: number;
  maxCompetitions: number;
  maxPagesPerCompetition: number;
};

export type IngestJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type IngestSource = {
  id: string;
  name: string;
  slug: string;
  config: Record<string, unknown>;
  created_at: string;
};

export type RawIngestRow = {
  id: string;
  source_id: string;
  entity_type: IngestEntityType;
  external_id: string;
  payload: Record<string, unknown>;
  ingested_at: string;
  processed_at: string | null;
};

export type TeamMappingRow = {
  id: string;
  source_id: string;
  external_team_id: string;
  team_id: string;
  created_at: string;
};

export type IngestJobRow = {
  id: string;
  job_type: string;
  status: IngestJobStatus;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
};
