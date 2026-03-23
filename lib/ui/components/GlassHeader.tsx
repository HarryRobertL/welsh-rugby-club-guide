import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '../../theme';
import { useResolvedColors } from '../theme/ThemeProvider';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

export interface GlassHeaderProps {
  leftSlot?: React.ReactNode;
  titleSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  style?: ViewStyle;
}

export function GlassHeader({
  leftSlot,
  titleSlot,
  rightSlot,
  style,
}: GlassHeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useResolvedColors();
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (!cancelled) setReduceTransparency(enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency
    );
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const useBlur = Platform.OS === 'ios' && !reduceTransparency;
  const tint = colors.background === tokens.colors.dark.background ? 'dark' : 'light';
  const fallbackBackground = {
    backgroundColor: `${colors.surface}${Math.round(tokens.glass.opacity.surface * 255).toString(16).padStart(2, '0')}`,
  };

  return (
    <View
      style={[
        styles.wrapper,
        { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right },
        style,
      ]}
      accessibilityRole="header"
    >
      {useBlur ? (
        <BlurView
          intensity={blurToIntensity('md')}
          tint={tint}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, fallbackBackground]} />
      )}
      <View style={[styles.row, { pointerEvents: 'box-none' }]}>
        <View style={styles.slot}>{leftSlot}</View>
        <View style={styles.titleSlot}>{titleSlot}</View>
        <View style={[styles.slot, styles.slotRight]}>{rightSlot}</View>
      </View>
    </View>
  );
}

function blurToIntensity(key: 'sm' | 'md' | 'lg'): number {
  const map = { sm: 40, md: 60, lg: 80 } as const;
  return map[key];
}

/**
 * Header action button with hitSlop and a11y. Use for leftSlot/rightSlot.
 */
export function GlassHeaderButton({
  children,
  accessibilityLabel,
  onPress,
  ...rest
}: {
  children: React.ReactNode;
  accessibilityLabel: string;
  onPress?: () => void;
} & Omit<React.ComponentProps<typeof Pressable>, 'children'>) {
  return (
    <Pressable
      hitSlop={HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      focusable
      style={({ pressed }) => [
        styles.headerButton,
        pressed && styles.headerButtonPressed,
      ]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'visible',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.glass.stroke.subtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.xs,
    paddingBottom: tokens.spacing.sm,
  },
  slot: {
    minWidth: 44,
    alignItems: 'flex-start',
  },
  titleSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotRight: {
    minWidth: 44,
    alignItems: 'flex-end',
  },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    borderRadius: tokens.radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPressed: {
    opacity: 0.75,
  },
});
