import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { FavouriteButton } from '../../components/FavouriteButton';
import { useHomeData } from '../../features/home/useHomeData';
import type { LiveMatch, UpcomingFixture } from '../../types/home';

function formatFixtureDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (isToday) return `Today ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LiveMatchRow({ m }: { m: LiveMatch }) {
  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
      <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Live</Text>
      <Text style={{ fontWeight: '600' }} numberOfLines={1}>
        {m.home_team_name} v {m.away_team_name}
      </Text>
      <Text style={{ fontSize: 24, fontWeight: '700', marginTop: 4 }}>
        {m.score_home} – {m.score_away}
      </Text>
      {m.venue_name ? <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{m.venue_name}</Text> : null}
    </View>
  );
}

function UpcomingFixtureRow({ f }: { f: UpcomingFixture }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{formatFixtureDate(f.scheduled_at)}</Text>
        <Text style={{ fontWeight: '600' }} numberOfLines={1}>
          {f.home_team_name} v {f.away_team_name}
        </Text>
        {f.venue_name ? <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{f.venue_name}</Text> : null}
      </View>
      <FavouriteButton entityType="fixture" entityId={f.id} size={20} />
    </View>
  );
}

/**
 * Home tab. Favourites-driven: live matches, upcoming fixtures for favourited teams; fallback if no favourites.
 * File: app/(tabs)/index.tsx — default tab route (/).
 */
export default function HomeScreen() {
  const {
    favouriteTeamIds,
    favouriteFixtureIds,
    upcomingFixtures,
    liveMatches,
    loading,
    error,
    refetch,
  } = useHomeData();

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
        <Text style={{ marginTop: 12 }}>Loading…</Text>
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

  const hasFavourites = favouriteTeamIds.length > 0 || favouriteFixtureIds.length > 0;
  const hasLive = liveMatches.length > 0;
  const hasUpcoming = upcomingFixtures.length > 0;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Live matches */}
      <View style={{ marginTop: 16, marginHorizontal: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Live</Text>
        {hasLive ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' }}>
            {liveMatches.map((m) => (
              <LiveMatchRow key={m.id} m={m} />
            ))}
          </View>
        ) : (
          <View style={{ padding: 24, backgroundColor: '#f8f8f8', borderRadius: 8 }}>
            <Text style={{ color: '#666', textAlign: 'center' }}>No live matches</Text>
          </View>
        )}
      </View>

      {/* Upcoming fixtures (for your teams) */}
      <View style={{ marginTop: 24, marginHorizontal: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
          {hasFavourites ? 'Upcoming (your teams & saved fixtures)' : 'Upcoming'}
        </Text>
        {!hasFavourites ? (
          <View style={{ padding: 24, backgroundColor: '#f8f8f8', borderRadius: 8 }}>
            <Text style={{ color: '#666', textAlign: 'center', marginBottom: 8 }}>
              Add favourite teams or save fixtures to see them here.
            </Text>
            <Text style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>Use Search to find teams; use ♡ on fixtures to save them.</Text>
          </View>
        ) : hasUpcoming ? (
          <View style={{ backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#eee' }}>
            {upcomingFixtures.map((f) => (
              <UpcomingFixtureRow key={f.id} f={f} />
            ))}
          </View>
        ) : (
          <View style={{ padding: 24, backgroundColor: '#f8f8f8', borderRadius: 8 }}>
            <Text style={{ color: '#666', textAlign: 'center' }}>No upcoming fixtures for your teams or saved fixtures</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
