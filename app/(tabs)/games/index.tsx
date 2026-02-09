import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FavouriteButton } from '../../../components/FavouriteButton';
import { useFixturesList } from '../../../features/games/useFixturesList';
import { useFavourites } from '../../../features/favourites/useFavourites';
import { teamLabel } from '../../../lib/teamLabel';
import { theme } from '../../../lib/theme';
import type { FixtureListItem } from '../../../types/games';

const toDateKey = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};
const formatKickoff = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

function statusLabel(status: FixtureListItem['status']): string {
  switch (status) {
    case 'scheduled': return 'Scheduled';
    case 'live': return 'Live';
    case 'full_time': return 'Full time';
    case 'postponed': return 'Postponed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}

function FixtureRow({ item, onPress }: { item: FixtureListItem; onPress: () => void }) {
  const showScore = item.status === 'live' || item.status === 'full_time';
  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onPress} style={styles.rowTouchable} activeOpacity={0.7}>
        <View style={styles.rowInner}>
          <View style={styles.rowContent}>
            <Text style={styles.dateText}>{toDateKey(item.scheduled_at)} · {formatKickoff(item.scheduled_at)}</Text>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {String(teamLabel(item.home_team_name))} v {String(teamLabel(item.away_team_name))}
            </Text>
            {item.venue_name ? <Text style={styles.caption}>{item.venue_name}</Text> : null}
          </View>
          <View style={styles.scoreBlock}>
            <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
            {showScore && item.score_home != null && item.score_away != null && (
              <Text style={styles.score}>{item.score_home} – {item.score_away}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <FavouriteButton entityType="fixture" entityId={item.id} size={22} />
    </View>
  );
}

type LeagueGroup = { leagueName: string; competitionId: string; dateGroups: { dateLabel: string; items: FixtureListItem[] }[] };

function filterAndGroup(
  fixtures: FixtureListItem[],
  viewMode: 'upcoming' | 'results',
  leagueFilter: 'my_leagues' | 'all' | string,
  favouriteTeamIds: string[],
  favouriteCompetitionIds: string[],
  nowDate: Date
): LeagueGroup[] {
  const nowIso = nowDate.toISOString();
  let list = viewMode === 'upcoming'
    ? fixtures.filter((f) => f.status === 'live' || f.scheduled_at >= nowIso)
    : fixtures.filter((f) => f.status === 'full_time' || (f.scheduled_at < nowIso && f.score_home != null && f.score_away != null));

  if (leagueFilter === 'my_leagues' && (favouriteTeamIds.length > 0 || favouriteCompetitionIds.length > 0)) {
    const teamSet = new Set(favouriteTeamIds);
    const compSet = new Set(favouriteCompetitionIds);
    list = list.filter(
      (f) =>
        (f.competition_id && compSet.has(f.competition_id)) ||
        (f.home_team_id && teamSet.has(f.home_team_id)) ||
        (f.away_team_id && teamSet.has(f.away_team_id))
    );
  } else if (leagueFilter !== 'all' && leagueFilter !== 'my_leagues') {
    list = list.filter((f) => f.competition_id === leagueFilter);
  }

  const byLeague = new Map<string, FixtureListItem[]>();
  for (const f of list) {
    const key = f.competition_id ?? 'other';
    const name = f.competition_name?.trim() || 'Other';
    if (!byLeague.has(key)) byLeague.set(key, []);
    byLeague.get(key)!.push(f);
  }
  const groups: LeagueGroup[] = [];
  for (const [compId, items] of byLeague) {
    items.sort((a, b) => {
      if (viewMode === 'upcoming') {
        const aLive = a.status === 'live';
        const bLive = b.status === 'live';
        if (aLive !== bLive) return aLive ? -1 : 1;
        return a.scheduled_at.localeCompare(b.scheduled_at);
      }
      return b.scheduled_at.localeCompare(a.scheduled_at);
    });
    const byDate = new Map<number, { dateLabel: string; items: FixtureListItem[] }>();
    for (const f of items) {
      const date = new Date(f.scheduled_at);
      const dateKey = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      if (!byDate.has(dateKey)) byDate.set(dateKey, { dateLabel: toDateKey(f.scheduled_at), items: [] });
      byDate.get(dateKey)!.items.push(f);
    }
    const dateGroups = Array.from(byDate.entries())
      .map(([dateKey, group]) => ({ dateKey, ...group }))
      .sort((a, b) => viewMode === 'upcoming' ? a.dateKey - b.dateKey : b.dateKey - a.dateKey)
      .map(({ dateKey, ...rest }) => rest);
    groups.push({
      leagueName: items[0]?.competition_name?.trim() || 'Other',
      competitionId: compId,
      dateGroups,
    });
  }
  groups.sort((a, b) => a.leagueName.localeCompare(b.leagueName));
  return groups;
}

/**
 * Games tab. Default: Upcoming only, grouped by league then date. Toggle Results. League filter: My Leagues | All | single.
 */
export default function FixturesListScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'upcoming' | 'results'>('upcoming');
  const [leagueFilter, setLeagueFilter] = useState<'my_leagues' | 'all' | string>('my_leagues');
  const nowDate = useMemo(() => new Date(), [viewMode]);
  const competitionFilter = useMemo(() => (
    leagueFilter !== 'all' && leagueFilter !== 'my_leagues' ? [leagueFilter] : undefined
  ), [leagueFilter]);
  const { fixtures, loading, error, refetch } = useFixturesList({
    mode: viewMode,
    competitionIds: competitionFilter,
    now: nowDate,
  });
  const { teamIds: favouriteTeamIds, competitionIds: favouriteCompetitionIds } = useFavourites();
  const [refreshing, setRefreshing] = useState(false);
  const noFavourites = favouriteTeamIds.length === 0 && favouriteCompetitionIds.length === 0;

  const competitionsFromFixtures = useMemo(() => {
    const seen = new Map<string, string>();
    for (const f of fixtures) {
      if (f.competition_id && f.competition_name) seen.set(f.competition_id, f.competition_name);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [fixtures]);

  const grouped = useMemo(
    () => filterAndGroup(fixtures, viewMode, leagueFilter, favouriteTeamIds, favouriteCompetitionIds, nowDate),
    [fixtures, viewMode, leagueFilter, favouriteTeamIds, favouriteCompetitionIds, nowDate]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading fixtures…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={refetch} style={styles.retryButton} activeOpacity={0.8}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
    >
      <View style={styles.toolbar}>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'upcoming' && styles.toggleBtnActive]}
            onPress={() => setViewMode('upcoming')}
          >
            <Text style={[styles.toggleText, viewMode === 'upcoming' && styles.toggleTextActive]}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'results' && styles.toggleBtnActive]}
            onPress={() => setViewMode('results')}
          >
            <Text style={[styles.toggleText, viewMode === 'results' && styles.toggleTextActive]}>Results</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterChips}>
              <TouchableOpacity
                style={[styles.chip, leagueFilter === 'my_leagues' && styles.chipActive]}
                onPress={() => setLeagueFilter('my_leagues')}
              >
                <Text style={[styles.chipText, leagueFilter === 'my_leagues' && styles.chipTextActive]}>My Leagues</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, leagueFilter === 'all' && styles.chipActive]}
                onPress={() => setLeagueFilter('all')}
              >
                <Text style={[styles.chipText, leagueFilter === 'all' && styles.chipTextActive]}>All Leagues</Text>
              </TouchableOpacity>
              {competitionsFromFixtures.map(([id, name]) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.chip, leagueFilter === id && styles.chipActive]}
                  onPress={() => setLeagueFilter(id)}
                >
                  <Text style={[styles.chipText, styles.chipTextEllipsis, leagueFilter === id && styles.chipTextActive]} numberOfLines={1}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>

      {grouped.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {leagueFilter === 'my_leagues' && noFavourites
              ? 'No fixtures yet. Favourite teams or competitions to see your leagues here.'
              : viewMode === 'upcoming'
                ? 'No upcoming fixtures'
                : 'No results'}
          </Text>
        </View>
      ) : (
        <View style={styles.listCard}>
          {grouped.map((g) => (
            <View key={g.competitionId} style={styles.leagueSection}>
              <Text style={styles.leagueHeader}>{String(g.leagueName)}</Text>
              {g.dateGroups.map((dg) => (
                <View key={dg.dateLabel}>
                  <Text style={styles.dateHeader}>{dg.dateLabel}</Text>
                  {dg.items.map((item) => (
                    <FixtureRow
                      key={item.id}
                      item={item}
                      onPress={() => router.push(`/(tabs)/games/${item.id}`)}
                    />
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  scrollContent: { paddingBottom: theme.spacing.xxl },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xxl,
  },
  loadingText: { marginTop: theme.spacing.md, ...theme.typography.body },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.error,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
  },
  retryText: { color: theme.colors.primaryContrast, fontWeight: '600', fontSize: 15 },
  toolbar: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.md },
  toggleRow: { flexDirection: 'row', marginBottom: theme.spacing.sm },
  toggleBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: theme.radius.md, marginRight: 8 },
  toggleBtnActive: { backgroundColor: theme.colors.primary },
  toggleText: { fontSize: 14, color: theme.colors.textSecondary },
  toggleTextActive: { color: theme.colors.primaryContrast, fontWeight: '600' },
  filterRow: { marginBottom: theme.spacing.xs },
  filterChips: { flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: theme.radius.full, backgroundColor: theme.colors.surfaceMuted },
  chipActive: { backgroundColor: theme.colors.primary },
  chipText: { fontSize: 13, color: theme.colors.textSecondary },
  chipTextActive: { color: theme.colors.primaryContrast },
  chipTextEllipsis: { maxWidth: 140 },
  emptyCard: { padding: theme.spacing.xxl, alignItems: 'center' },
  emptyText: { ...theme.typography.body, color: theme.colors.textSecondary, textAlign: 'center' },
  listCard: { ...theme.card, ...theme.cardShadow, marginHorizontal: theme.spacing.lg, padding: 0, overflow: 'hidden' },
  leagueSection: { marginBottom: theme.spacing.lg },
  leagueHeader: { ...theme.typography.title, fontSize: 15, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xs },
  dateHeader: { ...theme.typography.caption, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  rowTouchable: { flex: 1 },
  rowInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  rowContent: { flex: 1, minWidth: 0 },
  dateText: { ...theme.typography.caption, marginBottom: theme.spacing.xs },
  caption: { ...theme.typography.caption, marginTop: theme.spacing.xs },
  rowTitle: { ...theme.typography.bodyStrong },
  scoreBlock: { alignItems: 'flex-end', marginLeft: theme.spacing.sm },
  statusText: { ...theme.typography.caption },
  score: { ...theme.typography.score, fontSize: 18, marginTop: theme.spacing.xs },
});
