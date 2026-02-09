import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../../../features/auth/AuthContext';
import { useMatchLineups } from '../../../../features/lineup/useMatchLineups';
import { useRoleGate } from '../../../../features/auth/useRoleGate';
import { supabase } from '../../../../lib/supabase';
import { publishLineup } from '../../../../services/lineup';
import { sendMatchNotification } from '../../../../services/send-match-notifications';
import {
  BENCH_COUNT,
  LINEUP_SIZE,
  STARTERS_COUNT,
  type LineupRow,
} from '../../../../types/lineup';

const emptyRow = (shirt: number, sortOrder: number): LineupRow => ({
  shirt_number: shirt,
  position: '',
  player_name: '',
  sort_order: sortOrder,
});

/**
 * Team sheet builder. Club admin only. Starters 1–15, bench 16–23; assign shirt numbers and names; publish to match_lineups + emit lineup_published.
 */
export default function LineupBuilderScreen() {
  const { id: fixtureId, teamId, teamName, matchId } = useLocalSearchParams<{
    id: string;
    teamId: string;
    teamName: string;
    matchId: string;
  }>();
  const router = useRouter();
  const { profile } = useAuth();
  useRoleGate(['club_admin'], '/(tabs)/games');

  const { rows: existingRows, loading, error, refetch } = useMatchLineups(matchId, teamId);
  const [rows, setRows] = useState<LineupRow[]>(() =>
    Array.from({ length: LINEUP_SIZE }, (_, i) => emptyRow(i + 1, i))
  );
  const [publishing, setPublishing] = useState(false);
  const [clubCheckLoading, setClubCheckLoading] = useState(true);
  const [clubCheckError, setClubCheckError] = useState<string | null>(null);
  const [teamClubId, setTeamClubId] = useState<string | null>(null);

  useEffect(() => {
    if (existingRows.length > 0) {
      const byShirt = new Map(existingRows.map((r) => [r.shirt_number, r]));
      setRows(
        Array.from({ length: LINEUP_SIZE }, (_, i) => {
          const shirt = i + 1;
          const existing = byShirt.get(shirt);
          return existing ?? emptyRow(shirt, i);
        })
      );
    } else {
      setRows(Array.from({ length: LINEUP_SIZE }, (_, i) => emptyRow(i + 1, i)));
    }
  }, [existingRows]);

  useEffect(() => {
    if (!teamId) {
      setClubCheckLoading(false);
      setTeamClubId(null);
      return;
    }
    let active = true;
    setClubCheckLoading(true);
    setClubCheckError(null);
    supabase
      .from('teams')
      .select('club_id')
      .eq('id', teamId)
      .single()
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) {
          setClubCheckError(err.message);
          setTeamClubId(null);
          return;
        }
        setTeamClubId((data as { club_id: string } | null)?.club_id ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setClubCheckError(err instanceof Error ? err.message : 'Failed to load team');
        setTeamClubId(null);
      })
      .finally(() => {
        if (!active) return;
        setClubCheckLoading(false);
      });
    return () => {
      active = false;
    };
  }, [teamId]);

  const starters = useMemo(() => rows.slice(0, STARTERS_COUNT), [rows]);
  const bench = useMemo(() => rows.slice(STARTERS_COUNT, LINEUP_SIZE), [rows]);

  const updateRow = useCallback((index: number, field: 'position' | 'player_name', value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handlePublish = useCallback(async () => {
    if (!matchId || !teamId || !profile?.id || !fixtureId) return;
    setPublishing(true);
    try {
      const { error: err } = await publishLineup(matchId, teamId, rows, profile.id);
      if (err) throw err;
      await sendMatchNotification({
        event: 'lineup_published',
        fixture_id: fixtureId,
        match_id: matchId,
        team_name: teamName ?? undefined,
      });
      Alert.alert('Published', 'Team sheet published.');
      refetch();
      router.back();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to publish lineup.');
    } finally {
      setPublishing(false);
    }
  }, [matchId, teamId, profile?.id, rows, fixtureId, teamName, refetch, router]);

  if (!matchId || !teamId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#666' }}>Missing match or team</Text>
      </View>
    );
  }

  const clubAllowed =
    profile?.role === 'club_admin' &&
    !!profile.club_id &&
    !!teamClubId &&
    profile.club_id === teamClubId;

  if (clubCheckLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Checking club permissions…</Text>
      </View>
    );
  }

  if (clubCheckError || !clubAllowed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#666', textAlign: 'center', marginBottom: 12 }}>
          {clubCheckError ?? 'You can only manage lineups for your own club.'}
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 12, backgroundColor: '#eee' }}>
          <Text>Back to match</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading && existingRows.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading lineup…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#c00', marginBottom: 12 }}>{error}</Text>
        <TouchableOpacity onPress={refetch} style={{ padding: 12, backgroundColor: '#eee' }}>
          <Text>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>{teamName}</Text>

      <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Starters (1–15)</Text>
      <View style={{ marginBottom: 24 }}>
        {starters.map((row, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 8,
              gap: 8,
            }}
          >
            <Text style={{ width: 28, fontWeight: '600' }}>{row.shirt_number}</Text>
            <TextInput
              placeholder="Position"
              value={row.position}
              onChangeText={(v) => updateRow(i, 'position', v)}
              style={{ flex: 1, borderWidth: 1, padding: 8, minWidth: 0 }}
            />
            <TextInput
              placeholder="Player name"
              value={row.player_name}
              onChangeText={(v) => updateRow(i, 'player_name', v)}
              style={{ flex: 2, borderWidth: 1, padding: 8, minWidth: 0 }}
            />
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Bench (16–23)</Text>
      <View style={{ marginBottom: 24 }}>
        {bench.map((row, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 8,
              gap: 8,
            }}
          >
            <Text style={{ width: 28, fontWeight: '600' }}>{row.shirt_number}</Text>
            <TextInput
              placeholder="Position"
              value={row.position}
              onChangeText={(v) => updateRow(STARTERS_COUNT + i, 'position', v)}
              style={{ flex: 1, borderWidth: 1, padding: 8, minWidth: 0 }}
            />
            <TextInput
              placeholder="Player name"
              value={row.player_name}
              onChangeText={(v) => updateRow(STARTERS_COUNT + i, 'player_name', v)}
              style={{ flex: 2, borderWidth: 1, padding: 8, minWidth: 0 }}
            />
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={handlePublish}
        disabled={publishing}
        style={{
          padding: 14,
          backgroundColor: '#333',
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        {publishing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', fontWeight: '600' }}>Publish lineup</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
