/**
 * Games tab. Premium glass UI. Uses useFixturesList and useFavourites only.
 * Segments: Live, Today, Upcoming, Results. Optional 30s poll on Live when focused.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { FavouriteButton } from '../../../components/FavouriteButton';
import { useFixturesList } from '../../../features/games/useFixturesList';
import { useFavourites } from '../../../features/favourites/useFavourites';
import { teamLabel } from '../../../lib/teamLabel';
import { tokens } from '../../../lib/theme';
import {
  Badge,
  EmptyState,
  GlassCard,
  GlassHeader,
  GlassHeaderButton,
  Icon,
  Skeleton,
  Text,
  useResolvedColors,
} from '../../../lib/ui';
import type { FixtureListItem } from '../../../types/games';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const MIN_TOUCH = 44;
const LIVE_POLL_MS = 30000;
const HEADER_OFFSET = tokens.spacing.xxl + tokens.spacing.lg; // space for absolute GlassHeader

function toDateKey(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

type SegmentId = 'live' | 'today' | 'upcoming' | 'results';

function statusVariant(status: FixtureListItem['status']): 'live' | 'ft' | 'scheduled' | 'neutral' {
  if (status === 'live') return 'live';
  if (status === 'full_time') return 'ft';
  if (status === 'scheduled') return 'scheduled';
  return 'neutral';
}

const FixtureRow = React.memo(function FixtureRow({
  item,
  onPress,
}: {
  item: FixtureListItem;
  onPress: () => void;
}) {
  const showScore = item.status === 'live' || item.status === 'full_time';
  const label = `${teamLabel(item.home_team_name)} v ${teamLabel(item.away_team_name)}, ${item.status}. Open match.`;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.rowTouchable, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={HIT_SLOP}
      >
        <View style={styles.rowInner}>
          <View style={styles.rowContent}>
            <Text variant="caption" color="textSecondary">{toDateKey(item.scheduled_at)} · {formatKickoff(item.scheduled_at)}</Text>
            <Text variant="bodyBold" color="text" numberOfLines={1}>
              {String(teamLabel(item.home_team_name))} v {String(teamLabel(item.away_team_name))}
            </Text>
            {item.venue_name ? <Text variant="caption" color="textMuted" numberOfLines={1}>{item.venue_name}</Text> : null}
          </View>
          <View style={styles.scoreBlock}>
            <Badge
              label={item.status === 'live' ? 'LIVE' : item.status === 'full_time' ? 'FT' : 'KO'}
              variant={statusVariant(item.status)}
            />
            {showScore && item.score_home != null && item.score_away != null && (
              <Text variant="bodyBold" color="text">{item.score_home} – {item.score_away}</Text>
            )}
          </View>
        </View>
      </Pressable>
      <FavouriteButton entityType="fixture" entityId={item.id} size={22} />
    </View>
  );
});

type LeagueGroup = { leagueName: string; competitionId: string; dateGroups: { dateLabel: string; items: FixtureListItem[] }[] };

function filterAndGroup(
  fixtures: FixtureListItem[],
  segment: SegmentId,
  leagueFilter: 'my_leagues' | 'all' | string,
  favouriteTeamIds: string[],
  favouriteCompetitionIds: string[],
  nowDate: Date
): LeagueGroup[] {
  const nowIso = nowDate.toISOString();
  let list: FixtureListItem[] = [];
  if (segment === 'live') {
    list = fixtures.filter((f) => f.status === 'live');
  } else if (segment === 'today') {
    list = fixtures.filter((f) => (f.status === 'live' || f.scheduled_at >= nowIso) && isToday(f.scheduled_at));
  } else if (segment === 'upcoming') {
    list = fixtures.filter((f) => (f.status === 'live' || f.scheduled_at >= nowIso) && !isToday(f.scheduled_at));
  } else {
    list = fixtures.filter(
      (f) => f.status === 'full_time' || (f.scheduled_at < nowIso && f.score_home != null && f.score_away != null)
    );
  }

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
    if (!byLeague.has(key)) byLeague.set(key, []);
    byLeague.get(key)!.push(f);
  }
  const groups: LeagueGroup[] = [];
  const ascending = segment !== 'results';
  for (const [compId, items] of byLeague) {
    items.sort((a, b) => {
      if (segment === 'live') return a.scheduled_at.localeCompare(b.scheduled_at);
      return ascending ? a.scheduled_at.localeCompare(b.scheduled_at) : b.scheduled_at.localeCompare(a.scheduled_at);
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
      .sort((a, b) => (ascending ? a.dateKey - b.dateKey : b.dateKey - a.dateKey))
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

const SEGMENTS: { id: SegmentId; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'results', label: 'Results' },
];

export default function FixturesListScreen() {
  const router = useRouter();
  const colors = useResolvedColors();
  const [segment, setSegment] = useState<SegmentId>('upcoming');
  const { teamIds: favouriteTeamIds, competitionIds: favouriteCompetitionIds } = useFavourites();
  const noFavourites = favouriteTeamIds.length === 0 && favouriteCompetitionIds.length === 0;
  const [leagueFilterState, setLeagueFilterState] = useState<'my_leagues' | 'all' | string>('my_leagues');
  const leagueFilter = noFavourites ? 'all' : leagueFilterState;
  const setLeagueFilter = useCallback(
    (next: 'my_leagues' | 'all' | string) => {
      if (noFavourites && next === 'my_leagues') return;
      setLeagueFilterState(next);
    },
    [noFavourites]
  );
  const [nowDate, setNowDate] = useState(() => new Date());
  const competitionFilter = useMemo(
    () => (leagueFilter !== 'all' && leagueFilter !== 'my_leagues' ? [leagueFilter] : undefined),
    [leagueFilter]
  );
  const hookMode = segment === 'results' ? 'results' : 'upcoming';
  const { fixtures, loading, error, refetch } = useFixturesList({
    mode: hookMode,
    competitionIds: competitionFilter,
    now: nowDate,
  });
  const [refreshing, setRefreshing] = useState(false);
  const livePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setNowDate(new Date());
  }, [segment, refreshing]);

  useEffect(() => {
    if (segment !== 'live') return;
    livePollRef.current = setInterval(() => refetch(), LIVE_POLL_MS);
    return () => {
      if (livePollRef.current) clearInterval(livePollRef.current);
      livePollRef.current = null;
    };
  }, [segment, refetch]);

  const competitionsFromFixtures = useMemo(() => {
    const seen = new Map<string, string>();
    for (const f of fixtures) {
      if (f.competition_id && f.competition_name) seen.set(f.competition_id, f.competition_name);
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [fixtures]);

  const grouped = useMemo(
    () => filterAndGroup(fixtures, segment, leagueFilter, favouriteTeamIds, favouriteCompetitionIds, nowDate),
    [fixtures, segment, leagueFilter, favouriteTeamIds, favouriteCompetitionIds, nowDate]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const showLoading = loading && !refreshing;
  const hasCachedData = fixtures.length > 0;
  const showErrorBanner = !!error && hasCachedData;

  if (showLoading && !hasCachedData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader titleSlot={<Text variant="bodyBold" color="text">Games</Text>} />
        <View style={styles.loadingContent}>
          <Skeleton variant="block" width={320} height={48} style={styles.segmentSkeleton} />
          <Skeleton variant="line" style={styles.lineSkeleton} />
          <Skeleton variant="line" style={styles.lineSkeleton} />
          <Skeleton variant="line" style={styles.lineSkeleton} />
        </View>
      </View>
    );
  }

  if (error && !hasCachedData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader titleSlot={<Text variant="bodyBold" color="text">Games</Text>} />
        <View style={styles.errorContent}>
          <EmptyState
            title="Something went wrong"
            description={error}
            primaryAction={{ label: 'Retry', onPress: refetch }}
            mode="error"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader
        leftSlot={<Text variant="bodyBold" color="text" style={styles.headerTitle}>Games</Text>}
        titleSlot={null}
        rightSlot={
          <View style={styles.headerRight}>
            <GlassHeaderButton accessibilityLabel="Calendar" onPress={() => {}}>
              <Icon name="Calendar" size={22} color={colors.text} />
            </GlassHeaderButton>
            <GlassHeaderButton accessibilityLabel="Filter" onPress={() => {}}>
              <Icon name="Table" size={22} color={colors.text} />
            </GlassHeaderButton>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {showErrorBanner ? (
          <Pressable
            style={[styles.errorBanner, { backgroundColor: colors.error }]}
            onPress={refetch}
            accessibilityRole="button"
            accessibilityLabel="Something went wrong. Tap to retry."
          >
            <Text variant="caption" color="primaryContrast">{error}</Text>
            <Text variant="micro" color="primaryContrast">Tap to retry</Text>
          </Pressable>
        ) : null}

        <View style={styles.segmentRow}>
          {SEGMENTS.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSegment(s.id)}
              style={[styles.segmentBtn, segment === s.id && [styles.segmentBtnActive, { backgroundColor: colors.primary }]]}
              accessibilityRole="button"
              accessibilityState={{ selected: segment === s.id }}
              accessibilityLabel={s.label}
              hitSlop={HIT_SLOP}
            >
              <Text
                variant="caption"
                color={segment === s.id ? 'primaryContrast' : 'text'}
                style={segment === s.id ? undefined : styles.inactiveLabel}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Pressable
            style={[styles.chip, leagueFilter === 'my_leagues' && { backgroundColor: colors.primary }]}
            onPress={() => setLeagueFilter('my_leagues')}
            accessibilityRole="button"
            accessibilityLabel="My Leagues"
            hitSlop={HIT_SLOP}
          >
            <Text
              variant="caption"
              color={leagueFilter === 'my_leagues' ? 'primaryContrast' : 'text'}
              style={leagueFilter === 'my_leagues' ? undefined : styles.inactiveLabel}
            >
              My Leagues
            </Text>
          </Pressable>
          <Pressable
            style={[styles.chip, leagueFilter === 'all' && { backgroundColor: colors.primary }]}
            onPress={() => setLeagueFilter('all')}
            accessibilityRole="button"
            accessibilityLabel="All Leagues"
            hitSlop={HIT_SLOP}
          >
            <Text
              variant="caption"
              color={leagueFilter === 'all' ? 'primaryContrast' : 'text'}
              style={leagueFilter === 'all' ? undefined : styles.inactiveLabel}
            >
              All
            </Text>
          </Pressable>
          {competitionsFromFixtures.map(([id, name]) => (
            <Pressable
              key={id}
              style={[styles.chip, leagueFilter === id && { backgroundColor: colors.primary }]}
              onPress={() => setLeagueFilter(id)}
              accessibilityRole="button"
              accessibilityLabel={name}
              hitSlop={HIT_SLOP}
            >
              <Text
                variant="caption"
                color={leagueFilter === id ? 'primaryContrast' : 'text'}
                numberOfLines={1}
                style={[styles.chipText, leagueFilter === id ? undefined : styles.inactiveLabel]}
              >
                {name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {grouped.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              title={segment === 'results' ? 'No results' : 'No fixtures'}
              description={
                leagueFilter === 'my_leagues' && noFavourites
                  ? 'Add favourite teams or leagues to filter here, or use All to see everything.'
                  : 'Fixtures from today onward will appear here. Try another filter or segment.'
              }
              primaryAction={{ label: 'Refresh', onPress: refetch }}
            />
          </View>
        ) : (
          <View style={styles.listWrap}>
            {grouped.map((g) => (
              <View key={g.competitionId} style={styles.leagueSection}>
                <Text variant="bodyBold" color="text" style={styles.leagueHeader}>{g.leagueName}</Text>
                <GlassCard variant="card" style={styles.leagueCard}>
                  {g.dateGroups.map((dg) => (
                    <View key={dg.dateLabel}>
                      <Text variant="caption" color="textSecondary" style={styles.dateHeader}>{dg.dateLabel}</Text>
                      {dg.items.map((item) => (
                        <FixtureRow
                          key={item.id}
                          item={item}
                          onPress={() => router.push(`/(tabs)/games/${item.id}`)}
                        />
                      ))}
                    </View>
                  ))}
                </GlassCard>
              </View>
            ))}
          </View>
        )}
        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: HEADER_OFFSET, paddingBottom: tokens.spacing.xxl },
  loadingContent: { padding: tokens.spacing.lg },
  segmentSkeleton: { marginBottom: tokens.spacing.md },
  lineSkeleton: { marginBottom: tokens.spacing.sm },
  errorContent: { flex: 1, padding: tokens.spacing.xl, justifyContent: 'center' },
  headerTitle: { marginLeft: 4 },
  headerRight: { flexDirection: 'row', gap: tokens.spacing.sm, alignItems: 'center' },
  errorBanner: { padding: tokens.spacing.md, marginHorizontal: tokens.spacing.lg, marginTop: tokens.spacing.sm, borderRadius: tokens.radius.md },
  segmentRow: { flexDirection: 'row', gap: tokens.spacing.xs, paddingHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.sm },
  segmentBtn: { paddingVertical: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md, borderRadius: tokens.radius.md, minHeight: MIN_TOUCH, justifyContent: 'center' },
  segmentBtnActive: {},
  filterRow: { flexDirection: 'row', gap: tokens.spacing.sm, paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.md },
  chip: { paddingVertical: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md, borderRadius: tokens.radius.full, minHeight: MIN_TOUCH, justifyContent: 'center' },
  chipText: { maxWidth: 140 },
  inactiveLabel: { opacity: 0.78 },
  emptyWrap: { padding: tokens.spacing.xl },
  listWrap: { paddingHorizontal: tokens.spacing.lg },
  leagueSection: { marginBottom: tokens.spacing.lg },
  leagueHeader: { marginBottom: tokens.spacing.xs },
  leagueCard: { padding: 0, overflow: 'hidden' },
  dateHeader: { paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: tokens.spacing.md, paddingHorizontal: tokens.spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tokens.glass.stroke.subtle },
  rowTouchable: { flex: 1 },
  rowInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  rowContent: { flex: 1, minWidth: 0 },
  scoreBlock: { alignItems: 'flex-end', marginLeft: tokens.spacing.sm },
  pressed: { opacity: 0.9 },
  footer: { height: tokens.spacing.xxl },
});
