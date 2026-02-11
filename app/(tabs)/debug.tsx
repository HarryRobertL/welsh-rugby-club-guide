/**
 * Debug / observability: competitions by source, seasons by competition, fixtures by season, standings by season.
 * Never shows "Competition <id>" or "Default" in canonical names.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { getCategoryForCompetition } from '../../lib/competitionCategories';
import { getCompetitionDisplayName } from '../../lib/competitionOverrides';

type CompetitionRow = {
  id: string;
  name: string;
  slug: string;
  source: string | null;
  source_ref: string | null;
};

type PerSourceCounts = {
  source: string;
  competitionsCount: number;
  seasonsCount: number;
  standingsCount: number;
  fixturesCount: number;
  seasonsByCompetition: { competition_id: string; count: number }[];
  standingsBySeason: { season_id: string; count: number }[];
  fixturesBySeason: { season_id: string; count: number }[];
};

type DebugStats = {
  bySource: { source: string; count: number }[];
  perSource: PerSourceCounts[];
  defaultNameCount: number;
  unmapped: CompetitionRow[];
  sample: { source: string; source_ref: string; rawName: string; canonicalName: string; category: string }[];
  seasonsByCompetition: { competition_id: string; count: number }[];
  fixturesBySeason: { season_id: string; count: number }[];
  standingsBySeason: { season_id: string; count: number }[];
};

export default function DebugScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DebugStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: rows, error: err } = await supabase
        .from('competitions')
        .select('id, name, slug, source, source_ref')
        .not('source', 'is', null);
      if (err) throw err;
      const list = (rows ?? []) as CompetitionRow[];
      const bySource = new Map<string, number>();
      let defaultNameCount = 0;
      const unmapped: CompetitionRow[] = [];
      const sample: DebugStats['sample'] = [];
      for (const c of list) {
        const src = c.source ?? 'null';
        bySource.set(src, (bySource.get(src) ?? 0) + 1);
        const raw = (c.name ?? '').trim().toLowerCase();
        if (raw === 'default') defaultNameCount += 1;
        const canonicalName = getCompetitionDisplayName(c.source ?? null, c.source_ref ?? null, c.name ?? '', c.slug);
        const category = getCategoryForCompetition(c.name ?? '', c.slug);
        if (raw === 'default') unmapped.push(c);
        if (sample.length < 15) {
          sample.push({
            source: src,
            source_ref: c.source_ref ?? '—',
            rawName: c.name ?? '—',
            canonicalName,
            category,
          });
        }
      }

      const { data: seasonCounts } = await supabase.from('seasons').select('competition_id');
      const seasonsByCompetition = (seasonCounts ?? []).reduce<{ competition_id: string; count: number }[]>((acc, row: { competition_id: string }) => {
        const existing = acc.find((x) => x.competition_id === row.competition_id);
        if (existing) existing.count += 1;
        else acc.push({ competition_id: row.competition_id, count: 1 });
        return acc;
      }, []);

      const { data: fixtureRows } = await supabase.from('fixtures').select('season_id');
      const fixturesBySeason = (fixtureRows ?? []).reduce<{ season_id: string; count: number }[]>((acc, row: { season_id: string }) => {
        const existing = acc.find((x) => x.season_id === row.season_id);
        if (existing) existing.count += 1;
        else acc.push({ season_id: row.season_id, count: 1 });
        return acc;
      }, []);

      const { data: standingRows } = await supabase.from('standings').select('season_id');
      const standingsBySeason = (standingRows ?? []).reduce<{ season_id: string; count: number }[]>((acc, row: { season_id: string }) => {
        const existing = acc.find((x) => x.season_id === row.season_id);
        if (existing) existing.count += 1;
        else acc.push({ season_id: row.season_id, count: 1 });
        return acc;
      }, []);

      const compIdsBySource = new Map<string, string[]>();
      for (const c of list) {
        const src = c.source ?? 'null';
        if (!compIdsBySource.has(src)) compIdsBySource.set(src, []);
        compIdsBySource.get(src)!.push(c.id);
      }
      const rawFixtureRows = (fixtureRows ?? []) as { season_id: string }[];
      const rawStandingRows = (standingRows ?? []) as { season_id: string }[];
      const { data: seasonsWithComp } = await supabase.from('seasons').select('id, competition_id');
      const seasonsList = (seasonsWithComp ?? []) as { id: string; competition_id: string }[];
      const compIdToSeasonIds = new Map<string, string[]>();
      for (const s of seasonsList) {
        if (!compIdToSeasonIds.has(s.competition_id)) compIdToSeasonIds.set(s.competition_id, []);
        compIdToSeasonIds.get(s.competition_id)!.push(s.id);
      }
      const perSource: PerSourceCounts[] = [];
      for (const [src, compIds] of compIdsBySource) {
        let seasonsCount = 0;
        const seasonsByCompetition: { competition_id: string; count: number }[] = [];
        for (const cid of compIds) {
          const sids = compIdToSeasonIds.get(cid) ?? [];
          seasonsCount += sids.length;
          if (sids.length > 0) seasonsByCompetition.push({ competition_id: cid, count: sids.length });
        }
        const seasonIdSet = new Set(compIds.flatMap((cid) => compIdToSeasonIds.get(cid) ?? []));
        let standingsCount = 0;
        let fixturesCount = 0;
        const standingsBySeason: { season_id: string; count: number }[] = [];
        const fixturesBySeason: { season_id: string; count: number }[] = [];
        for (const row of rawStandingRows) {
          if (seasonIdSet.has(row.season_id)) {
            standingsCount += 1;
            const ex = standingsBySeason.find((x) => x.season_id === row.season_id);
            if (ex) ex.count += 1;
            else standingsBySeason.push({ season_id: row.season_id, count: 1 });
          }
        }
        for (const row of rawFixtureRows) {
          if (seasonIdSet.has(row.season_id)) {
            fixturesCount += 1;
            const ex = fixturesBySeason.find((x) => x.season_id === row.season_id);
            if (ex) ex.count += 1;
            else fixturesBySeason.push({ season_id: row.season_id, count: 1 });
          }
        }
        perSource.push({
          source: src,
          competitionsCount: compIds.length,
          seasonsCount,
          standingsCount,
          fixturesCount,
          seasonsByCompetition: seasonsByCompetition.slice(0, 15),
          standingsBySeason: standingsBySeason.slice(0, 10),
          fixturesBySeason: fixturesBySeason.slice(0, 10),
        });
      }

      setStats({
        bySource: Array.from(bySource.entries()).map(([source, count]) => ({ source, count })),
        perSource,
        defaultNameCount,
        unmapped,
        sample,
        seasonsByCompetition: seasonsByCompetition.slice(0, 20),
        fixturesBySeason: fixturesBySeason.slice(0, 20),
        standingsBySeason: standingsBySeason.slice(0, 20),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!stats) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Debug – Data observability</Text>
      <TouchableOpacity onPress={load} style={styles.refresh}>
        <Text style={styles.refreshText}>Refresh</Text>
      </TouchableOpacity>

      <Text style={styles.section}>Competitions by source</Text>
      {stats.bySource.map(({ source, count }) => (
        <Text key={source} style={styles.row}>{source}: {count}</Text>
      ))}
      <Text style={styles.section}>Per source: competitions, seasons, standings, fixtures</Text>
      {stats.perSource.map((p) => (
        <View key={p.source} style={{ marginBottom: 8 }}>
          <Text style={styles.row}>{p.source}: {p.competitionsCount} comps, {p.seasonsCount} seasons, {p.standingsCount} standings, {p.fixturesCount} fixtures</Text>
          {p.seasonsByCompetition.length > 0 && (
            <Text style={styles.small}>  Seasons per comp: {p.seasonsByCompetition.slice(0, 5).map((s) => s.count).join(', ')}{p.seasonsByCompetition.length > 5 ? '…' : ''}</Text>
          )}
        </View>
      ))}
      <Text style={styles.section}>Competitions with Default name (raw)</Text>
      <Text style={styles.row}>{stats.defaultNameCount}</Text>

      <Text style={styles.section}>Seasons per competition (sample)</Text>
      <Text style={styles.small}>Total competitions with seasons: {stats.seasonsByCompetition.length}</Text>
      {stats.seasonsByCompetition.slice(0, 10).map((s) => (
        <Text key={s.competition_id} style={styles.small}>comp {s.competition_id.slice(0, 8)}…: {s.count} seasons</Text>
      ))}

      <Text style={styles.section}>Fixtures per season (sample)</Text>
      <Text style={styles.small}>Seasons with fixtures: {stats.fixturesBySeason.length}</Text>
      {stats.fixturesBySeason.slice(0, 5).map((f) => (
        <Text key={f.season_id} style={styles.small}>season {f.season_id.slice(0, 8)}…: {f.count} fixtures</Text>
      ))}

      <Text style={styles.section}>Standings per season (sample)</Text>
      <Text style={styles.small}>Seasons with standings: {stats.standingsBySeason.length}</Text>
      {stats.standingsBySeason.slice(0, 5).map((s) => (
        <Text key={s.season_id} style={styles.small}>season {s.season_id.slice(0, 8)}…: {s.count} rows</Text>
      ))}

      <Text style={styles.section}>Unmapped (Default name) – {stats.unmapped.length}</Text>
      {stats.unmapped.slice(0, 10).map((c) => (
        <Text key={c.id} style={styles.small}>{c.source} | {c.source_ref} | {c.name}</Text>
      ))}
      <Text style={styles.section}>Sample mapping (raw → canonical, category)</Text>
      {stats.sample.map((s, i) => (
        <Text key={i} style={styles.small}>
          {s.rawName} → {s.canonicalName} | {s.category}
        </Text>
      ))}
      <Text style={styles.muted} onPress={() => router.back()}>← Back</Text>
      <TouchableOpacity style={styles.refresh} onPress={() => router.push('/(tabs)/design-system')}>
        <Text style={styles.refreshText}>Design system playground</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#111' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#fff' },
  section: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 4, color: '#ccc' },
  row: { fontSize: 13, color: '#ddd', marginBottom: 2 },
  small: { fontSize: 11, color: '#999', marginBottom: 2 },
  muted: { fontSize: 12, color: '#666', marginTop: 16 },
  error: { color: '#f44' },
  refresh: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#333', borderRadius: 8, marginBottom: 12 },
  refreshText: { color: '#fff', fontSize: 13 },
});
