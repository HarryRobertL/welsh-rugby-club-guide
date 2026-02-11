/**
 * Home tab. Premium glass UI. Data from useHomeData only; favourites from useFavourites only.
 * Motion: Reanimated section enter, live card scale, skeleton/content crossfade. Respects reduced motion.
 * File: app/(tabs)/index.tsx — default tab route (/).
 */
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
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
} from '../../lib/ui';
import { useAuth } from '../../features/auth/AuthContext';
import { useFavourites } from '../../features/favourites/useFavourites';
import { useHomeData } from '../../features/home/useHomeData';
import { teamLabel } from '../../lib/teamLabel';
import { tokens } from '../../lib/theme';
import type { LiveMatch, UpcomingFixture } from '../../types/home';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const MIN_TOUCH = 44;

function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDateKey(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (isToday) return 'Today';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

type UpcomingGroup = { dateLabel: string; items: UpcomingFixture[] };

const springConfig = { damping: 18, stiffness: 180 };

const LiveNowCard = React.memo(function LiveNowCard({
  m,
  onPress,
  reduceMotion,
}: {
  m: LiveMatch;
  onPress: (id: string) => void;
  reduceMotion: boolean;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: reduceMotion ? [] : [{ scale: scale.value }],
  }));

  const label = `${m.home_team_name} v ${m.away_team_name}, Live, ${m.score_home} ${m.score_away}. Open match.`;
  return (
    <Pressable
      onPress={() => onPress(m.id)}
      onPressIn={() => { if (!reduceMotion) scale.value = withSpring(0.96, springConfig); }}
      onPressOut={() => { if (!reduceMotion) scale.value = withSpring(1, springConfig); }}
      style={styles.liveCard}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={HIT_SLOP}
    >
      <Animated.View style={[styles.liveCardAnimated, animatedStyle]}>
        <GlassCard variant="card" style={styles.liveCardInner}>
          <Badge label="LIVE" variant="live" style={styles.liveBadge} />
          <Text variant="bodyBold" color="text" numberOfLines={1}>
            {m.home_team_name} v {m.away_team_name}
          </Text>
          <Text variant="h3" color="text" style={styles.liveScore}>
            {m.score_home} – {m.score_away}
          </Text>
          {m.venue_name ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>{m.venue_name}</Text>
          ) : null}
          <Text variant="caption" color="primary" style={styles.openCta}>Open match</Text>
        </GlassCard>
      </Animated.View>
    </Pressable>
  );
});

const UpcomingRow = React.memo(function UpcomingRow({
  f,
  onPress,
}: {
  f: UpcomingFixture;
  onPress: (id: string) => void;
}) {
  const teams = `${String(teamLabel(f.home_team_name))} v ${String(teamLabel(f.away_team_name))}`;
  const label = `${formatKickoff(f.scheduled_at)}, ${teams}. Open match.`;
  return (
    <Pressable
      onPress={() => onPress(f.id)}
      style={({ pressed }) => [styles.upcomingRow, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={HIT_SLOP}
    >
      <Text variant="caption" color="textSecondary" style={styles.upcomingTime}>
        {formatKickoff(f.scheduled_at)}
      </Text>
      <Text variant="bodyBold" color="text" numberOfLines={1} style={styles.upcomingTeams}>
        {teams}
      </Text>
      <View style={styles.upcomingMeta}>
        {f.competition_name ? (
          <Badge label={f.competition_name} variant="neutral" style={styles.compBadge} />
        ) : null}
        {f.venue_name ? (
          <Text variant="micro" color="textMuted" numberOfLines={1}>{f.venue_name}</Text>
        ) : null}
      </View>
    </Pressable>
  );
});

function AnimatedSection({
  children,
  reduceMotion,
  index,
}: {
  children: React.ReactNode;
  reduceMotion: boolean;
  index: number;
}) {
  const entering = useMemo(
    () =>
      reduceMotion
        ? FadeIn.duration(120)
        : SlideInUp.duration(280).springify().delay(index * 40),
    [reduceMotion, index]
  );
  return <Animated.View entering={entering} style={styles.sectionWrap}>{children}</Animated.View>;
}

function groupUpcomingByDate(fixtures: UpcomingFixture[]): UpcomingGroup[] {
  const byDate = new Map<string, UpcomingFixture[]>();
  for (const f of fixtures) {
    const key = formatDateKey(f.scheduled_at);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(f);
  }
  return Array.from(byDate.entries())
    .map(([dateLabel, items]) => ({ dateLabel, items }))
    .sort((a, b) => {
      const tA = new Date(a.items[0]!.scheduled_at).getTime();
      const tB = new Date(b.items[0]!.scheduled_at).getTime();
      return tA - tB;
    });
}

export default function HomeScreen() {
  const colors = useResolvedColors();
  const reduceMotion = useReducedMotion();
  const { session } = useAuth();
  const {
    teamIds: favouriteTeamIds,
    competitionIds: favouriteCompetitionIds,
    fixtureIds: favouriteFixtureIds,
  } = useFavourites();
  const {
    upcomingFixtures,
    liveMatches,
    loading,
    error,
    refetch,
  } = useHomeData({
    userId: session?.user?.id,
    favouriteTeamIds,
    favouriteCompetitionIds,
    favouriteFixtureIds,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onPressFixture = useCallback((fixtureId: string) => {
    router.push(`/(tabs)/games/${fixtureId}`);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const hasFavourites =
    favouriteTeamIds.length > 0 || favouriteCompetitionIds.length > 0 || favouriteFixtureIds.length > 0;
  const hasCachedData = liveMatches.length > 0 || upcomingFixtures.length > 0;
  const showErrorBanner = !!error && hasCachedData;
  const showLoading = loading && !refreshing;
  const showEmptyFavourites = !loading && !hasFavourites;

  const upcomingGroups = useMemo(() => groupUpcomingByDate(upcomingFixtures), [upcomingFixtures]);

  const onPressCompetition = useCallback((id: string) => {
    router.push(`/(tabs)/competitions/${id}`);
  }, []);

  const onPressTeamChip = useCallback((_teamId: string) => {
    // TODO: Navigate to team or filtered fixtures view when route exists.
  }, []);

  if (showEmptyFavourites) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader
          titleSlot={
            <View style={styles.logoWrap}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="Cymru Rugby"
              />
            </View>
          }
          rightSlot={
            <View style={styles.headerRight}>
              <GlassHeaderButton accessibilityLabel="Notifications" onPress={() => {}}>
                <Icon name="Bell" size={22} color={colors.text} />
              </GlassHeaderButton>
              <GlassHeaderButton
                accessibilityLabel="Account"
                onPress={() => router.push('/(tabs)/account')}
              >
                <Icon name="Person" size={22} color={colors.text} />
              </GlassHeaderButton>
            </View>
          }
        />
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Add your favourites"
            description="Follow 3 teams or leagues to see live matches and upcoming fixtures here."
            primaryAction={{ label: 'Find teams & leagues', onPress: () => router.push('/(tabs)/favourites') }}
            secondaryAction={{ label: 'Browse competitions', onPress: () => router.push('/(tabs)/competitions') }}
            icon="Star"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader
        titleSlot={
          <View style={styles.logoWrap}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Cymru Rugby"
            />
          </View>
        }
        rightSlot={
          <View style={styles.headerRight}>
            <GlassHeaderButton accessibilityLabel="Notifications" onPress={() => {}}>
              <Icon name="Bell" size={22} color={colors.text} />
            </GlassHeaderButton>
            <GlassHeaderButton
              accessibilityLabel="Account"
              onPress={() => router.push('/(tabs)/account')}
            >
              <Icon name="Person" size={22} color={colors.text} />
            </GlassHeaderButton>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
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

        {/* Search pill — visual only */}
        <View style={styles.searchPillWrap}>
          <GlassCard variant="pill" style={styles.searchPill}>
            <Icon name="Search" size={20} color={colors.textMuted} />
            <Text variant="body" color="textMuted" style={styles.searchPlaceholder}>
              Search leagues or teams…
            </Text>
          </GlassCard>
        </View>

        {/* A. Live Now */}
        <AnimatedSection reduceMotion={reduceMotion} index={0}>
          <Text variant="h3" color="text" style={styles.sectionTitle}>Live now</Text>
          {showLoading ? (
            <Animated.View exiting={FadeOut.duration(reduceMotion ? 100 : 180)}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Skeleton variant="block" width={280} height={140} style={styles.liveSkeleton} />
                <Skeleton variant="block" width={280} height={140} style={styles.liveSkeleton} />
              </ScrollView>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(reduceMotion ? 100 : 200)}>
              {liveMatches.length > 0 ? (
                <FlatList
                  data={liveMatches}
                  keyExtractor={(item) => item.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.carouselContent}
                  renderItem={({ item }) => (
                    <LiveNowCard m={item} onPress={onPressFixture} reduceMotion={reduceMotion} />
                  )}
                />
              ) : (
                <GlassCard variant="card">
                  <Text variant="body" color="textSecondary" style={styles.emptySection}>No live matches</Text>
                </GlassCard>
              )}
            </Animated.View>
          )}
        </AnimatedSection>

        {/* B. Your Clubs */}
        <AnimatedSection reduceMotion={reduceMotion} index={1}>
          <Text variant="h3" color="text" style={styles.sectionTitle}>Your clubs</Text>
          {showLoading ? (
            <Animated.View exiting={FadeOut.duration(reduceMotion ? 100 : 180)} style={styles.chipsRow}>
              <Skeleton variant="block" width={100} height={36} radius={tokens.radius.full} />
              <Skeleton variant="block" width={100} height={36} radius={tokens.radius.full} />
            </Animated.View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
              {favouriteTeamIds.map((teamId) => (
                <Pressable
                  key={`team-${teamId}`}
                  onPress={() => onPressTeamChip(teamId)}
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Your team. Tap to view."
                  hitSlop={HIT_SLOP}
                >
                  <Icon name="Star" size={16} color={colors.text} />
                  <Text variant="caption" color="text">Team</Text>
                </Pressable>
              ))}
              {favouriteCompetitionIds.map((compId) => (
                <Pressable
                  key={`comp-${compId}`}
                  onPress={() => onPressCompetition(compId)}
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Your league. Tap to open."
                  hitSlop={HIT_SLOP}
                >
<Icon name="Star" size={16} color={colors.text} />
                <Text variant="caption" color="text">League</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </AnimatedSection>

        {/* C. Upcoming fixtures */}
        <AnimatedSection reduceMotion={reduceMotion} index={2}>
          <Text variant="h3" color="text" style={styles.sectionTitle}>
            {hasFavourites ? 'Upcoming' : 'Upcoming (all leagues)'}
          </Text>
          {showLoading ? (
            <Animated.View exiting={FadeOut.duration(reduceMotion ? 100 : 180)}>
              <Skeleton variant="line" style={styles.upcomingSkeleton} />
              <Skeleton variant="line" style={styles.upcomingSkeleton} />
              <Skeleton variant="line" style={styles.upcomingSkeleton} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(reduceMotion ? 100 : 200)}>
          {upcomingGroups.length > 0 ? (
            upcomingGroups.map((group) => (
              <View key={group.dateLabel} style={styles.dateGroup}>
                <Text variant="caption" color="textSecondary" style={styles.dateLabel}>
                  {group.dateLabel}
                </Text>
                <GlassCard variant="card" style={styles.upcomingCard}>
                  {group.items.map((f) => (
                    <UpcomingRow key={f.id} f={f} onPress={onPressFixture} />
                  ))}
                </GlassCard>
              </View>
            ))
          ) : (
            <GlassCard variant="card">
              <Text variant="body" color="textSecondary" style={styles.emptySection}>No upcoming fixtures</Text>
            </GlassCard>
          )}
            </Animated.View>
          )}
        </AnimatedSection>

        {/* D. Recent results — omitted: not in useHomeData */}
        {/* E. Tables snapshot — omitted: not in useHomeData */}

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: tokens.spacing.xxl },
  headerTitle: { marginLeft: 4 },
  logoWrap: {
    marginBottom: -14,
    paddingBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  logo: { height: 48, maxWidth: 200 },
  headerRight: { flexDirection: 'row', gap: tokens.spacing.sm, alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', padding: tokens.spacing.xl },
  errorBanner: {
    padding: tokens.spacing.md,
    marginHorizontal: tokens.spacing.lg,
    marginTop: tokens.spacing.sm,
    borderRadius: tokens.radius.md,
  },
  searchPillWrap: { paddingHorizontal: tokens.spacing.lg, marginTop: tokens.spacing.sm },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    minHeight: MIN_TOUCH,
  },
  searchPlaceholder: { flex: 1 },
  section: { marginTop: tokens.spacing.xl, paddingHorizontal: tokens.spacing.lg },
  sectionWrap: { marginTop: tokens.spacing.xl, paddingHorizontal: tokens.spacing.lg },
  sectionTitle: { marginBottom: tokens.spacing.sm },
  carouselContent: { gap: tokens.spacing.md, paddingRight: tokens.spacing.lg },
  liveCard: { width: 280, minHeight: MIN_TOUCH },
  liveCardAnimated: { width: '100%' },
  liveCardInner: { minHeight: 120 },
  liveBadge: { marginBottom: tokens.spacing.xs },
  liveScore: { marginVertical: tokens.spacing.xs },
  openCta: { marginTop: tokens.spacing.sm },
  pressed: { opacity: 0.9 },
  chipsRow: { flexDirection: 'row', gap: tokens.spacing.sm, paddingVertical: tokens.spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.full,
    minHeight: MIN_TOUCH,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dateGroup: { marginBottom: tokens.spacing.lg },
  dateLabel: { marginBottom: tokens.spacing.xs, marginLeft: 2 },
  upcomingCard: { padding: 0, overflow: 'hidden' },
  upcomingRow: {
    minHeight: MIN_TOUCH,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.glass.stroke.subtle,
  },
  upcomingTime: { marginBottom: 2 },
  upcomingTeams: { marginBottom: 2 },
  upcomingMeta: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, flexWrap: 'wrap' },
  compBadge: { alignSelf: 'flex-start' },
  liveSkeleton: { marginRight: tokens.spacing.md },
  upcomingSkeleton: { marginBottom: tokens.spacing.sm },
  emptySection: { textAlign: 'center' },
  footer: { height: tokens.spacing.xxl },
});
