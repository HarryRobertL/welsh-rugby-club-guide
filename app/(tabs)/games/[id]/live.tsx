import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { useRoleGate } from '../../../../features/auth/useRoleGate';
import { useMatchCentre } from '../../../../features/games/useMatchCentre';
import { useMatchEvents } from '../../../../features/live/useMatchEvents';
import { addLiveEvent, setMatchFullTime, undoLastEvent } from '../../../../services/live-events';
import { sendMatchNotification } from '../../../../services/send-match-notifications';
import type { LiveEventType, LiveEventPayload, TeamSide } from '../../../../types/live-events';
import { EVENT_POINTS } from '../../../../types/live-events';

const EVENT_BUTTONS: { type: LiveEventType; label: string }[] = [
  { type: 'try', label: 'Try' },
  { type: 'conversion', label: 'Conversion' },
  { type: 'penalty_goal', label: 'Penalty' },
  { type: 'yellow_card', label: 'Yellow card' },
  { type: 'red_card', label: 'Red card' },
  { type: 'other', label: 'Substitution' },
];

/**
 * Admin-only live console: event entry (try, conversion, penalty, card, substitution), auto score, undo.
 * Prepared for realtime subscription via useMatchEvents.
 */
export default function LiveConsoleScreen() {
  const { id: fixtureId, matchId, home_team_name, away_team_name } = useLocalSearchParams<{
    id: string;
    matchId: string;
    home_team_name: string;
    away_team_name: string;
    score_home?: string;
    score_away?: string;
  }>();
  useRoleGate(['club_admin'], '/(tabs)/games');
  const { profile } = useAuth();

  const { matchCentre, loading: matchLoading, error: matchError, refetch: refetchMatch } = useMatchCentre(fixtureId);
  const { events, loading, refetch: refetchEvents, connectionStatus } = useMatchEvents(matchId, {
    onUpdate: refetchMatch,
  });

  const [teamSide, setTeamSide] = useState<TeamSide>('home');
  const [minute, setMinute] = useState('');
  const [busy, setBusy] = useState(false);

  const scoreHome = matchCentre?.score_home ?? 0;
  const scoreAway = matchCentre?.score_away ?? 0;

  const handleAddEvent = useCallback(
    async (eventType: LiveEventType) => {
      if (!matchId || !fixtureId) return;
      setBusy(true);
      const payload: LiveEventPayload = {
        team_side: teamSide,
        minute: minute ? parseInt(minute, 10) : undefined,
      };
      try {
        const { error } = await addLiveEvent(matchId, eventType, payload, profile?.id ?? '');
        if (error) throw error;
        await refetchMatch();
        await refetchEvents();
        const points = EVENT_POINTS[eventType] ?? 0;
        if (points > 0) {
          const newHome = scoreHome + (teamSide === 'home' ? points : 0);
          const newAway = scoreAway + (teamSide === 'away' ? points : 0);
          await sendMatchNotification({
            event: 'score_change',
            fixture_id: fixtureId,
            match_id: matchId,
            score_home: newHome,
            score_away: newAway,
            home_team_name: home_team_name ?? undefined,
            away_team_name: away_team_name ?? undefined,
          });
        }
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add event');
      } finally {
        setBusy(false);
      }
    },
    [matchId, fixtureId, teamSide, minute, scoreHome, scoreAway, home_team_name, away_team_name, profile?.id, refetchMatch, refetchEvents]
  );

  const handleUndo = useCallback(async () => {
    if (!matchId) return;
    setBusy(true);
    try {
      const { error } = await undoLastEvent(matchId, profile?.id ?? '');
      if (error) throw error;
      await refetchMatch();
      await refetchEvents();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to undo');
    } finally {
      setBusy(false);
    }
  }, [matchId, profile?.id, refetchMatch, refetchEvents]);

  const handleEndMatch = useCallback(async () => {
    if (!matchId || !fixtureId) return;
    setBusy(true);
    try {
      const { error } = await setMatchFullTime(matchId, profile?.id ?? '');
      if (error) throw error;
      await refetchMatch();
      await sendMatchNotification({
        event: 'full_time',
        fixture_id: fixtureId,
        match_id: matchId,
        score_home: scoreHome,
        score_away: scoreAway,
        home_team_name: home_team_name ?? undefined,
        away_team_name: away_team_name ?? undefined,
      });
      Alert.alert('Match ended', 'Full time.');
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to end match');
    } finally {
      setBusy(false);
    }
  }, [matchId, fixtureId, scoreHome, scoreAway, home_team_name, away_team_name, profile?.id, refetchMatch]);

  if (!matchId) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#666' }}>Missing match</Text>
      </View>
    );
  }

  const clubId = profile?.club_id ?? null;
  const clubAllowed =
    profile?.role === 'club_admin' &&
    !!clubId &&
    !!matchCentre &&
    (matchCentre.home_club_id === clubId || matchCentre.away_club_id === clubId);

  if (matchLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Checking club permissions…</Text>
      </View>
    );
  }

  if (matchError || !clubAllowed) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#666', textAlign: 'center', marginBottom: 12 }}>
          {matchError ?? 'You can only run the live console for your own club.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {/* Score */}
      <View style={{ alignItems: 'center', marginBottom: 24, paddingVertical: 16, backgroundColor: '#f0f0f0', borderRadius: 8 }}>
        <Text style={{ fontWeight: '600' }}>{home_team_name ?? 'Home'}</Text>
        <Text style={{ fontSize: 28, fontWeight: '700' }}>{scoreHome} – {scoreAway}</Text>
        <Text style={{ fontWeight: '600' }}>{away_team_name ?? 'Away'}</Text>
      </View>

      {/* Team side + minute */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Team</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setTeamSide('home')}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                backgroundColor: teamSide === 'home' ? '#333' : '#eee',
              }}
            >
              <Text style={{ color: teamSide === 'home' ? '#fff' : '#333', fontWeight: '600' }}>Home</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTeamSide('away')}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 8,
                backgroundColor: teamSide === 'away' ? '#333' : '#eee',
              }}
            >
              <Text style={{ color: teamSide === 'away' ? '#fff' : '#333', fontWeight: '600' }}>Away</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ width: 80 }}>
          <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Min</Text>
          <TextInput
            placeholder="0"
            value={minute}
            onChangeText={setMinute}
            keyboardType="number-pad"
            style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
          />
        </View>
      </View>

      {/* Event buttons */}
      <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Add event</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {EVENT_BUTTONS.map(({ type, label }) => (
          <TouchableOpacity
            key={type}
            onPress={() => handleAddEvent(type)}
            disabled={busy}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 14,
              backgroundColor: '#ddd',
              borderRadius: 8,
            }}
          >
            <Text style={{ fontWeight: '600' }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Undo */}
      <TouchableOpacity
        onPress={handleUndo}
        disabled={busy || events.length === 0}
        style={{
          padding: 14,
          backgroundColor: events.length === 0 ? '#eee' : '#c00',
          borderRadius: 8,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: events.length === 0 ? '#999' : '#fff', fontWeight: '600' }}>
            Undo last event
          </Text>
        )}
      </TouchableOpacity>

      {/* End match (full time) */}
      <TouchableOpacity
        onPress={handleEndMatch}
        disabled={busy}
        style={{
          padding: 14,
          backgroundColor: busy ? '#ccc' : '#333',
          borderRadius: 8,
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>End match (full time)</Text>
      </TouchableOpacity>

      {/* Timeline (events list) */}
      <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8 }}>Timeline</Text>
      {loading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} />
      ) : events.length === 0 ? (
        <View style={{ padding: 24, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
          <Text style={{ color: '#666', textAlign: 'center' }}>No events yet</Text>
        </View>
      ) : (
        <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 8, overflow: 'hidden' }}>
          {[...events].reverse().map((ev) => (
            <View
              key={ev.id}
              style={{
                flexDirection: 'row',
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#eee',
              }}
            >
              <Text style={{ width: 36, fontWeight: '600' }}>{ev.minute ?? '—'}′</Text>
              <Text style={{ flex: 1 }}>{ev.event_type}</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>
                {(ev.payload as LiveEventPayload)?.team_side === 'home' ? 'H' : 'A'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
