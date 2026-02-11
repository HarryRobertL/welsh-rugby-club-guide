/**
 * Competition detail. Premium glass UI. Season selector, league table, fixtures from today forward.
 * File: app/(tabs)/competitions/[id].tsx — route /competitions/:id.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { FavouriteButton } from '../../../components/FavouriteButton';
import { Table, type TableColumn } from '../../../components/Table';
import { useCompetition } from '../../../features/competitions/useCompetition';
import { useSeasons } from '../../../features/competitions/useSeasons';
import { useStandingsWithForm } from '../../../features/competitions/useStandingsWithForm';
import { useFixturesBySeason } from '../../../features/competitions/useFixturesBySeason';
import { getCompetitionDisplayName } from '../../../lib/competitionOverrides';
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
import type { LeagueTableRow } from '../../../types/competitions';
import type { FixtureListItem } from '../../../types/games';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const MIN_TOUCH = 44;

function nowIso(): string {
  return new Date().toISOString();
}

export default function CompetitionDetailScreen() {
  const router = useRouter();
  const colors = useResolvedColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { competition, loading: competitionLoading } = useCompetition(id);
  const { seasons, loading: seasonsLoading, error: seasonsError } = useSeasons(id);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const effectiveSeasonId = selectedSeasonId ?? seasons[0]?.id;
  const { rows, loading: standingsLoading, error: standingsError, refetch } = useStandingsWithForm(effectiveSeasonId);
  const {
    fixtures,
    loading: fixturesLoading,
    error: fixturesError,
    refetch: refetchFixtures,
  } = useFixturesBySeason(effectiveSeasonId);

  const competitionTitle =
    competition != null
      ? getCompetitionDisplayName(
          competition.source ?? null,
          competition.source_ref ?? null,
          competition.name ?? '',
          competition.slug
        )
      : 'Super Rygbi Cymru';

  const hasLiveFixture = fixtures.some((f) => f.status === 'live');
  const fixturesRefetchRef = useRef(refetchFixtures);
  const standingsRefetchRef = useRef(refetch);
  const standingsWarningRef = useRef<string | null>(null);
  fixturesRefetchRef.current = refetchFixtures;
  standingsRefetchRef.current = refetch;

  useEffect(() => {
    if (!effectiveSeasonId) return;
    if (hasLiveFixture) {
      const t = setInterval(() => fixturesRefetchRef.current(), 20000);
      return () => clearInterval(t);
    }
    const t = setInterval(() => {
      standingsRefetchRef.current();
      fixturesRefetchRef.current();
    }, 90000);
    return () => clearInterval(t);
  }, [effectiveSeasonId, hasLiveFixture]);

  const loading = competitionLoading || seasonsLoading || standingsLoading;
  const error = seasonsError ?? standingsError ?? fixturesError;

  const { upcomingFixtures, resultsFixtures } = useMemo(() => {
    const now = nowIso();
    const upcoming = fixtures
      .filter((f) => f.status === 'live' || f.scheduled_at >= now)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    const results = fixtures
      .filter((f) => f.status === 'full_time')
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
    return { upcomingFixtures: upcoming, resultsFixtures: results };
  }, [fixtures]);

  const tableColumns = useMemo<TableColumn<LeagueTableRow>[]>(
    () => [
      { key: 'position', label: '#', width: 32 },
      { key: 'team_name', label: 'Team', width: 140 },
      { key: 'played', label: 'P', width: 28 },
      { key: 'won', label: 'W', width: 28 },
      { key: 'drawn', label: 'D', width: 28 },
      { key: 'lost', label: 'L', width: 28 },
      { key: 'points_for', label: 'PF', width: 52 },
      { key: 'points_against', label: 'PA', width: 52 },
      { key: 'points', label: 'Pts', width: 48 },
      { key: 'form', label: 'Form', width: 100, render: (value) => (value === '' || value == null ? '—' : String(value)) },
    ],
    []
  );

  useEffect(() => {
    if (rows.length === 0 && fixtures.length > 0 && effectiveSeasonId) {
      if (standingsWarningRef.current === effectiveSeasonId) return;
      standingsWarningRef.current = effectiveSeasonId;
      if (__DEV__ && typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[competition] Standings empty but fixtures exist for this season – check standings join to season_id',
          { competitionId: id, seasonId: effectiveSeasonId }
        );
      }
    }
  }, [rows.length, fixtures.length, effectiveSeasonId, id]);

  if (seasonsLoading && seasons.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader titleSlot={<Text variant="bodyBold" color="text">League table</Text>} />
        <View style={styles.loadingWrap}>
          <Skeleton variant="line" style={styles.skeletonLine} />
          <Skeleton variant="block" width={320} height={120} style={styles.skeletonBlock} />
        </View>
      </View>
    );
  }

  if (seasonsError && seasons.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader
          leftSlot={
            <GlassHeaderButton accessibilityLabel="Back" onPress={() => router.back()}>
              <Icon name="ArrowBack" size={24} color={colors.text} />
            </GlassHeaderButton>
          }
          titleSlot={<Text variant="bodyBold" color="text">League table</Text>}
        />
        <View style={styles.errorWrap}>
          <EmptyState
            title="Something went wrong"
            description={seasonsError}
            primaryAction={{ label: 'Retry', onPress: () => router.back() }}
            mode="error"
          />
        </View>
      </View>
    );
  }

  if (seasons.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader
          leftSlot={
            <GlassHeaderButton accessibilityLabel="Back" onPress={() => router.back()}>
              <Icon name="ArrowBack" size={24} color={colors.text} />
            </GlassHeaderButton>
          }
          titleSlot={<Text variant="bodyBold" color="text">League table</Text>}
        />
        <View style={styles.errorWrap}>
          <EmptyState
            title="No season data"
            description="No season data for this league yet. Check back later or try another league."
            primaryAction={{ label: 'Back', onPress: () => router.back() }}
          />
        </View>
      </View>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    await refetchFixtures();
    setRefreshing(false);
  };

  const formatFixtureDate = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const FixtureRow = ({ f }: { f: FixtureListItem }) => {
    const showScore = f.status === 'live' || f.status === 'full_time';
    const variant = f.status === 'live' ? 'live' : f.status === 'full_time' ? 'ft' : 'scheduled';
    const label = f.status === 'live' ? 'LIVE' : f.status === 'full_time' ? 'FT' : 'KO';
    return (
      <Pressable
        style={({ pressed }) => [styles.fixtureRow, pressed && styles.pressed]}
        onPress={() => router.push(`/(tabs)/games/${f.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${formatFixtureDate(f.scheduled_at)} ${teamLabel(f.home_team_name)} v ${teamLabel(f.away_team_name)}. Open match.`}
        hitSlop={HIT_SLOP}
      >
        <View style={styles.fixtureRowContent}>
          <Text variant="caption" color="textSecondary">{formatFixtureDate(f.scheduled_at)}</Text>
          <Text variant="bodyBold" color="text" numberOfLines={1}>
            {teamLabel(f.home_team_name)} v {teamLabel(f.away_team_name)}
          </Text>
          {showScore && (
            <View style={styles.fixtureScoreRow}>
              <Badge label={label} variant={variant} />
              <Text variant="bodyBold" color="text">{f.score_home ?? 0} – {f.score_away ?? 0}</Text>
            </View>
          )}
          {f.venue_name ? <Text variant="caption" color="textMuted">{f.venue_name}</Text> : null}
        </View>
        <Icon name="ChevronRight" size={20} color={colors.textMuted} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader
        leftSlot={
          <GlassHeaderButton accessibilityLabel="Back to competitions" onPress={() => router.back()}>
            <Icon name="ArrowBack" size={24} color={colors.text} />
          </GlassHeaderButton>
        }
        titleSlot={<Text variant="bodyBold" color="text" numberOfLines={1} style={styles.headerTitle}>{competitionTitle}</Text>}
        rightSlot={
          <View style={styles.favWrap}>
            <FavouriteButton entityType="competition" entityId={id} size={22} />
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <GlassCard variant="card" style={styles.sectionCard}>
          <Text variant="bodyBold" color="textSecondary" style={styles.sectionTitle}>Season</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonChips}>
            {seasons.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setSelectedSeasonId(s.id)}
                style={[
                  styles.seasonChip,
                  effectiveSeasonId === s.id && { backgroundColor: colors.primary },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: effectiveSeasonId === s.id }}
                accessibilityLabel={s.name}
                hitSlop={HIT_SLOP}
              >
                <Text variant="caption" color={effectiveSeasonId === s.id ? 'primaryContrast' : 'textSecondary'}>
                  {s.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </GlassCard>

        {loading && rows.length === 0 ? (
          <GlassCard variant="card" style={styles.sectionCard}>
            <Skeleton variant="line" style={styles.skeletonLine} />
            <Skeleton variant="block" width={320} height={200} style={styles.skeletonBlock} />
          </GlassCard>
        ) : error ? (
          <View style={styles.inlineErrorWrap}>
            <EmptyState
              title="Something went wrong"
              description={error}
              primaryAction={{ label: 'Retry', onPress: onRefresh }}
              mode="error"
            />
          </View>
        ) : rows.length === 0 ? (
          <GlassCard variant="card" style={styles.sectionCard}>
            <EmptyState
              title="No standings"
              description="No standings for this season yet."
              primaryAction={{ label: 'Refresh', onPress: onRefresh }}
            />
          </GlassCard>
        ) : (
          <GlassCard variant="card" style={styles.sectionCard}>
            <Text variant="bodyBold" color="textSecondary" style={styles.sectionTitle}>League table</Text>
            <Table<LeagueTableRow>
              columns={tableColumns}
              data={rows}
              keyExtractor={(row) => row.id}
            />
          </GlassCard>
        )}

        <View style={styles.fixturesSection}>
          <Text variant="bodyBold" color="textSecondary" style={styles.sectionTitle}>Fixtures & Results</Text>
          {fixturesLoading && fixtures.length === 0 ? (
            <GlassCard variant="card" style={styles.sectionCard}>
              <Skeleton variant="line" style={styles.skeletonLine} />
              <Skeleton variant="line" style={styles.skeletonLine} />
            </GlassCard>
          ) : fixturesError ? (
            <GlassCard variant="card" style={styles.sectionCard}>
              <EmptyState
                title="Could not load fixtures"
                description={fixturesError}
                primaryAction={{ label: 'Retry', onPress: refetchFixtures }}
                mode="error"
              />
            </GlassCard>
          ) : fixtures.length === 0 ? (
            <GlassCard variant="card" style={styles.sectionCard}>
              <EmptyState
                title="No fixtures"
                description="No fixtures for this season."
                primaryAction={{ label: 'Refresh', onPress: onRefresh }}
              />
            </GlassCard>
          ) : (
            <>
              {rows.length === 0 && fixtures.length > 0 && (
                <Text variant="caption" color="textMuted" style={styles.tableHint}>
                  Table not available for this season; fixtures are shown below.
                </Text>
              )}
              {upcomingFixtures.length > 0 && (
                <GlassCard variant="card" style={styles.fixtureCard}>
                  <Text variant="caption" color="textMuted" style={styles.subsectionLabel}>Upcoming</Text>
                  {upcomingFixtures.map((f) => (
                    <FixtureRow key={f.id} f={f} />
                  ))}
                </GlassCard>
              )}
              {resultsFixtures.length > 0 && (
                <GlassCard variant="card" style={styles.fixtureCard}>
                  <Text variant="caption" color="textMuted" style={styles.subsectionLabel}>Results</Text>
                  {resultsFixtures.map((f) => (
                    <FixtureRow key={f.id} f={f} />
                  ))}
                </GlassCard>
              )}
            </>
          )}
        </View>
        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: tokens.spacing.xxl },
  loadingWrap: { padding: tokens.spacing.lg },
  skeletonLine: { marginBottom: tokens.spacing.sm },
  skeletonBlock: { marginTop: tokens.spacing.sm },
  errorWrap: { flex: 1, padding: tokens.spacing.xl, justifyContent: 'center' },
  inlineErrorWrap: { padding: tokens.spacing.lg },
  headerTitle: { maxWidth: 200 },
  favWrap: { minHeight: MIN_TOUCH, justifyContent: 'center' },
  sectionCard: { marginHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.lg },
  sectionTitle: { marginBottom: tokens.spacing.sm },
  seasonChips: { flexDirection: 'row', gap: tokens.spacing.sm, paddingVertical: tokens.spacing.xs },
  seasonChip: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.full,
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
  },
  tableHint: { marginBottom: tokens.spacing.sm, paddingHorizontal: tokens.spacing.lg },
  fixturesSection: { paddingHorizontal: tokens.spacing.lg },
  fixtureCard: { marginBottom: tokens.spacing.lg, padding: 0, overflow: 'hidden' },
  subsectionLabel: { paddingHorizontal: tokens.spacing.lg, paddingTop: tokens.spacing.md, marginBottom: tokens.spacing.xs },
  fixtureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    minHeight: MIN_TOUCH,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.glass.stroke.subtle,
  },
  fixtureRowContent: { flex: 1, minWidth: 0 },
  fixtureScoreRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, marginTop: tokens.spacing.xs },
  pressed: { opacity: 0.9 },
  footer: { height: tokens.spacing.xxl },
});
