/**
 * League tables modal for Games tab. Shows standings for competitions
 * present in the current fixture list. Tap a competition to expand its table.
 * Glass-style bottom sheet matching app design language.
 * File: features/games/LeagueTablesModal.tsx
 */
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Table, type TableColumn } from '../../components/Table';
import { useSeasons } from '../competitions/useSeasons';
import { useStandingsWithForm } from '../competitions/useStandingsWithForm';
import { tokens } from '../../lib/theme';
import {
  EmptyState,
  GlassCard,
  Icon,
  Skeleton,
  Text,
  useResolvedColors,
} from '../../lib/ui';
import type { LeagueTableRow } from '../../types/competitions';

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

type CompetitionStub = {
  id: string;
  name: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  competitions: CompetitionStub[];
};

const TABLE_COLUMNS: TableColumn<LeagueTableRow>[] = [
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
];

function CompetitionTable({ competition }: { competition: CompetitionStub }) {
  const colors = useResolvedColors();
  const [expanded, setExpanded] = useState(false);
  const { seasons, loading: seasonsLoading } = useSeasons(expanded ? competition.id : undefined);
  const latestSeasonId = seasons[0]?.id;
  const { rows, loading: standingsLoading, error } = useStandingsWithForm(latestSeasonId);
  const loading = seasonsLoading || standingsLoading;

  return (
    <GlassCard variant="card" style={styles.tableCard}>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.tableHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${competition.name} league table`}
        hitSlop={HIT_SLOP}
      >
        <Text variant="bodyBold" color="text" numberOfLines={1} style={styles.tableName}>
          {competition.name}
        </Text>
        <Icon
          name="ChevronRight"
          size={18}
          color={colors.textMuted}
          style={expanded ? styles.chevronDown : undefined}
        />
      </Pressable>

      {expanded && (
        <View style={styles.tableBody}>
          {loading && rows.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Skeleton variant="line" style={styles.skeletonLine} />
              <Skeleton variant="block" width={280} height={80} style={styles.skeletonBlock} />
            </View>
          ) : error ? (
            <Text variant="caption" color="error" style={styles.errorText}>{error}</Text>
          ) : rows.length === 0 ? (
            <Text variant="caption" color="textMuted" style={styles.emptyText}>
              No standings available for this competition.
            </Text>
          ) : (
            <Table<LeagueTableRow>
              columns={TABLE_COLUMNS}
              data={rows}
              keyExtractor={(row) => row.id}
            />
          )}
        </View>
      )}
    </GlassCard>
  );
}

export function LeagueTablesModal({ visible, onClose, competitions }: Props) {
  const colors = useResolvedColors();
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + tokens.spacing.lg,
              maxHeight: '85%',
            },
          ]}
        >
          <View style={styles.header}>
            <Text variant="bodyBold" color="text">League Tables</Text>
            <Pressable
              onPress={onClose}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Icon name="Close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {competitions.length === 0 ? (
              <View style={styles.emptyWrap}>
                <EmptyState
                  title="No competitions"
                  description="No league data available for the current fixtures."
                  primaryAction={{ label: 'Close', onPress: onClose }}
                />
              </View>
            ) : (
              competitions.map((c) => (
                <CompetitionTable key={c.id} competition={c} />
              ))
            )}
          </ScrollView>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: tokens.radius.xl,
    borderTopRightRadius: tokens.radius.xl,
    paddingTop: tokens.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.lg,
  },
  tableCard: {
    marginBottom: tokens.spacing.md,
    padding: 0,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    minHeight: 44,
  },
  tableName: {
    flex: 1,
    marginRight: tokens.spacing.sm,
  },
  chevronDown: {
    transform: [{ rotate: '90deg' }],
  },
  tableBody: {
    paddingBottom: tokens.spacing.sm,
  },
  loadingWrap: {
    padding: tokens.spacing.md,
  },
  skeletonLine: {
    marginBottom: tokens.spacing.sm,
  },
  skeletonBlock: {
    marginTop: tokens.spacing.xs,
  },
  errorText: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  emptyText: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  emptyWrap: {
    padding: tokens.spacing.xl,
  },
});
