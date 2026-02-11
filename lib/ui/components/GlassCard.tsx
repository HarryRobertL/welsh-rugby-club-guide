import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { tokens } from '../../theme';
import { useResolvedColors } from '../theme/ThemeProvider';

export type GlassCardVariant = 'card' | 'pill' | 'panel';

const VARIANT_STYLES: Record<
  GlassCardVariant,
  { borderRadius: number; padding: number }
> = {
  card: { borderRadius: tokens.radius.lg, padding: tokens.spacing.lg },
  pill: { borderRadius: tokens.radius.full, padding: tokens.spacing.md },
  panel: { borderRadius: tokens.radius.lg, padding: tokens.spacing.xl },
};

/** Map token blur key to BlurView intensity (1–100). */
function blurToIntensity(key: 'sm' | 'md' | 'lg'): number {
  const map = { sm: 40, md: 60, lg: 80 } as const;
  return map[key];
}

export interface GlassCardProps {
  children: React.ReactNode;
  variant?: GlassCardVariant;
  /** Override blur intensity (1–100). Default from variant: card=md, pill=sm, panel=lg. */
  intensity?: number;
  style?: ViewStyle;
  /** Optional gradient overlay; uses expo-linear-gradient when true. */
  gradient?: boolean;
}

const defaultIntensityByVariant: Record<GlassCardVariant, number> = {
  card: blurToIntensity('md'),
  pill: blurToIntensity('sm'),
  panel: blurToIntensity('lg'),
};

export function GlassCard({
  children,
  variant = 'card',
  intensity,
  style,
  gradient = false,
}: GlassCardProps) {
  const colors = useResolvedColors();
  const variantStyle = VARIANT_STYLES[variant];
  const blurIntensity = intensity ?? defaultIntensityByVariant[variant];
  const tint = colors.background === tokens.colors.dark.background ? 'dark' : 'light';

  const shadowStyle: ViewStyle =
    Platform.OS === 'web'
      ? {
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }
      : Platform.OS === 'ios'
        ? styles.shadow
        : { elevation: tokens.elevation.sm.elevation };

  const containerStyle: ViewStyle[] = [
    styles.base,
    {
      borderRadius: variantStyle.borderRadius,
      padding: variantStyle.padding,
      borderWidth: 1,
      borderColor: tokens.glass.stroke.default,
      overflow: 'hidden',
    },
    shadowStyle,
    ...(style ? [style] : []),
  ];

  const fallbackBackground = {
    backgroundColor: `${colors.surface}${Math.round(tokens.glass.opacity.surface * 255).toString(16).padStart(2, '0')}`,
  };

  const content = (
    <>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={blurIntensity}
          tint={tint}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, fallbackBackground]} />
      )}
      {gradient && (
        <LinearGradient
          colors={[`${colors.surface}40`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
        />
      )}
      <View style={styles.content}>{children}</View>
    </>
  );

  return (
    <View
      style={containerStyle}
      accessibilityRole="none"
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'relative',
  },
  shadow: {
    ...tokens.elevation.sm,
  },
  content: {
    zIndex: 1,
  },
});
