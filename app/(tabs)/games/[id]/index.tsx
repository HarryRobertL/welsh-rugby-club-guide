import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { FavouriteButton } from '../../../../components/FavouriteButton';
import { useMatchCentre } from '../../../../features/games/useMatchCentre';
import { useMatchEvents } from '../../../../features/live/useMatchEvents';
import { useMyTeams } from '../../../../features/lineup/useMyTeams';
import { useAuth } from '../../../../features/auth/AuthContext';
import { submitMatchDispute } from '../../../../services/disputes';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(status: string): string {
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

/**
 * Match centre. Score, status, timeline placeholder, team sheets (with club admin build link), venue info.
 */
export default function MatchCentreScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { matchCentre, loading, error, refetch } = useMatchCentre(id);
  const { events, connectionStatus } = useMatchEvents(matchCentre?.match_id ?? undefined, {
    onUpdate: refetch,
  });
  const { profile, hasRole } = useAuth();
  const { teams: myTeams } = useMyTeams();
  const myTeamIds = new Set(myTeams.map((t) => t.id));
  const isClubAdmin = hasRole('club_admin');
  const canBuildHome = isClubAdmin && matchCentre && myTeamIds.has(matchCentre.home_team_id);
  const canBuildAway = isClubAdmin && matchCentre && myTeamIds.has(matchCentre.away_team_id);

  const [disputeReason, setDisputeReason] = useState('');
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const handleSubmitDispute = useCallback(async () => {
    if (!matchCentre?.match_id || !profile?.id) return;
    setDisputeSubmitting(true);
    try {
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading match…</Text>
      </View>
    );
  }

  if (error || !matchCentre) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#c00', textAlign: 'center', marginBottom: 12 }}>
          {error ?? 'Match not found'}
        </Text>
        <TouchableOpacity onPress={refetch} style={{ padding: 12, backgroundColor: '#eee' }}>
          <Text>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const m = matchCentre;
  const hasMatchId = !!m.match_id;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      {/* Score & status + favourite */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 24 }}>
        <View style={{ flex: 1, alignItems: 'center', paddingVertical: 16, backgroundColor: '#f8f8f8', borderRadius: 8 }}>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>{statusLabel(m.status)}</Text>
          <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{formatDate(m.scheduled_at)}</Text>
          <Text style={{ fontWeight: '600', fontSize: 16, marginBottom: 4 }}>{m.home_team_name}</Text>
          <Text style={{ fontSize: 28, fontWeight: '700' }}>
            {m.score_home} – {m.score_away}
          </Text>
          <Text style={{ fontWeight: '600', fontSize: 16, marginTop: 4 }}>{m.away_team_name}</Text>
        </View>
        <View style={{ position: 'absolute', top: 16, right: 16 }}>
          <FavouriteButton entityType="fixture" entityId={m.fixture_id} size={24} />
        </View>
      </View>

      {/* Live status when match has started */}
      {hasMatchId && (
        <View style={{ marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#666' }}>
            {connectionStatus === 'realtime'
              ? 'Live'
              : connectionStatus === 'polling'
                ? 'Updating every 10s'
                : connectionStatus === 'connecting'
                  ? 'Connecting…'
                  : null}
          </Text>
        </View>
      )}

      {/* Venue info */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Venue</Text>
        <View style={{ padding: 12, backgroundColor: '#f8f8f8', borderRadius: 8 }}>
          <Text style={{ fontWeight: '600' }}>{m.venue_name ?? '—'}</Text>
          {m.venue_address ? (
            <Text style={{ fontSize: 14, color: '#666', marginTop: 4 }}>{m.venue_address}</Text>
          ) : null}
        </View>
      </View>

      {/* Timeline (live from match_events) */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Timeline</Text>
        {!hasMatchId ? (
          <View style={{ padding: 24, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: '#666' }}>Events appear when match is live</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={{ padding: 24, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: '#666' }}>No events yet</Text>
          </View>
        ) : (
          <View style={{ padding: 12, backgroundColor: '#f8f8f8', borderRadius: 8, gap: 8 }}>
            {events.map((ev) => (
              <View key={ev.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 12, color: '#666', minWidth: 32 }}>
                  {ev.minute != null ? `${ev.minute}'` : '—'}
                </Text>
                <Text style={{ fontWeight: '600', textTransform: 'capitalize' }}>{ev.event_type.replace('_', ' ')}</Text>
                {ev.payload?.team_side ? (
                  <Text style={{ fontSize: 14, color: '#666' }}>({ev.payload.team_side})</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Team sheets: view / build (club admin) */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Team sheets</Text>
        {!hasMatchId ? (
          <View style={{ padding: 24, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: '#666' }}>Team sheet available once match is created</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {canBuildHome && m.match_id && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: `/(tabs)/games/${id}/lineup`,
                    params: { teamId: m.home_team_id, teamName: m.home_team_name, matchId: m.match_id },
                  })
                }
                style={{ padding: 14, backgroundColor: '#eee', borderRadius: 8 }}
              >
                <Text style={{ fontWeight: '600' }}>Build team sheet — {m.home_team_name}</Text>
              </TouchableOpacity>
            )}
            {canBuildAway && m.match_id && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: `/(tabs)/games/${id}/lineup`,
                    params: { teamId: m.away_team_id, teamName: m.away_team_name, matchId: m.match_id },
                  })
                }
                style={{ padding: 14, backgroundColor: '#eee', borderRadius: 8 }}
              >
                <Text style={{ fontWeight: '600' }}>Build team sheet — {m.away_team_name}</Text>
              </TouchableOpacity>
            )}
            {!canBuildHome && !canBuildAway && (
              <View style={{ padding: 24, backgroundColor: '#f0f0f0', borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: '#666' }}>Team sheets placeholder</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Live console (club admin only) */}
      {hasMatchId && m.match_id && (canBuildHome || canBuildAway) && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Live console</Text>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: `/(tabs)/games/${id}/live`,
                params: {
                  matchId: m.match_id,
                  home_team_name: m.home_team_name,
                  away_team_name: m.away_team_name,
                  score_home: String(m.score_home),
                  score_away: String(m.score_away),
                },
              })
            }
            style={{ padding: 14, backgroundColor: '#333', borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Open live console</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dispute submission (authenticated; match has started) */}
      {hasMatchId && m.match_id && profile && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Report a problem</Text>
          <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
            Wrong score or result? Submit a dispute for review. No moderation logic yet.
          </Text>
          <TextInput
            placeholder="Describe the issue (e.g. wrong score, incorrect result)"
            value={disputeReason}
            onChangeText={setDisputeReason}
            multiline
            numberOfLines={3}
            style={{
              borderWidth: 1,
              borderColor: '#ddd',
              borderRadius: 8,
              padding: 12,
              minHeight: 80,
              textAlignVertical: 'top',
              marginBottom: 8,
            }}
            editable={!disputeSubmitting}
          />
          <TouchableOpacity
            onPress={handleSubmitDispute}
            disabled={disputeSubmitting || !disputeReason.trim()}
            style={{
              padding: 14,
              backgroundColor: disputeReason.trim() && !disputeSubmitting ? '#333' : '#ccc',
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            {disputeSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '600' }}>Submit dispute</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
