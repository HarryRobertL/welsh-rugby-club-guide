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
import { useCompetitions } from '../../../features/competitions/useCompetitions';

/**
 * Competitions list. Tap competition → league table + form view.
 * File: app/(tabs)/competitions/index.tsx — route /competitions.
 */
export default function CompetitionsListScreen() {
  const router = useRouter();
  const { competitions, loading, error, refetch } = useCompetitions();
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
        <Text style={{ marginTop: 12 }}>Loading competitions…</Text>
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

  if (competitions.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#666', textAlign: 'center' }}>No competitions</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {competitions.map((c) => (
        <TouchableOpacity
          key={c.id}
          onPress={() => router.push(`/(tabs)/competitions/${c.id}`)}
          style={{ paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}
          activeOpacity={0.7}
        >
          <Text style={{ fontWeight: '600', fontSize: 16 }}>{c.name}</Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{c.competition_type}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
