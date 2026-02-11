/**
 * Design system playground: GlassCard, GlassHeader, Divider, Badge.
 * Dev-only route (href: null in tabs). Reach via Debug screen or direct URL.
 */
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Badge,
  Divider,
  GlassCard,
  GlassHeader,
  GlassHeaderButton,
  Icon,
  Text,
  ThemeProvider,
  useTheme,
} from '../../lib/ui';

function PlaygroundContent() {
  const { mode, setMode, resolvedColors } = useTheme();
  const router = useRouter();
  const [pressed, setPressed] = useState<string | null>(null);

  const cycleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark');
  }, [mode, setMode]);

  return (
    <View style={[styles.container, { backgroundColor: resolvedColors.background }]}>
      <GlassHeader
        leftSlot={
          <GlassHeaderButton
            accessibilityLabel="Go back"
            onPress={() => router.back()}
          >
            <Icon name="ArrowBack" size={24} color={resolvedColors.text} />
          </GlassHeaderButton>
        }
        titleSlot={
          <Text variant="bodyBold" color="text">
            Design system
          </Text>
        }
        rightSlot={
          <GlassHeaderButton
            accessibilityLabel={`Theme: ${mode}. Switch theme.`}
            onPress={cycleMode}
          >
            <Icon
              name={mode === 'dark' ? 'Moon' : mode === 'light' ? 'Sunny' : 'PhonePortrait'}
              size={22}
              color={resolvedColors.text}
            />
          </GlassHeaderButton>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        accessibilityLabel="Design system examples"
      >
        <Text variant="h2" color="text" style={styles.sectionTitle}>
          Theme
        </Text>
        <TouchableOpacity
          style={[styles.toggle, { backgroundColor: resolvedColors.surfaceMuted }]}
          onPress={cycleMode}
          accessibilityRole="button"
          accessibilityLabel={`Current theme: ${mode}. Tap to switch.`}
          accessibilityState={{ selected: true }}
        >
          <Text variant="body" color="text">
            Mode: {mode}
          </Text>
          <Text variant="caption" color="textSecondary">
            Tap to cycle dark → light → system
          </Text>
        </TouchableOpacity>

        <Text variant="h2" color="text" style={styles.sectionTitle}>
          GlassCard
        </Text>
        <GlassCard variant="card" style={styles.card}>
          <Text variant="bodyBold" color="text">
            Card variant
          </Text>
          <Text variant="caption" color="textSecondary">
            Default blur, token stroke and shadow.
          </Text>
        </GlassCard>
        <GlassCard variant="pill" style={styles.card}>
          <Text variant="caption" color="textSecondary">
            Pill variant
          </Text>
        </GlassCard>
        <GlassCard variant="panel" style={styles.card}>
          <Text variant="body" color="text">
            Panel variant (larger padding)
          </Text>
        </GlassCard>
        <GlassCard variant="card" gradient style={styles.card}>
          <Text variant="body" color="text">
            With optional gradient
          </Text>
        </GlassCard>

        <Text variant="h2" color="text" style={styles.sectionTitle}>
          Divider
        </Text>
        <View style={styles.dividerBlock}>
          <Divider />
          <Divider strong style={styles.dividerSpaced} />
        </View>

        <Text variant="h2" color="text" style={styles.sectionTitle}>
          Badge
        </Text>
        <View style={styles.badgeRow}>
          <Badge label="LIVE" variant="live" />
          <Badge label="FT" variant="ft" />
          <Badge label="KO 14:30" variant="scheduled" />
          <Badge label="Neutral" variant="neutral" />
        </View>

        <Text variant="h2" color="text" style={styles.sectionTitle}>
          Interactive
        </Text>
        <GlassCard variant="card" style={styles.card}>
          <TouchableOpacity
            onPressIn={() => setPressed('a')}
            onPressOut={() => setPressed(null)}
            accessibilityRole="button"
            accessibilityLabel="Example button"
          >
            <Text variant="bodyBold" color="primary">
              {pressed === 'a' ? 'Pressed' : 'Focusable button'}
            </Text>
          </TouchableOpacity>
        </GlassCard>

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

export default function DesignSystemPlaygroundScreen() {
  return (
    <ThemeProvider>
      <PlaygroundContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 60,
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
  },
  toggle: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  card: {
    marginBottom: 12,
  },
  dividerBlock: {
    marginBottom: 16,
  },
  dividerSpaced: {
    marginTop: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  footer: {
    height: 40,
  },
});
