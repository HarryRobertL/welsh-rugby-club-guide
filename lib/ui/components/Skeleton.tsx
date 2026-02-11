import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { tokens } from '../../theme';
import { useResolvedColors } from '../theme/ThemeProvider';

export type SkeletonVariant = 'line' | 'block' | 'circle';

export interface SkeletonProps {
  /** Width; default from variant (line/block: full width, circle: from size). */
  width?: number;
  /** Height; default from variant. */
  height?: number;
  /** Border radius; circle uses full radius by default. */
  radius?: number;
  variant?: SkeletonVariant;
  style?: ViewStyle;
}

const LINE_HEIGHT = tokens.spacing.sm;
const BLOCK_HEIGHT = tokens.spacing.xl;
const CIRCLE_SIZE = 40;

function getDefaultDimensions(variant: SkeletonVariant): { width?: number; height: number; radius: number } {
  switch (variant) {
    case 'line':
      return { height: LINE_HEIGHT, radius: tokens.radius.sm };
    case 'circle':
      return { width: CIRCLE_SIZE, height: CIRCLE_SIZE, radius: tokens.radius.full };
    case 'block':
    default:
      return { height: BLOCK_HEIGHT, radius: tokens.radius.md };
  }
}

/**
 * Placeholder skeleton. Token-based sizes/radii. Shimmer when Reanimated available and reduce motion off.
 * Screen reader: not announced as meaningful content.
 */
export function Skeleton({
  width,
  height,
  radius,
  variant = 'block',
  style,
}: SkeletonProps) {
  const colors = useResolvedColors();
  const reduceMotion = useReducedMotion();
  const shimmer = useSharedValue(0);

  const dims = getDefaultDimensions(variant);
  const w = width ?? dims.width;
  const h = height ?? dims.height;
  const r = radius ?? dims.radius;

  useEffect(() => {
    if (reduceMotion) return;
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      true
    );
  }, [reduceMotion, shimmer]);

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    return {
      opacity: 0.4 + shimmer.value * 0.35,
    };
  }, [reduceMotion]);

  const containerStyle: ViewStyle[] = [
    styles.base,
    {
      ...(w !== undefined && { width: w }),
      height: h,
      borderRadius: r,
      backgroundColor: colors.surfaceMuted,
    },
  ];
  if (style) containerStyle.push(style);

  return (
    <View
      style={containerStyle}
      accessibilityElementsHidden
      importantForAccessibility="no"
      accessibilityRole="none"
    >
      {!reduceMotion && (
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.shimmerLayer, { borderRadius: r }, animatedStyle]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  shimmerLayer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
