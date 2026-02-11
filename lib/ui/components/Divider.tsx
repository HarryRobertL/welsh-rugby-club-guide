import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { tokens } from '../../theme';
import { useResolvedColors } from '../theme/ThemeProvider';

export interface DividerProps {
  style?: ViewStyle;
  /** Use stronger stroke from tokens when true. */
  strong?: boolean;
}

export function Divider({ style, strong = false }: DividerProps) {
  const colors = useResolvedColors();
  const opacity = strong ? 0.18 : tokens.glass.opacity.border;
  const hex = Math.round(opacity * 255).toString(16).padStart(2, '0');
  const lineColor = `${colors.border}${hex}`;

  return (
    <View
      style={[styles.divider, { backgroundColor: lineColor }, style]}
      accessibilityRole="none"
    />
  );
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
