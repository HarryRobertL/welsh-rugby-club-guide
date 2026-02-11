/**
 * Ingestion source registry: discovery and entity types per source.
 * Used by run.ts to select and invoke a source when INGEST_SOURCE is set.
 * File: ingestion/sources/registry.ts
 */

import type { IngestEntityType } from '../../types/ingestion';

export type SourceDescriptor = {
  slug: string;
  name: string;
  /** Entity types this source can produce in ingest_items. */
  entityTypes: IngestEntityType[];
  /** Run discovery/ingest for this source. Returns error message or null. Optional metrics for summary logging. */
  run: (options: { noCache: boolean; dryRun?: boolean }) => Promise<{
    error: string | null;
    metrics?: Record<string, number>;
  }>;
};

const registry: Map<string, SourceDescriptor> = new Map();

export function registerSource(descriptor: SourceDescriptor): void {
  if (registry.has(descriptor.slug)) {
    throw new Error(`Ingestion source already registered: ${descriptor.slug}`);
  }
  registry.set(descriptor.slug, descriptor);
}

export function getSource(slug: string): SourceDescriptor | undefined {
  return registry.get(slug);
}

export function getRegisteredSlugs(): string[] {
  return Array.from(registry.keys());
}

export function hasSource(slug: string): boolean {
  return registry.has(slug);
}
