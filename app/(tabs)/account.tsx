/**
 * Account tab. Premium glass UI. Profile card, settings in GlassCard.
 * Theme from ThemeProvider; notifications; claim club; debug; sign out. No clear cache (no app cache).
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  Pressable,
} from 'react-native';
import { useAuth } from '../../features/auth/AuthContext';
import { updateNotificationPreferences } from '../../services/notification-preferences';
import { tokens } from '../../lib/theme';
import {
  GlassCard,
  GlassHeader,
  Icon,
  Text,
  useResolvedColors,
  useTheme,
} from '../../lib/ui';
import type { UserRole } from '../../types/database';
import type { NotificationPreferences } from '../../types/notifications';

const ROLE_LABEL: Record<UserRole, string> = {
  supporter: 'Supporter',
  club_admin: 'Club admin',
  referee: 'Ref',
  league_admin: 'League admin',
};

const MIN_TOUCH = 44;
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
const HEADER_OFFSET = tokens.spacing.xxl + tokens.spacing.lg; // space for absolute GlassHeader

export default function AccountScreen() {
  const { session, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const colors = useResolvedColors();
  const { mode, setMode } = useTheme();
  const [updating, setUpdating] = useState(false);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/(auth)/sign-in');
  }, [signOut, router]);

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GlassHeader titleSlot={<Text variant="bodyBold" color="text">Account</Text>} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <GlassCard variant="card" style={styles.profileCard}>
          <View style={styles.profileRow}>
            <Icon name="Person" size={24} color={colors.primary} />
            <View style={styles.profileText}>
              <Text variant="caption" color="textSecondary">Email</Text>
              <Text variant="bodyBold" color="text" numberOfLines={1}>{email}</Text>
            </View>
          </View>
          <View style={styles.profileRow}>
            <Icon name="Shield" size={24} color={colors.textMuted} />
            <View style={styles.profileText}>
              <Text variant="caption" color="textSecondary">Role</Text>
              <Text variant="bodyBold" color="text">{roleLabel}</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard variant="card" style={styles.settingsCard}>
          <Text variant="bodyBold" color="text" style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.settingRow}>
            <Text variant="body" color="text" style={styles.settingLabel}>Theme</Text>
            <View style={styles.themeRow}>
              {(['system', 'light', 'dark'] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[styles.themeChip, mode === m && { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === m }}
                  accessibilityLabel={m === 'system' ? 'System' : m === 'light' ? 'Light' : 'Dark'}
                  hitSlop={HIT_SLOP}
                >
                  <Text variant="caption" color={mode === m ? 'primaryContrast' : 'textSecondary'}>
                    {m === 'system' ? 'System' : m === 'light' ? 'Light' : 'Dark'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Text variant="bodyBold" color="text" style={[styles.sectionTitle, styles.sectionTitleTop]}>Notifications</Text>
          <Text variant="caption" color="textSecondary" style={styles.sectionDesc}>
            Choose when to receive push notifications for favourited matches.
          </Text>
          <View style={styles.switchRow}>
            <Text variant="body" color="text" style={styles.settingLabel}>Lineup published</Text>
            <Switch
              value={profile?.notify_lineup_published ?? true}
              onValueChange={(v) => handlePrefChange('notify_lineup_published', v)}
              disabled={updating}
              accessibilityLabel="Lineup published notifications"
            />
          </View>
          <View style={styles.switchRow}>
            <Text variant="body" color="text" style={styles.settingLabel}>Score change</Text>
            <Switch
              value={profile?.notify_score_change ?? true}
              onValueChange={(v) => handlePrefChange('notify_score_change', v)}
              disabled={updating}
              accessibilityLabel="Score change notifications"
            />
          </View>
          <View style={styles.switchRow}>
            <Text variant="body" color="text" style={styles.settingLabel}>Full time</Text>
            <Switch
              value={profile?.notify_full_time ?? true}
              onValueChange={(v) => handlePrefChange('notify_full_time', v)}
              disabled={updating}
              accessibilityLabel="Full time notifications"
            />
          </View>
          <Text variant="caption" color="textMuted" style={styles.quietHours}>Quiet hours — coming soon.</Text>
        </GlassCard>

        <GlassCard variant="card" style={styles.actionsCard}>
          <Pressable
            onPress={() => router.push('/(tabs)/claim-club')}
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={profile?.club_id ? 'Manage club claim' : 'Claim club'}
            hitSlop={HIT_SLOP}
          >
            <Text variant="body" color="text">{profile?.club_id ? 'Manage club claim' : 'Claim club'}</Text>
            <Icon name="ChevronRight" size={20} color={colors.textMuted} />
          </Pressable>
          {profile?.role === 'league_admin' ? (
            <Pressable
              onPress={() => router.push('/(tabs)/club-claims')}
              style={({ pressed }) => [styles.actionRow, styles.actionRowBorder, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Review club claims"
              hitSlop={HIT_SLOP}
            >
              <Text variant="body" color="text">Review club claims</Text>
              <Icon name="ChevronRight" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push('/(tabs)/debug')}
            style={({ pressed }) => [styles.actionRow, styles.actionRowBorder, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Debug – competitions and mapping"
            hitSlop={HIT_SLOP}
          >
            <Text variant="body" color="text">Debug (dev)</Text>
            <Icon name="ChevronRight" size={20} color={colors.textMuted} />
          </Pressable>
        </GlassCard>

        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [styles.signOutBtn, { backgroundColor: colors.surface }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          hitSlop={HIT_SLOP}
        >
          <Text variant="bodyBold" color="text">Sign out</Text>
        </Pressable>
        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: HEADER_OFFSET, paddingBottom: tokens.spacing.xxl },
  profileCard: { marginHorizontal: tokens.spacing.lg, marginTop: 0, marginBottom: tokens.spacing.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: tokens.spacing.sm, gap: tokens.spacing.md },
  profileText: { flex: 1, minWidth: 0 },
  settingsCard: { marginHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.lg, padding: tokens.spacing.lg },
  sectionTitle: { marginBottom: tokens.spacing.xs },
  sectionTitleTop: { marginTop: tokens.spacing.md },
  sectionDesc: { marginBottom: tokens.spacing.sm },
  settingRow: { marginBottom: tokens.spacing.sm },
  settingLabel: { flex: 1 },
  themeRow: { flexDirection: 'row', gap: tokens.spacing.sm, flexWrap: 'wrap', marginTop: tokens.spacing.xs },
  themeChip: {
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.full,
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.sm,
    minHeight: MIN_TOUCH,
  },
  quietHours: { marginTop: tokens.spacing.sm, fontStyle: 'italic' },
  actionsCard: { marginHorizontal: tokens.spacing.lg, marginBottom: tokens.spacing.lg, padding: 0, overflow: 'hidden' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    minHeight: MIN_TOUCH,
  },
  actionRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.glass.stroke.subtle },
  signOutBtn: {
    marginHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.9 },
  footer: { height: tokens.spacing.xxl },
});
