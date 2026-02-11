/**
 * Favourites tab. Premium glass UI. Data from useFavourites only; search via useSearch.
 * Add/remove with star; list current favourites with resolved names. EmptyState nudge to add 3.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { FavouriteButton } from '../../components/FavouriteButton';
import { useFavourites } from '../../features/favourites/useFavourites';
import { useSearch, type SearchCompetition, type SearchTeam } from '../../features/search/useSearch';
import { supabase } from '../../lib/supabase';
import { tokens } from '../../lib/theme';
import {
  EmptyState,
  GlassCard,
  GlassHeader,
  Icon,
  Skeleton,
  Text,
  useResolvedColors,
} from '../../lib/ui';

const MIN_TOUCH = 44;
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const FAVOURITES_NUDGE = 3;

export default function FavouritesScreen() {
  const router = useRouter();
  const colors = useResolvedColors();
  const [query, setQuery] = useState('');
  const { competitions: searchComps, teams: searchTeams, loading: searchLoading } = useSearch(query);
  const {
    teamIds,
    competitionIds,
    loading: favLoading,
    error: favError,
    refetch,
  } = useFavourites();
  const [refreshing, setRefreshing] = useState(false);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [compNames, setCompNames] = useState<Record<string, string>>({});

  const hasQuery = query.trim().length >= 2;
  const totalFavs = teamIds.length + competitionIds.length;
  const showEmptyFavs = !favLoading && !refreshing && totalFavs === 0;

  useEffect(() => {
    if (teamIds.length === 0) {
      setTeamNames({});
      return;
    }
    let cancelled = false;
    void supabase
      .from('teams')
      .select('id, name')
      .in('id', teamIds)
      .then(
        ({ data }: { data: { id: string; name: string }[] | null }) => {
          if (cancelled) return;
          const map: Record<string, string> = {};
          (data ?? []).forEach((r) => {
            map[r.id] = r.name ?? r.id;
          });
          setTeamNames(map);
        },
        () => undefined
      );
    return () => { cancelled = true; };
  }, [teamIds]);

  useEffect(() => {
    if (competitionIds.length === 0) {
      setCompNames({});
      return;
    }
    let cancelled = false;
    void supabase
      .from('competitions_deduped')
      .select('id, name')
      .in('id', competitionIds)
      .then(
        ({ data }: { data: { id: string; name: string }[] | null }) => {
          if (cancelled) return;
          const map: Record<string, string> = {};
          (data ?? []).forEach((r) => {
            map[r.id] = r.name ?? r.id;
          });
          setCompNames(map);
        },
        () => undefined
      );
    return () => { cancelled = true; };
  }, [competitionIds]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const favouriteTeamsList = useMemo(
    () => teamIds.map((id: string) => ({ id, name: teamNames[id] ?? id.slice(0, 8), type: 'team' as const })),
    [teamIds, teamNames]
  );
  const favouriteCompsList = useMemo(
    () => competitionIds.map((id: string) => ({ id, name: compNames[id] ?? id.slice(0, 8), type: 'competition' as const })),
    [competitionIds, compNames]
  );

  if (showEmptyFavs && !hasQuery) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader titleSlot={<Text variant="bodyBold" color="text">Favourites</Text>} />
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Add your favourites"
            description={`Follow ${FAVOURITES_NUDGE} teams or leagues to see them here. Search below to add.`}
            primaryAction={{ label: 'Search teams & leagues', onPress: () => router.push('/(tabs)/search') }}
            icon="Star"
          />
        </View>
        <View style={styles.searchPillWrap}>
          <View style={[styles.searchPill, { backgroundColor: colors.surface }]}>
            <Icon name="Search" size={20} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search to add teams or leagues…"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
              accessibilityLabel="Search teams or leagues"
              accessibilityRole="search"
            />
          </View>
        </View>
        {(searchTeams.length > 0 || searchComps.length > 0) ? (
          <ScrollView style={styles.searchResults} contentContainerStyle={styles.searchResultsContent}>
            {searchComps.length > 0 && (
              <View style={styles.section}>
                <Text variant="bodyBold" color="textSecondary" style={styles.sectionTitle}>Competitions</Text>
                <GlassCard variant="card" style={styles.card}>
                  {searchComps.map((c: SearchCompetition) => (
                    <View key={c.id} style={styles.row}>
                      <Text variant="bodyBold" color="text" numberOfLines={1} style={styles.rowTitle}>{c.name}</Text>
                      <FavouriteButton entityType="competition" entityId={c.id} size={22} />
                    </View>
                  ))}
                </GlassCard>
              </View>
            )}
            {searchTeams.length > 0 && (
              <View style={styles.section}>
                <Text variant="bodyBold" color="textSecondary" style={styles.sectionTitle}>Teams</Text>
                <GlassCard variant="card" style={styles.card}>
                  {searchTeams.map((t: SearchTeam) => (
                    <View key={t.id} style={styles.row}>
                      <Text variant="bodyBold" color="text" numberOfLines={1} style={styles.rowTitle}>{t.name}</Text>
                      <FavouriteButton entityType="team" entityId={t.id} size={22} />
                    </View>
                  ))}
                </GlassCard>
              </View>
            )}
          </ScrollView>
        ) : hasQuery && searchLoading ? (
          <View style={styles.loadingWrap}>
            <Skeleton variant="line" style={styles.skeletonLine} />
            <Skeleton variant="block" width={280} height={48} style={styles.skeletonBlock} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader
        leftSlot={
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Back to Home" hitSlop={HIT_SLOP}>
            <Icon name="ArrowBack" size={24} color={colors.text} />
          </Pressable>
        }
        titleSlot={<Text variant="bodyBold" color="text">Favourites</Text>}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {totalFavs > 0 && totalFavs < FAVOURITES_NUDGE && (
          <GlassCard variant="card" style={styles.nudgeCard}>
            <Text variant="body" color="text">{totalFavs} of {FAVOURITES_NUDGE} favourites. Add more to get the most from your feed.</Text>
          </GlassCard>
        )}

        <View style={styles.searchPillWrap}>
          <View style={[styles.searchPill, { backgroundColor: colors.surface }]}>
            <Icon name="Search" size={20} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search to add more…"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
              accessibilityLabel="Search teams or leagues"
              accessibilityRole="search"
            />
          </View>
        </View>

        {favError ? (
          <View style={styles.errorWrap}>
            <EmptyState
              title="Something went wrong"
              description={favError}
              primaryAction={{ label: 'Retry', onPress: refetch }}
              mode="error"
            />
          </View>
        ) : null}

        {!favError && (favouriteTeamsList.length > 0 || favouriteCompsList.length > 0) && (
          <View style={styles.section}>
            <Text variant="bodyBold" color="textSecondary" style={styles.sectionTitle}>Your favourites</Text>
            <GlassCard variant="card" style={styles.card}>
              {favouriteCompsList.map(({ id, name }: { id: string; name: string }) => (
                <Pressable
                  key={`c-${id}`}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  onPress={() => router.push(`/(tabs)/competitions/${id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${name}. Open competition.`}
                  hitSlop={HIT_SLOP}
                >
                  <Text variant="bodyBold" color="text" numberOfLines={1} style={styles.rowTitle}>{name}</Text>
                  <View style={styles.rowRight}>
                    <Text variant="caption" color="textMuted">Competition</Text>
                    <FavouriteButton entityType="competition" entityId={id} size={22} />
                  </View>
                </Pressable>
              ))}
              {favouriteTeamsList.map(({ id, name }: { id: string; name: string }) => (
                <View key={`t-${id}`} style={styles.row}>
                  <Text variant="bodyBold" color="text" numberOfLines={1} style={styles.rowTitle}>{name}</Text>
                  <View style={styles.rowRight}>
                    <Text variant="caption" color="textMuted">Team</Text>
                    <FavouriteButton entityType="team" entityId={id} size={22} />
                  </View>
                </View>
              ))}
            </GlassCard>
          </View>
        )}

        {hasQuery && (searchTeams.length > 0 || searchComps.length > 0) && (
          <View style={styles.section}>
            <Text variant="bodyBold" color="textSecondary" style={styles.sectionTitle}>Search results</Text>
            <GlassCard variant="card" style={styles.card}>
              {searchComps.map((c: SearchCompetition) => (
                <View key={c.id} style={styles.row}>
                  <Text variant="bodyBold" color="text" numberOfLines={1} style={styles.rowTitle}>{c.name}</Text>
                  <FavouriteButton entityType="competition" entityId={c.id} size={22} />
                </View>
              ))}
              {searchTeams.map((t: SearchTeam) => (
                <View key={t.id} style={styles.row}>
                  <Text variant="bodyBold" color="text" numberOfLines={1} style={styles.rowTitle}>{t.name}</Text>
                  <FavouriteButton entityType="team" entityId={t.id} size={22} />
                </View>
              ))}
            </GlassCard>
          </View>
        )}

        {hasQuery && !searchLoading && searchTeams.length === 0 && searchComps.length === 0 && query.trim().length >= 2 && (
          <Text variant="caption" color="textSecondary" style={styles.noResults}>No results for &quot;{query.trim()}&quot;</Text>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: tokens.spacing.xxl },
  emptyWrap: { flex: 1, padding: tokens.spacing.xl, justifyContent: 'center' },
  searchPillWrap: { paddingHorizontal: tokens.spacing.lg, paddingVertical: tokens.spacing.sm },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.full,
    gap: tokens.spacing.sm,
    minHeight: MIN_TOUCH,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 4 },
  loadingWrap: { padding: tokens.spacing.lg },
  skeletonLine: { marginBottom: tokens.spacing.sm },
  skeletonBlock: { marginTop: tokens.spacing.sm },
  errorWrap: { padding: tokens.spacing.xl },
  nudgeCard: { marginHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.md },
  section: { marginBottom: tokens.spacing.xl, paddingHorizontal: tokens.spacing.lg },
  sectionTitle: { marginBottom: tokens.spacing.sm },
  card: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    minHeight: MIN_TOUCH,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.glass.stroke.subtle,
  },
  rowTitle: { flex: 1, marginRight: tokens.spacing.sm },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  backBtn: { padding: 4 },
  pressed: { opacity: 0.9 },
  noResults: { paddingHorizontal: tokens.spacing.lg, marginTop: tokens.spacing.sm },
  searchResults: { maxHeight: 240 },
  searchResultsContent: { paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.lg },
  footer: { height: tokens.spacing.xxl },
});
