import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../features/auth/AuthContext';
import { updateNotificationPreferences } from '../../services/notification-preferences';
import type { UserRole } from '../../types/database';
import type { NotificationPreferences } from '../../types/notifications';

const ROLE_LABEL: Record<UserRole, string> = {
  supporter: 'Supporter',
  club_admin: 'Club admin',
  referee: 'Ref',
  league_admin: 'League admin',
};

/**
 * Account tab. Email, role, notification preferences (respect user prefs when sending push), sign out.
 * TODO: quiet hours — add quiet_hours_start, quiet_hours_end and timezone; skip sending in that window.
 * File: app/(tabs)/account.tsx — route /account.
 */
export default function AccountScreen() {
  const { session, profile, signOut, refreshProfile, hasRole } = useAuth();
  const router = useRouter();
  const [updating, setUpdating] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/sign-in');
  }

  const handlePrefChange = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      if (!profile?.id) return;
      setUpdating(true);
      const prefs = {
        notify_lineup_published: profile.notify_lineup_published,
        notify_score_change: profile.notify_score_change,
        notify_full_time: profile.notify_full_time,
        [key]: value,
      };
      const { error } = await updateNotificationPreferences(profile.id, prefs);
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        await refreshProfile();
      }
      setUpdating(false);
    },
    [profile, refreshProfile]
  );

  const email = session?.user?.email ?? '—';
  const roleLabel = profile?.role ? ROLE_LABEL[profile.role] : '—';

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
      <Text style={{ marginBottom: 4 }}>Email</Text>
      <Text style={{ marginBottom: 16 }}>{email}</Text>
      <Text style={{ marginBottom: 4 }}>Role</Text>
      <Text style={{ marginBottom: 24 }}>{roleLabel}</Text>
      {hasRole('club_admin') && (
        <Text style={{ marginBottom: 16, fontStyle: 'italic' }}>Claim club (role-gated)</Text>
      )}

      <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12 }}>Notifications</Text>
      <Text style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
        Choose when to receive push notifications for favourited matches.
      </Text>
      <View style={{ marginBottom: 24, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ flex: 1 }}>Lineup published</Text>
          <Switch
            value={profile?.notify_lineup_published ?? true}
            onValueChange={(v) => handlePrefChange('notify_lineup_published', v)}
            disabled={updating}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ flex: 1 }}>Score change</Text>
          <Switch
            value={profile?.notify_score_change ?? true}
            onValueChange={(v) => handlePrefChange('notify_score_change', v)}
            disabled={updating}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ flex: 1 }}>Full time</Text>
          <Switch
            value={profile?.notify_full_time ?? true}
            onValueChange={(v) => handlePrefChange('notify_full_time', v)}
            disabled={updating}
          />
        </View>
      </View>
      {/* TODO: quiet hours — add quiet_hours_start, quiet_hours_end (and timezone); skip sending when current time (in user TZ) is in that window */}
      <Text style={{ fontSize: 12, color: '#999', fontStyle: 'italic', marginBottom: 24 }}>
        Quiet hours (do not disturb) — coming soon.
      </Text>

      <TouchableOpacity
        onPress={handleSignOut}
        style={{ padding: 12, alignItems: 'center', backgroundColor: '#eee', borderRadius: 8 }}
      >
        <Text>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
