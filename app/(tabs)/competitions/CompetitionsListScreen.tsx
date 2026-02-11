/**
 * Competitions tab. Premium glass UI. Data from useCompetitions only.
 * Search pill: local in-memory filter. Categories as GlassCards, row with chevron → competition detail.
 */
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  TextInput,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  Pressable,
} from 'react-native';
import { useCompetitions } from '../../../features/competitions/useCompetitions';
import {
  COMPETITION_CATEGORIES,
  groupCompetitionsByCategory,
  type CategoryId,
} from '../../../lib/competitionCategories';
import { getCompetitionDisplayName } from '../../../lib/competitionOverrides';
import { deriveCompetitionTypeFromName } from '../../../lib/competitionType';
import { tokens } from '../../../lib/theme';
import {
  EmptyState,
  GlassCard,
  GlassHeader,
  Icon,
  Skeleton,
  Text,
  useResolvedColors,
} from '../../../lib/ui';
import type { Competition } from '../../../types/competitions';

const MIN_TOUCH = 44;
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const HEADER_OFFSET = tokens.spacing.xxl + tokens.spacing.lg; // space for absolute GlassHeader

function competitionTypeLabel(c: Competition): string {
  return deriveCompetitionTypeFromName(c.name ?? '');
}

type Section = { categoryId: CategoryId; title: string; list: Competition[] };

const CompetitionRow = React.memo(function CompetitionRow({
  competition,
  displayName,
  typeLabel,
  chevronColor,
  onPress,
}: {
  competition: Competition;
  displayName: string;
  typeLabel: string;
  chevronColor: string;
  onPress: () => void;
}) {
  const label = `${displayName}, ${typeLabel}. Open competition.`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={HIT_SLOP}
    >
      <View style={styles.rowContent}>
        <Text variant="bodyBold" color="text" numberOfLines={1}>{displayName}</Text>
        <Text variant="caption" color="textSecondary" numberOfLines={1}>
          {competition.source === 'allwalessport'
            ? (typeLabel ? `External · ${typeLabel}` : 'External')
            : competition.source === 'sixnations'
              ? (typeLabel ? `Six Nations · ${typeLabel}` : 'Six Nations')
              : (typeLabel || '—')}
        </Text>
      </View>
      <Icon name="ChevronRight" size={20} color={chevronColor} />
    </Pressable>
  );
});

function CompetitionsListView({
  orderedSections,
  searchQuery,
  onSearchChange,
  onRefresh,
  refreshing,
  navigateToCompetition,
  displayName,
  colors,
}: {
  orderedSections: Section[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  navigateToCompetition: (id: string) => void;
  displayName: (c: Competition) => string;
  colors: ReturnType<typeof useResolvedColors>;
}) {
  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={styles.searchWrap}>
        <View style={[styles.searchPill, { backgroundColor: colors.surface }]}>
          <Icon name="Search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Filter competitions…"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            accessibilityLabel="Filter competitions"
            accessibilityRole="search"
          />
        </View>
      </View>
      {orderedSections.length === 0 ? (
        <View style={styles.emptyFilterWrap}>
          <EmptyState
            title="No matches"
            description={searchQuery.trim() ? 'Try a different search term.' : 'No competitions in this list.'}
            primaryAction={{ label: 'Clear search', onPress: () => onSearchChange('') }}
          />
        </View>
      ) : (
        orderedSections.map(({ categoryId, title, list }) => (
          <View key={categoryId} style={styles.section}>
            <Text variant="bodyBold" color="textSecondary" style={styles.sectionTitle}>{title}</Text>
            <GlassCard variant="card" style={styles.card}>
              {list.map((c) => (
                <CompetitionRow
                  key={c.id}
                  competition={c}
                  displayName={displayName(c)}
                  typeLabel={competitionTypeLabel(c)}
                  chevronColor={colors.textMuted}
                  onPress={() => navigateToCompetition(c.id)}
                />
              ))}
            </GlassCard>
          </View>
        ))
      )}
    </ScrollView>
  );
}

/**
 * Competitions list. Tap competition → league table + form view.
 * Hooks: useRouter, useCompetitions, useState (refreshing), useState (searchQuery).
 */
export default function CompetitionsListScreen() {
  const router = useRouter();
  const colors = useResolvedColors();
  const { competitions, loading, error, refetch } = useCompetitions();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCompetitions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return competitions;
    return competitions.filter(
      (c) =>
        (c.name?.toLowerCase().includes(q)) ||
        (c.slug?.toLowerCase().includes(q))
    );
  }, [competitions, searchQuery]);

  const byCategory = groupCompetitionsByCategory(filteredCompetitions);
  const orderedSections: Section[] = [];
  for (const cat of COMPETITION_CATEGORIES) {
    const list = byCategory.get(cat.id);
    if (list && list.length > 0) {
      orderedSections.push({ categoryId: cat.id, title: cat.title, list });
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const displayName = (c: Competition) =>
    getCompetitionDisplayName(c.source ?? null, c.source_ref ?? null, c.name ?? '', c.slug);

  if (loading && !refreshing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader titleSlot={<Text variant="bodyBold" color="text">Competitions</Text>} />
        <View style={styles.loadingContent}>
          <Skeleton variant="line" style={styles.lineSkeleton} />
          <Skeleton variant="line" style={styles.lineSkeleton} />
          <Skeleton variant="block" width={280} height={80} style={styles.blockSkeleton} />
          <Skeleton variant="block" width={280} height={80} style={styles.blockSkeleton} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader titleSlot={<Text variant="bodyBold" color="text">Competitions</Text>} />
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

  if (competitions.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <GlassHeader titleSlot={<Text variant="bodyBold" color="text">Competitions</Text>} />
        <View style={styles.errorContent}>
          <EmptyState
            title="No competitions"
            description="Competitions will appear here when available."
            primaryAction={{ label: 'Retry', onPress: refetch }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader titleSlot={<Text variant="bodyBold" color="text">Competitions</Text>} />
      <CompetitionsListView
        orderedSections={orderedSections}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={onRefresh}
        refreshing={refreshing}
        navigateToCompetition={(id) => router.push(`/(tabs)/competitions/${id}`)}
        displayName={displayName}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: HEADER_OFFSET, paddingBottom: tokens.spacing.xxl },
  loadingContent: { padding: tokens.spacing.lg },
  lineSkeleton: { marginBottom: tokens.spacing.sm },
  blockSkeleton: { marginTop: tokens.spacing.md },
  errorContent: { flex: 1, padding: tokens.spacing.xl, justifyContent: 'center' },
  searchWrap: { paddingHorizontal: tokens.spacing.lg, paddingTop: 0, paddingBottom: tokens.spacing.md },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.full,
    gap: tokens.spacing.sm,
    minHeight: MIN_TOUCH,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  emptyFilterWrap: { padding: tokens.spacing.xl },
  section: { marginBottom: tokens.spacing.xl, paddingHorizontal: tokens.spacing.lg },
  sectionTitle: { marginBottom: tokens.spacing.sm, paddingHorizontal: tokens.spacing.xs },
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
  rowContent: { flex: 1, minWidth: 0, marginRight: tokens.spacing.sm },
  rowPressed: { opacity: 0.9 },
});
