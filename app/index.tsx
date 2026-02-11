import { router, Redirect } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '../features/auth/AuthContext';
import { GlassCard, Text, useResolvedColors } from '../lib/ui';
import { tokens } from '../lib/theme';

/**
 * Root landing route. If authenticated, redirect to tabs; otherwise show marketing/info entry page.
 * File: app/index.tsx — initial route (/).
 */
export default function Index() {
  const { session, loading } = useAuth();
  const colors = useResolvedColors();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={tokens.colors.dark.primary} />
      </View>
    );
  }
  if (session) return <Redirect href="/(tabs)" />;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Cymru Rugby"
          />
          <Text variant="body" color="textSecondary" style={styles.subtitle}>
            Live scores, fixtures, standings, and club tools in one place for Welsh rugby supporters.
          </Text>
        </View>

        <Image
          source={require('../assets/hero-image-wrcg.png')}
          style={styles.heroImage}
          resizeMode="contain"
          accessibilityLabel="Welsh rugby"
        />

        <GlassCard variant="panel" gradient style={styles.heroCard}>
          <Text variant="h3" color="text" style={styles.heroTitle}>
            Built for match day
          </Text>
          <Text variant="body" color="textSecondary" style={styles.heroBody}>
            Track live games, follow your favourite teams, and stay on top of competition tables with fast updates.
          </Text>
          <View style={styles.featureRow}>
            <Tag label="Live match centre" />
            <Tag label="Fixtures + results" />
            <Tag label="Club admin tools" />
          </View>
        </GlassCard>

        <View style={styles.ctaWrap}>
          <Pressable
            onPress={() => router.push('/(auth)/sign-in')}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            <Text variant="bodyBold" color="primaryContrast">Sign in</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.border },
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Create account"
          >
            <Text variant="bodyBold" color="text">Create account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text variant="caption" color="text">{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.dark.background,
  },
  content: {
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.xxl * 2,
    paddingBottom: tokens.spacing.xxl,
    gap: tokens.spacing.lg,
  },
  header: {
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  logo: {
    width: 180,
    height: 74,
  },
  subtitle: {
    textAlign: 'center',
    maxWidth: 540,
  },
  heroImage: {
    width: '100%',
    height: 160,
    borderRadius: tokens.radius.lg,
  },
  heroCard: {
    gap: tokens.spacing.md,
  },
  heroTitle: {
    marginBottom: tokens.spacing.xs,
  },
  heroBody: {
    marginBottom: tokens.spacing.xs,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  tag: {
    borderRadius: tokens.radius.full,
    borderWidth: 1,
    borderColor: tokens.glass.stroke.default,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ctaWrap: {
    gap: tokens.spacing.sm,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: tokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
