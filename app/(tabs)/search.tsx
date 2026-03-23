/**
 * Search tab. Premium glass UI. Uses useSearch only. Grouped: Teams, Competitions.
 * Competition → competition detail; Team → favourite only (no team screen in app).
 */
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Pressable,
} from 'react-native';
import { FavouriteButton } from '../../components/FavouriteButton';
import { useSearch, type SearchCompetition, type SearchTeam } from '../../features/search/useSearch';
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
const HEADER_OFFSET = tokens.spacing.xxl + tokens.spacing.lg; // space for absolute GlassHeader

export default function SearchScreen() {
  const router = useRouter();
  const colors = useResolvedColors();
  const [query, setQuery] = useState('');
  const { competitions, teams, loading, error, refetch } = useSearch(query);

  const hasQuery = query.trim().length >= 2;
  const hasResults = competitions.length > 0 || teams.length > 0;
  const showEmpty = hasQuery && !loading && !hasResults;
  const showError = !!error && hasQuery;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader titleSlot={<Text variant="bodyBold" color="text">Search</Text>} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.searchPillWrap, { backgroundColor: colors.surface }]}>
          <Icon name="Search" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search leagues or teams…"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search leagues or teams"
            accessibilityRole="search"
          />
        </View>

        {query.trim().length > 0 && query.trim().length < 2 && (
          <Text variant="caption" color="textSecondary" style={styles.hint}>
            Type at least 2 characters to search.
          </Text>
        )}

        {loading && hasQuery && (
          <View style={styles.loadingWrap}>
            <Skeleton variant="line" style={styles.skeletonLine} />
            <Skeleton variant="line" style={styles.skeletonLine} />
            <Skeleton variant="block" width={280} height={56} style={styles.skeletonBlock} />
            <Skeleton variant="block" width={280} height={56} style={styles.skeletonBlock} />
          </View>
        )}

        {showError && (
          <View style={styles.errorWrap}>
            <EmptyState
              title="Search failed"
              description={error ?? 'Something went wrong.'}
              primaryAction={{ label: 'Try again', onPress: refetch }}
              mode="error"
            />
          </View>
        )}

        {showEmpty && !showError && (
          <View style={styles.emptyWrap}>
            <EmptyState
              title="No results"
              description={`No leagues or teams found for "${query.trim()}".`}
              primaryAction={{ label: 'Clear search', onPress: () => setQuery('') }}
            />
          </View>
        )}

        {hasQuery && !loading && !showError && hasResults && (
          <View style={styles.sections}>
            {competitions.length > 0 && (
              <View style={styles.section}>
                <Text variant="bodyBold" color="textSecondary" style={styles.sectionTitle}>Competitions</Text>
                <GlassCard variant="card" style={styles.card}>
                  {competitions.map((c: SearchCompetition) => (
                    <Pressable
                      key={c.id}
                      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                      onPress={() => router.push(`/(tabs)/competitions/${c.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.name}. Open competition.`}
                      hitSlop={HIT_SLOP}
                    >
                      <Text variant="bodyBold" color="text" numberOfLines={1} style={styles.rowTitle}>{c.name}</Text>
                      <FavouriteButton entityType="competition" entityId={c.id} size={20} />
                    </Pressable>
                  ))}
                </GlassCard>
              </View>
            )}
            {teams.length > 0 && (
              <View style={styles.section}>
                <Text variant="bodyBold" color="textSecondary" style={styles.sectionTitle}>Teams</Text>
                <GlassCard variant="card" style={styles.card}>
                  {teams.map((t: SearchTeam) => (
                    <View key={t.id} style={styles.row}>
                      <Text variant="bodyBold" color="text" numberOfLines={1} style={styles.rowTitle}>{t.name}</Text>
                      <FavouriteButton entityType="team" entityId={t.id} size={20} />
                    </View>
                  ))}
                </GlassCard>
              </View>
            )}
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
  searchPillWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: tokens.spacing.lg,
    marginTop: 0,
    marginBottom: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.full,
    gap: tokens.spacing.sm,
    minHeight: MIN_TOUCH,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 4 },
  hint: { marginHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.md },
  loadingWrap: { padding: tokens.spacing.lg },
  skeletonLine: { marginBottom: tokens.spacing.sm },
  skeletonBlock: { marginTop: tokens.spacing.md },
  errorWrap: { padding: tokens.spacing.xl },
  emptyWrap: { padding: tokens.spacing.xl },
  sections: { paddingHorizontal: tokens.spacing.lg },
  section: { marginBottom: tokens.spacing.xl },
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
  rowPressed: { opacity: 0.9 },
  footer: { height: tokens.spacing.xxl },
});
