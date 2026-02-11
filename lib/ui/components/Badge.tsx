import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { tokens } from '../../theme';
import { Text } from '../Text';
import { useResolvedColors } from '../theme/ThemeProvider';

export type BadgeVariant = 'live' | 'ft' | 'scheduled' | 'neutral';

const VARIANT_CONFIG: Record<
  BadgeVariant,
  { bgToken: keyof ReturnType<typeof useResolvedColors>; textToken: keyof ReturnType<typeof useResolvedColors> }
> = {
  live: { bgToken: 'live', textToken: 'primaryContrast' },
  ft: { bgToken: 'success', textToken: 'primaryContrast' },
  scheduled: { bgToken: 'textSecondary', textToken: 'background' },
  neutral: { bgToken: 'surfaceMuted', textToken: 'text' },
};

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

/**
 * Status badge (LIVE, FT, KO 14:30). Uses theme tokens; readable on glass.
 */
export function Badge({ label, variant = 'neutral', style }: BadgeProps) {
  const colors = useResolvedColors();
  const config = VARIANT_CONFIG[variant];
  const backgroundColor = colors[config.bgToken];
  const color = colors[config.textToken];

  return (
    <View
      style={[styles.badge, { backgroundColor }, style]}
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <Text variant="micro" color={color} style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
});
