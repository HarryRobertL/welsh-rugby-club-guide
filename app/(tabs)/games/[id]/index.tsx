/**
 * Match centre. Premium glass UI. Data from useMatchCentre only; lineups and events from existing hooks.
 * File: app/(tabs)/games/[id]/index.tsx
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
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
} from '../../../../lib/ui';
import { FavouriteButton } from '../../../../components/FavouriteButton';
import { useMatchCentre } from '../../../../features/games/useMatchCentre';
import { useMatchEvents } from '../../../../features/live/useMatchEvents';
import { useMatchLineups } from '../../../../features/lineup/useMatchLineups';
import { useAuth } from '../../../../features/auth/AuthContext';
import { teamLabel, toTeamDisplayString } from '../../../../lib/teamLabel';
import { tokens } from '../../../../lib/theme';
import type { MatchEventRow } from '../../../../types/live-events';
import type { LineupRow } from '../../../../types/lineup';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const MIN_TOUCH = 44;
const LIVE_POLL_MS = 30000;

function formatKoTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function eventTypeIcon(eventType: string): 'Football' | 'Shield' | 'Refresh' | 'ChevronRight' {
  const t = eventType.toLowerCase();
  if (t === 'try' || t === 'conversion' || t === 'penalty_goal' || t === 'penalty_try' || t === 'drop_goal') return 'Football';
  if (t === 'yellow_card' || t === 'red_card') return 'Shield';
  if (t.includes('substitut')) return 'Refresh';
  return 'ChevronRight';
}

function eventTypeLabel(eventType: string): string {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const TimelineEventRow = React.memo(function TimelineEventRow({ ev }: { ev: MatchEventRow }) {
  const colors = useResolvedColors();
  const iconName = eventTypeIcon(ev.event_type);
  const teamSide = ev.payload?.team_side ?? null;
  const accessibilityLabel = `${ev.minute != null ? `${ev.minute}'` : '—'} ${eventTypeLabel(ev.event_type)}${teamSide ? ` (${teamSide})` : ''}`;
  return (
    <View style={styles.timelineRow} accessibilityLabel={accessibilityLabel} accessibilityRole="text">
      <Text variant="caption" color="textSecondary" style={styles.timelineMinute}>
        {ev.minute != null ? `${ev.minute}'` : '—'}
      </Text>
      <Icon name={iconName} size={18} color={colors.primary} />
      <Text variant="body" color="text" numberOfLines={1} style={styles.timelineLabel}>
        {eventTypeLabel(ev.event_type)}
      </Text>
      {teamSide ? (
        <Badge label={teamSide} variant="neutral" />
      ) : null}
    </View>
  );
});

function LineupAccordion({
  title,
  rows,
  defaultExpanded,
}: {
  title: string;
  rows: LineupRow[];
  defaultExpanded: boolean;
}) {
  const colors = useResolvedColors();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const starters = useMemo(() => rows.filter((r) => r.shirt_number <= 15), [rows]);
  const bench = useMemo(() => rows.filter((r) => r.shirt_number > 15), [rows]);
  const isEmpty = rows.length === 0;

  return (
    <View style={styles.accordionSection}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={styles.accordionHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${title}, ${expanded ? 'collapse' : 'expand'}`}
        hitSlop={HIT_SLOP}
      >
        <Text variant="bodyBold" color="text">{title}</Text>
        <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
          <Icon name="ChevronRight" size={20} color={colors.textMuted} />
        </View>
      </Pressable>
      {expanded && !isEmpty && (
        <View style={styles.accordionBody}>
          {starters.length > 0 && (
            <View style={styles.lineupBlock}>
              <Text variant="caption" color="textSecondary" style={styles.lineupBlockTitle}>Starters</Text>
              {starters.map((row) => (
                <View key={`s-${row.shirt_number}`} style={styles.lineupRow}>
                  <Text variant="body" color="text" style={styles.shirtNumber}>{row.shirt_number}</Text>
                  <Text variant="body" color="text" numberOfLines={1} style={styles.playerName}>{row.player_name || '—'}</Text>
                  <Text variant="caption" color="textMuted">{row.position || ''}</Text>
                </View>
              ))}
            </View>
          )}
          {bench.length > 0 && (
            <View style={styles.lineupBlock}>
              <Text variant="caption" color="textSecondary" style={styles.lineupBlockTitle}>Bench</Text>
              {bench.map((row) => (
                <View key={`b-${row.shirt_number}`} style={styles.lineupRow}>
                  <Text variant="body" color="text" style={styles.shirtNumber}>{row.shirt_number}</Text>
                  <Text variant="body" color="text" numberOfLines={1} style={styles.playerName}>{row.player_name || '—'}</Text>
                  <Text variant="caption" color="textMuted">{row.position || ''}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
      {expanded && isEmpty && (
        <Text variant="caption" color="textMuted" style={styles.accordionEmpty}>No lineup published</Text>
      )}
    </View>
  );
}

type TabId = 'timeline' | 'lineups' | 'table';

export default function MatchCentreScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useResolvedColors();
  const { matchCentre, loading, error, refetch } = useMatchCentre(id);
  const { events, connectionStatus } = useMatchEvents(matchCentre?.match_id ?? undefined, { onUpdate: refetch });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    pollRef.current = setInterval(() => refetch(), LIVE_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [refetch]);
  const { profile } = useAuth();
  const isClubAdmin = profile?.role === 'club_admin';
  const clubId = profile?.club_id ?? null;
  const canBuildHome = isClubAdmin && !!clubId && matchCentre?.home_club_id === clubId;
  const canBuildAway = isClubAdmin && !!clubId && matchCentre?.away_club_id === clubId;
  const { rows: homeLineupRows, loading: homeLineupLoading } = useMatchLineups(
    matchCentre?.match_id ?? undefined,
    matchCentre?.home_team_id ?? undefined,
    { publishedOnly: true }
  );
  const { rows: awayLineupRows, loading: awayLineupLoading } = useMatchLineups(
    matchCentre?.match_id ?? undefined,
    matchCentre?.away_team_id ?? undefined,
    { publishedOnly: true }
  );

  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const handleSubmitDispute = useCallback(async () => {
    if (!matchCentre?.match_id || !profile?.id) return;
    setDisputeSubmitting(true);
    try {
      const { submitMatchDispute } = await import('../../../../services/disputes');
      const { error: err } = await submitMatchDispute(matchCentre.match_id, profile.id, disputeReason);
      if (err) throw err;
      setDisputeReason('');
      Alert.alert('Submitted', 'Your dispute has been submitted. We’ll review it.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to submit dispute');
    } finally {
      setDisputeSubmitting(false);
    }
  }, [matchCentre?.match_id, profile?.id, disputeReason]);

  const hasMatchId = !!matchCentre?.match_id;
  const lineupsLoading = homeLineupLoading || awayLineupLoading;
  const hasPublishedLineups = homeLineupRows.length > 0 || awayLineupRows.length > 0;
  const tableDataExists = false; // useMatchCentre does not expose table/standings

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader
          leftSlot={
            <GlassHeaderButton accessibilityLabel="Go back" onPress={() => router.back()}>
              <Icon name="ArrowBack" size={24} color={colors.text} />
            </GlassHeaderButton>
          }
          titleSlot={<Text variant="bodyBold" color="text">Match</Text>}
        />
        <View style={styles.loadingContent}>
          <Skeleton variant="block" width={320} height={200} style={styles.heroSkeleton} />
          <Skeleton variant="line" style={styles.tabSkeleton} />
          <Skeleton variant="line" style={styles.tabSkeleton} />
        </View>
      </View>
    );
  }

  if (error && !matchCentre) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader
          leftSlot={
            <GlassHeaderButton accessibilityLabel="Go back" onPress={() => router.back()}>
              <Icon name="ArrowBack" size={24} color={colors.text} />
            </GlassHeaderButton>
          }
          titleSlot={<Text variant="bodyBold" color="text">Match</Text>}
        />
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

  if (!matchCentre) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader
          leftSlot={
            <GlassHeaderButton accessibilityLabel="Go back" onPress={() => router.back()}>
              <Icon name="ArrowBack" size={24} color={colors.text} />
            </GlassHeaderButton>
          }
          titleSlot={<Text variant="bodyBold" color="text">Match</Text>}
        />
        <View style={styles.errorContent}>
          <EmptyState
            title="Match unavailable"
            description="We couldn't load this match right now."
            primaryAction={{ label: 'Retry', onPress: refetch }}
            secondaryAction={{ label: 'Back', onPress: () => router.back() }}
            mode="error"
          />
        </View>
      </View>
    );
  }

  const m = matchCentre;
  const statusLabel = m.status === 'live' ? 'LIVE' : m.status === 'full_time' ? 'FT' : `KO ${formatKoTime(m.scheduled_at)}`;
  const statusVariant = m.status === 'live' ? 'live' : m.status === 'full_time' ? 'ft' : 'scheduled';

  const tabs: { id: TabId; label: string }[] = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'lineups', label: 'Lineups' },
    { id: 'table', label: 'Table' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader
        leftSlot={
          <GlassHeaderButton accessibilityLabel="Go back" onPress={() => router.back()}>
            <Icon name="ArrowBack" size={24} color={colors.text} />
          </GlassHeaderButton>
        }
        titleSlot={<Text variant="bodyBold" color="text">Match</Text>}
        rightSlot={
          <View style={styles.headerActions}>
            <View style={styles.favWrap}>
              <FavouriteButton entityType="fixture" entityId={m.fixture_id} size={22} />
            </View>
            <GlassHeaderButton accessibilityLabel="Share match" onPress={() => {}}>
              <Icon name="Users" size={22} color={colors.text} />
            </GlassHeaderButton>
            <GlassHeaderButton accessibilityLabel="Notifications" onPress={() => {}}>
              <Icon name="Bell" size={22} color={colors.text} />
            </GlassHeaderButton>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <Pressable
            style={[styles.inlineError, { backgroundColor: colors.error }]}
            onPress={refetch}
            accessibilityRole="button"
            accessibilityLabel="Live updates paused. Tap to retry."
          >
            <Text variant="caption" color="primaryContrast">Live updates paused. Tap to retry.</Text>
          </Pressable>
        ) : null}
        {/* Hero scoreboard */}
        <GlassCard variant="card" style={styles.heroCard}>
          <View style={styles.heroTeamsRow}>
            <View style={styles.heroTeamBlock}>
              <View style={styles.crestPlaceholder} />
              <Text variant="h3" color="text" style={styles.heroTeamName} numberOfLines={1}>
                {teamLabel(m.home_team_name)}
              </Text>
            </View>
            <Text variant="h1" color="text" style={styles.heroScore}>
              {m.score_home} – {m.score_away}
            </Text>
            <View style={styles.heroTeamBlock}>
              <View style={styles.crestPlaceholder} />
              <Text variant="h3" color="text" style={styles.heroTeamName} numberOfLines={1}>
                {teamLabel(m.away_team_name)}
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <Badge label={statusLabel} variant={statusVariant} />
          </View>
          {(m.venue_name || m.venue_address) && (
            <View style={styles.venueRow}>
            <Icon name="MapPin" size={16} color={colors.textSecondary} />
            <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.venueText}>
              {m.venue_name ?? ''}{m.venue_address ? ` · ${m.venue_address}` : ''}
            </Text>
          </View>
          )}
          <View style={styles.competitionRow}>
            <Badge label="Match" variant="neutral" />
          </View>
        </GlassCard>

        {/* Tabs */}
        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.tab, activeTab === tab.id && [styles.tabActive, { borderBottomColor: colors.primary }]]}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === tab.id }}
              accessibilityLabel={tab.label}
              hitSlop={HIT_SLOP}
            >
              <Text
                variant="bodyBold"
                color={activeTab === tab.id ? 'primary' : 'textSecondary'}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'timeline' && (
          <View style={styles.tabPanel}>
            {!hasMatchId ? (
              <EmptyState
                title="No events yet"
                description="Events appear when the match is live. Check back soon."
                primaryAction={{ label: 'Refresh', onPress: refetch }}
              />
            ) : events.length === 0 ? (
              <EmptyState
                title="No events yet"
                description="Check back soon for live updates."
                primaryAction={{ label: 'Refresh', onPress: refetch }}
              />
            ) : (
              <GlassCard variant="card" style={styles.eventsCard}>
                <FlatList
                  data={events}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => <TimelineEventRow ev={item} />}
                  ItemSeparatorComponent={() => <View style={styles.timelineDivider} />}
                />
              </GlassCard>
            )}
          </View>
        )}

        {activeTab === 'lineups' && (
          <View style={styles.tabPanel}>
            {!hasMatchId ? (
              <EmptyState
                title="Lineups not available"
                description="Team sheets appear once the match is created."
                primaryAction={{ label: 'Refresh', onPress: refetch }}
              />
            ) : lineupsLoading ? (
              <View style={styles.lineupLoading}>
                <Skeleton variant="line" style={styles.upcomingSkeleton} />
                <Skeleton variant="line" style={styles.upcomingSkeleton} />
                <Skeleton variant="line" style={styles.upcomingSkeleton} />
              </View>
            ) : !hasPublishedLineups ? (
              <EmptyState
                title="No lineups published"
                description="Team sheets will appear here when published."
                primaryAction={{ label: 'Refresh', onPress: refetch }}
              />
            ) : (
              <View style={styles.accordionList}>
                <LineupAccordion title={teamLabel(m.home_team_name)} rows={homeLineupRows} defaultExpanded={true} />
                <LineupAccordion title={teamLabel(m.away_team_name)} rows={awayLineupRows} defaultExpanded={true} />
              </View>
            )}
            {(canBuildHome || canBuildAway) && m.match_id && (
              <View style={styles.buildRow}>
                {canBuildHome && (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: `/(tabs)/games/${id}/lineup`,
                        params: { teamId: m.home_team_id, teamName: toTeamDisplayString(m.home_team_name), matchId: m.match_id },
                      })
                    }
                    style={styles.buildBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Build team sheet for ${teamLabel(m.home_team_name)}`}
                  >
                    <Text variant="bodyBold" color="primaryContrast">Build — {teamLabel(m.home_team_name)}</Text>
                  </Pressable>
                )}
                {canBuildAway && (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: `/(tabs)/games/${id}/lineup`,
                        params: { teamId: m.away_team_id, teamName: toTeamDisplayString(m.away_team_name), matchId: m.match_id },
                      })
                    }
                    style={styles.buildBtn}
                    accessibilityRole="button"
                    accessibilityLabel={`Build team sheet for ${teamLabel(m.away_team_name)}`}
                  >
                    <Text variant="bodyBold" color="primaryContrast">Build — {teamLabel(m.away_team_name)}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

        {activeTab === 'table' && (
          <View style={styles.tabPanel}>
            {!tableDataExists ? (
              <EmptyState
                title="Table not available yet"
                description="Standings for this competition will appear here when available."
                primaryAction={{ label: 'Refresh', onPress: refetch }}
              />
            ) : (
              <GlassCard variant="card">
                <Text variant="body" color="textSecondary">Table content</Text>
              </GlassCard>
            )}
          </View>
        )}

        {/* Live status */}
        {hasMatchId && connectionStatus !== 'off' && (
          <Text variant="micro" color="textMuted" style={styles.liveStatus}>
            {connectionStatus === 'realtime' ? 'Live' : connectionStatus === 'polling' ? 'Updating every 10s' : 'Connecting…'}
          </Text>
        )}

        {/* Live console (club admin) */}
        {hasMatchId && m.match_id && (canBuildHome || canBuildAway) && (
          <Pressable
            onPress={() =>
              router.push({
                pathname: `/(tabs)/games/${id}/live`,
                params: {
                  matchId: m.match_id,
                  home_team_name: toTeamDisplayString(m.home_team_name),
                  away_team_name: toTeamDisplayString(m.away_team_name),
                  score_home: String(m.score_home),
                  score_away: String(m.score_away),
                },
              })
            }
            style={[styles.liveConsoleBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Open live console"
          >
            <Text variant="bodyBold" color="primaryContrast">Open live console</Text>
          </Pressable>
        )}

        {/* Dispute */}
        {hasMatchId && m.match_id && profile && (
          <View style={styles.disputeSection}>
            <Text variant="bodyBold" color="text" style={styles.disputeTitle}>Report a problem</Text>
            <Text variant="caption" color="textSecondary" style={styles.disputeHint}>
              Wrong score or result? Submit a dispute for review.
            </Text>
            <TextInput
              placeholder="Describe the issue (e.g. wrong score, incorrect result)"
              placeholderTextColor={colors.textMuted}
              value={disputeReason}
              onChangeText={setDisputeReason}
              multiline
              numberOfLines={3}
              style={[styles.disputeInput, { borderColor: colors.border, color: colors.text }]}
              editable={!disputeSubmitting}
            />
            <Pressable
              onPress={handleSubmitDispute}
              disabled={disputeSubmitting || !disputeReason.trim()}
              style={[
                styles.disputeSubmit,
                { backgroundColor: disputeReason.trim() && !disputeSubmitting ? colors.primary : colors.surfaceMuted },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Submit dispute"
            >
              {disputeSubmitting ? (
                <Text variant="body" color="textMuted">Submitting…</Text>
              ) : (
                <Text variant="bodyBold" color="primaryContrast">Submit dispute</Text>
              )}
            </Pressable>
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
  scrollContent: { paddingBottom: tokens.spacing.xxl },
  loadingContent: { padding: tokens.spacing.lg },
  heroSkeleton: { marginBottom: tokens.spacing.lg },
  tabSkeleton: { marginBottom: tokens.spacing.sm, height: 32 },
  errorContent: { flex: 1, padding: tokens.spacing.xl, justifyContent: 'center' },
  inlineError: { padding: tokens.spacing.md, marginHorizontal: tokens.spacing.lg, marginTop: tokens.spacing.sm, borderRadius: tokens.radius.md },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  favWrap: { minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, justifyContent: 'center' },
  heroCard: { marginHorizontal: tokens.spacing.lg, marginTop: tokens.spacing.md },
  heroTeamsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroTeamBlock: { flex: 1, alignItems: 'center', minWidth: 0 },
  crestPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: tokens.spacing.xs },
  heroTeamName: { textAlign: 'center', marginVertical: tokens.spacing.xs },
  heroScore: { marginHorizontal: tokens.spacing.md },
  statusRow: { marginTop: tokens.spacing.md, alignItems: 'center' },
  venueRow: { flexDirection: 'row', alignItems: 'center', marginTop: tokens.spacing.sm, gap: tokens.spacing.xs },
  venueText: { flex: 1 },
  competitionRow: { marginTop: tokens.spacing.sm },
  tabBar: { flexDirection: 'row', marginTop: tokens.spacing.xl, paddingHorizontal: tokens.spacing.lg, gap: tokens.spacing.xs },
  tab: { paddingVertical: tokens.spacing.sm, paddingHorizontal: tokens.spacing.md, minHeight: MIN_TOUCH, justifyContent: 'center' },
  tabActive: { borderBottomWidth: 2 },
  tabPanel: { paddingHorizontal: tokens.spacing.lg, marginTop: tokens.spacing.lg },
  eventsCard: { padding: tokens.spacing.md },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, minHeight: MIN_TOUCH },
  timelineMinute: { minWidth: 32 },
  timelineLabel: { flex: 1 },
  timelineDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: tokens.spacing.xs },
  accordionList: { gap: tokens.spacing.md },
  accordionSection: { marginBottom: tokens.spacing.sm },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: tokens.spacing.md, paddingHorizontal: tokens.spacing.lg, minHeight: MIN_TOUCH, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: tokens.radius.md },
  accordionBody: { paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.md },
  accordionEmpty: { paddingHorizontal: tokens.spacing.lg, paddingBottom: tokens.spacing.sm },
  lineupBlock: { marginTop: tokens.spacing.sm },
  lineupBlockTitle: { marginBottom: tokens.spacing.xs },
  lineupRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md, paddingVertical: tokens.spacing.xs },
  shirtNumber: { width: 28, fontWeight: '600' },
  playerName: { flex: 1 },
  lineupLoading: { gap: tokens.spacing.sm },
  upcomingSkeleton: { marginBottom: tokens.spacing.sm },
  buildRow: { flexDirection: 'row', gap: tokens.spacing.sm, marginTop: tokens.spacing.lg, flexWrap: 'wrap' },
  buildBtn: { paddingVertical: tokens.spacing.md, paddingHorizontal: tokens.spacing.lg, borderRadius: tokens.radius.md },
  liveStatus: { textAlign: 'center', marginTop: tokens.spacing.md },
  liveConsoleBtn: { marginHorizontal: tokens.spacing.lg, marginTop: tokens.spacing.lg, paddingVertical: tokens.spacing.md, borderRadius: tokens.radius.md, alignItems: 'center' },
  disputeSection: { marginHorizontal: tokens.spacing.lg, marginTop: tokens.spacing.xxl },
  disputeTitle: { marginBottom: tokens.spacing.xs },
  disputeHint: { marginBottom: tokens.spacing.sm },
  disputeInput: { minHeight: 80, borderWidth: 1, borderRadius: tokens.radius.md, padding: tokens.spacing.md, marginBottom: tokens.spacing.sm, textAlignVertical: 'top' },
  disputeSubmit: { paddingVertical: tokens.spacing.md, borderRadius: tokens.radius.md, alignItems: 'center' },
  footer: { height: tokens.spacing.xxl },
});
