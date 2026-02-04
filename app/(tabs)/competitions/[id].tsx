import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FavouriteButton } from '../../../components/FavouriteButton';
import { Table, type TableColumn } from '../../../components/Table';
import { useSeasons } from '../../../features/competitions/useSeasons';
import { useStandingsWithForm } from '../../../features/competitions/useStandingsWithForm';
import type { LeagueTableRow } from '../../../types/competitions';

/**
 * Competition detail: season selector + league table (standings) sorted by position + team form (last 5).
 * File: app/(tabs)/competitions/[id].tsx — route /competitions/:id.
 */
export default function CompetitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { seasons, loading: seasonsLoading, error: seasonsError } = useSeasons(id);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const effectiveSeasonId = selectedSeasonId ?? seasons[0]?.id;
  const { rows, loading: standingsLoading, error: standingsError, refetch } = useStandingsWithForm(effectiveSeasonId);

  const loading = seasonsLoading || standingsLoading;
  const error = seasonsError ?? standingsError;

  const tableColumns = useMemo<TableColumn<LeagueTableRow>[]>(
    () => [
      { key: 'position', label: '#', width: 32 },
      { key: 'team_name', label: 'Team', width: 140 },
      { key: 'played', label: 'P', width: 28 },
      { key: 'won', label: 'W', width: 28 },
      { key: 'drawn', label: 'D', width: 28 },
      { key: 'lost', label: 'L', width: 28 },
      { key: 'points_for', label: 'PF', width: 36 },
      { key: 'points_against', label: 'PA', width: 36 },
      { key: 'points', label: 'Pts', width: 40 },
      { key: 'form', label: 'Form', width: 100 },
    ],
    []
  );

  if (seasonsLoading && seasons.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading…</Text>
      </View>
    );
  }

  if (seasonsError && seasons.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#c00', textAlign: 'center' }}>{seasonsError}</Text>
      </View>
    );
  }

  if (seasons.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#666' }}>No seasons for this competition</Text>
      </View>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Competition favourite */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 12 }}>
        <FavouriteButton entityType="competition" entityId={id} size={22} />
      </View>
      {/* Season selector */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8 }}>Season</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {seasons.map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => setSelectedSeasonId(s.id)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: effectiveSeasonId === s.id ? '#333' : '#f0f0f0',
                }}
              >
                <Text style={{ color: effectiveSeasonId === s.id ? '#fff' : '#333', fontWeight: '500' }}>
                  {s.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {loading && rows.length === 0 ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 8 }}>Loading table…</Text>
        </View>
      ) : error ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: '#c00', marginBottom: 12 }}>{error}</Text>
          <TouchableOpacity onPress={refetch} style={{ padding: 12, backgroundColor: '#eee' }}>
            <Text>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ color: '#666' }}>No standings for this season</Text>
        </View>
      ) : (
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8 }}>League table</Text>
          <Table<LeagueTableRow>
            columns={tableColumns}
            data={rows}
            keyExtractor={(row) => row.id}
          />
        </View>
      )}
    </ScrollView>
  );
}
