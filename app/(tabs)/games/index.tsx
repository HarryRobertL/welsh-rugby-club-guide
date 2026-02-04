import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FavouriteButton } from '../../../components/FavouriteButton';
import { useFixturesList } from '../../../features/games/useFixturesList';
import type { FixtureListItem } from '../../../types/games';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: FixtureListItem['status']): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'live':
      return 'Live';
    case 'full_time':
      return 'Full time';
    case 'postponed':
      return 'Postponed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

function FixtureRow({
  item,
  onPress,
}: {
  item: FixtureListItem;
  onPress: () => void;
}) {
  const showScore = item.status === 'live' || item.status === 'full_time';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
      <TouchableOpacity onPress={onPress} style={{ flex: 1 }} activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{formatDate(item.scheduled_at)}</Text>
            <Text style={{ fontWeight: '600' }} numberOfLines={1}>
              {item.home_team_name} v {item.away_team_name}
            </Text>
            {item.venue_name ? (
              <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{item.venue_name}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
            <Text style={{ fontSize: 12, color: '#666' }}>{statusLabel(item.status)}</Text>
            {showScore && item.score_home != null && item.score_away != null && (
              <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 2 }}>
                {item.score_home} – {item.score_away}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <FavouriteButton entityType="fixture" entityId={item.id} size={20} />
    </View>
  );
}

/**
 * Fixtures list. Static fetch; tap row → match centre.
 * File: app/(tabs)/games/index.tsx — route /games.
 */
export default function FixturesListScreen() {
  const router = useRouter();
  const { fixtures, loading, error, refetch } = useFixturesList();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading fixtures…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#c00', textAlign: 'center', marginBottom: 12 }}>{error}</Text>
        <TouchableOpacity onPress={refetch} style={{ padding: 12, backgroundColor: '#eee' }}>
          <Text>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (fixtures.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#666', textAlign: 'center' }}>No fixtures</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={{ marginTop: 8 }}>
        {fixtures.map((item) => (
          <FixtureRow
            key={item.id}
            item={item}
            onPress={() => router.push(`/(tabs)/games/${item.id}`)}
          />
        ))}
      </View>
    </ScrollView>
  );
}
