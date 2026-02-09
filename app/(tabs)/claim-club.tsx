import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import { useAuth } from '../../features/auth/AuthContext';

type ClubRow = { id: string; name: string; slug: string };
type PendingClaimRow = { id: string; club_id: string; status: string; created_at: string };

/**
 * Club claim screen (club_admin only). Select a club and attach to profile (users.club_id).
 * File: app/(tabs)/claim-club.tsx — route /claim-club.
 */
export default function ClaimClubScreen() {
  const router = useRouter();
  const { profile, refreshProfile, session } = useAuth();

  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingClaim, setPendingClaim] = useState<PendingClaimRow | null>(null);
  const [selectedClub, setSelectedClub] = useState<ClubRow | null>(null);

  const fetchClubs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('clubs')
        .select('id, name, slug')
        .order('name', { ascending: true })
        .limit(300);
      if (err) throw err;
      setClubs((data ?? []) as ClubRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load clubs');
      setClubs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClubs();
  }, [fetchClubs]);

  const fetchPendingClaim = useCallback(async () => {
    if (!profile?.id) {
      setPendingClaim(null);
      return;
    }
    const { data, error: err } = await (supabase.from('pending_claims') as any)
      .select('id, club_id, status, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (err) {
      setPendingClaim(null);
      return;
    }
    setPendingClaim((data?.[0] as PendingClaimRow) ?? null);
  }, [profile?.id]);

  useEffect(() => {
    fetchPendingClaim();
  }, [fetchPendingClaim]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clubs;
    return clubs.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q));
  }, [clubs, query]);
  const currentClub = useMemo(
    () => clubs.find((c) => c.id === profile?.club_id) ?? null,
    [clubs, profile?.club_id]
  );
  const selectedIsCurrent = !!selectedClub?.id && selectedClub.id === profile?.club_id;

  const allowedDomains = useMemo(() => {
    return (process.env.EXPO_PUBLIC_CLAIM_CLUB_ALLOWLIST ?? '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }, []);
  const emailDomain = useMemo(() => {
    const email = session?.user?.email ?? '';
    return email.split('@')[1]?.toLowerCase() ?? '';
  }, [session?.user?.email]);
  const isAutoApproved = useMemo(
    () => !!emailDomain && allowedDomains.includes(emailDomain),
    [allowedDomains, emailDomain]
  );

  const handleClaim = useCallback(async () => {
    if (!profile?.id || !selectedClub) return;
    setSubmitting(true);
    setError(null);
    try {
      const updatePayload: { club_id: string; role?: 'club_admin' } = { club_id: selectedClub.id };
      if (isAutoApproved) updatePayload.role = 'club_admin';
      const { error: updateErr } = await (supabase.from('users') as any)
        .update(updatePayload)
        .eq('id', profile.id);
      if (updateErr) throw updateErr;
      if (!isAutoApproved) {
        const { error: claimErr } = await (supabase.from('pending_claims') as any).upsert({
          user_id: profile.id,
          club_id: selectedClub.id,
          status: 'pending',
          requester_email: session?.user?.email ?? null,
        });
        if (claimErr) throw claimErr;
      }
      await refreshProfile();
      await fetchPendingClaim();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  }, [profile?.id, selectedClub, isAutoApproved, refreshProfile, fetchPendingClaim, router, session?.user?.email]);

  const handleClear = useCallback(async () => {
    if (!profile?.id) return;
    setSubmitting(true);
    const { error: err } = await (supabase.from('users') as any)
      .update({ club_id: null })
      .eq('id', profile.id);
    if (err) {
      setError(err.message);
    } else {
      await (supabase.from('pending_claims') as any).delete().eq('user_id', profile.id);
      await refreshProfile();
      await fetchPendingClaim();
    }
    setSubmitting(false);
  }, [profile?.id, refreshProfile, fetchPendingClaim]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
      <Text style={{ ...theme.typography.sectionTitle, marginBottom: 8 }}>Claim your club</Text>
      <Text style={{ ...theme.typography.caption, marginBottom: 16 }}>
        Choose the club you manage. This links your account to its teams for team sheet and live console access.
      </Text>
      {pendingClaim?.status === 'pending' ? (
        <View style={{ marginBottom: 16, padding: 12, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md }}>
          <Text style={{ ...theme.typography.caption, marginBottom: 4 }}>Claim request pending</Text>
          <Text style={theme.typography.bodyStrong}>
            {clubs.find((c) => c.id === pendingClaim.club_id)?.name ?? pendingClaim.club_id}
          </Text>
        </View>
      ) : null}

      {profile?.club_id ? (
        <View style={{ marginBottom: 16 }}>
          <Text style={{ ...theme.typography.caption, marginBottom: 6 }}>Current claim</Text>
          <Text style={{ ...theme.typography.bodyStrong, marginBottom: 8 }}>
            {currentClub?.name ?? profile.club_id}
          </Text>
          <TouchableOpacity
            onPress={handleClear}
            disabled={submitting}
            style={{ padding: 10, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md }}
          >
            <Text style={{ color: theme.colors.textSecondary }}>Clear claim</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search clubs…"
        placeholderTextColor={theme.colors.textMuted}
        style={{
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          marginBottom: theme.spacing.md,
          color: theme.colors.text,
        }}
      />

      {loading ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <Text style={{ color: theme.colors.error, marginBottom: 12 }}>{error}</Text>
      ) : selectedClub ? (
        <View style={{ ...theme.card, padding: 16 }}>
          <Text style={{ ...theme.typography.caption, marginBottom: 8 }}>Confirm claim</Text>
          <Text style={{ ...theme.typography.bodyStrong, marginBottom: 4 }}>{selectedClub.name}</Text>
          <Text style={{ ...theme.typography.caption, marginBottom: 16 }}>{selectedClub.slug}</Text>
          <Text style={{ ...theme.typography.caption, marginBottom: 16 }}>
            {isAutoApproved
              ? 'Your email domain matches our allowlist, so you will get club admin access immediately.'
              : 'We will review this request. You will not have club admin access until approved.'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => setSelectedClub(null)}
              disabled={submitting}
              style={{ flex: 1, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md }}
            >
              <Text style={{ color: theme.colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClaim}
              disabled={submitting || selectedIsCurrent}
              style={{
                flex: 1,
                padding: 12,
                alignItems: 'center',
                backgroundColor: selectedIsCurrent ? theme.colors.borderLight : theme.colors.text,
                borderRadius: theme.radius.md,
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: selectedIsCurrent ? theme.colors.textSecondary : '#fff' }}>
                  {selectedIsCurrent ? 'Already claimed' : 'Confirm claim'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={{ ...theme.card, padding: 0 }}>
          {filtered.length === 0 ? (
            <View style={{ padding: 16 }}>
              <Text style={{ color: theme.colors.textSecondary }}>No clubs found</Text>
            </View>
          ) : (
            filtered.map((club) => (
              <TouchableOpacity
                key={club.id}
                onPress={() => setSelectedClub(club)}
                disabled={submitting}
                style={{
                  paddingVertical: theme.spacing.md,
                  paddingHorizontal: theme.spacing.lg,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.borderLight,
                }}
              >
                <Text style={theme.typography.bodyStrong}>{club.name}</Text>
                <Text style={{ ...theme.typography.caption, marginTop: 2 }}>{club.slug}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}
