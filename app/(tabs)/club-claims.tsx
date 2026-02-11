import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import { useAuth } from '../../features/auth/AuthContext';

type PendingClaimRow = {
  id: string;
  club_id: string;
  status: string;
  created_at: string;
  requester_email: string | null;
  clubs: { name: string; slug: string } | { name: string; slug: string }[] | null;
  user_id: string;
};

/**
 * Club claim approvals (league_admin only).
 * File: app/(tabs)/club-claims.tsx — route /club-claims.
 */
export default function ClubClaimsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [claims, setClaims] = useState<PendingClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isLeagueAdmin = profile?.role === 'league_admin';

  const normalizeClub = useCallback((club: PendingClaimRow['clubs']) => {
    if (Array.isArray(club)) return club[0] ?? null;
    return club ?? null;
  }, []);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await (supabase.from('pending_claims') as any)
        .select('id, club_id, status, created_at, requester_email, user_id, clubs(name, slug)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (err) throw err;
      setClaims((data ?? []) as PendingClaimRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load claims');
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleApprove = useCallback(
    async (claim: PendingClaimRow) => {
      if (!profile?.id) return;
      setBusyId(claim.id);
      try {
        const { error: userErr } = await (supabase.from('users') as any)
          .update({ role: 'club_admin', club_id: claim.club_id })
          .eq('id', claim.user_id);
        if (userErr) throw userErr;
        const { error: claimErr } = await (supabase.from('pending_claims') as any)
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: profile.id,
          })
          .eq('id', claim.id);
        if (claimErr) throw claimErr;
        await fetchClaims();
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to approve claim');
      } finally {
        setBusyId(null);
      }
    },
    [fetchClaims, profile?.id]
  );

  const handleReject = useCallback(
    async (claim: PendingClaimRow) => {
      if (!profile?.id) return;
      setBusyId(claim.id);
      try {
        const { error: userErr } = await (supabase.from('users') as any)
          .update({ club_id: null })
          .eq('id', claim.user_id);
        if (userErr) throw userErr;
        const { error: claimErr } = await (supabase.from('pending_claims') as any)
          .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reviewed_by: profile.id,
          })
          .eq('id', claim.id);
        if (claimErr) throw claimErr;
        await fetchClaims();
      } catch (e) {
        Alert.alert('Error', e instanceof Error ? e.message : 'Failed to reject claim');
      } finally {
        setBusyId(null);
      }
    },
    [fetchClaims, profile?.id]
  );

  const headerLabel = useMemo(() => (claims.length === 1 ? '1 pending request' : `${claims.length} pending requests`), [claims.length]);

  if (!isLeagueAdmin) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#666', textAlign: 'center', marginBottom: 12 }}>
          You do not have access to review club claims.
        </Text>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/account')} style={{ padding: 12, backgroundColor: '#eee' }}>
          <Text>Back to account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ ...theme.typography.sectionTitle, marginBottom: 8 }}>Club claims</Text>
      <Text style={{ ...theme.typography.caption, marginBottom: 16 }}>
        Review pending club admin requests.
      </Text>

      <View style={{ marginBottom: 12 }}>
        <Text style={{ ...theme.typography.caption }}>{headerLabel}</Text>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <Text style={{ color: theme.colors.error, marginBottom: 12 }}>{error}</Text>
      ) : claims.length === 0 ? (
        <View style={{ padding: 16, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border }}>
          <Text style={{ color: theme.colors.textSecondary }}>No pending requests.</Text>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {claims.map((claim) => {
            const club = normalizeClub(claim.clubs);
            const busy = busyId === claim.id;
            return (
              <View key={claim.id} style={{ ...theme.card }}>
                <Text style={{ ...theme.typography.bodyStrong, marginBottom: 4 }}>{club?.name ?? claim.club_id}</Text>
                <Text style={{ ...theme.typography.caption, marginBottom: 8 }}>{club?.slug ?? '—'}</Text>
                <Text style={{ ...theme.typography.caption, marginBottom: 4 }}>
                  Requester: {claim.requester_email ?? 'Unknown'}
                </Text>
                <Text style={{ ...theme.typography.caption, marginBottom: 12 }}>
                  Requested: {new Date(claim.created_at).toLocaleString('en-GB')}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => handleReject(claim)}
                    disabled={busy}
                    style={{ flex: 1, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md }}
                  >
                    <Text style={{ color: theme.colors.textSecondary }}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleApprove(claim)}
                    disabled={busy}
                    style={{ flex: 1, padding: 10, alignItems: 'center', backgroundColor: theme.colors.text, borderRadius: theme.radius.md }}
                  >
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff' }}>Approve</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
