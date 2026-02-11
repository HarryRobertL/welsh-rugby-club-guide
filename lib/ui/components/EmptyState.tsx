import React from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  type ViewStyle,
} from 'react-native';
import { tokens } from '../../theme';
import { Icon } from './Icon';
import { Text } from '../Text';
import { useResolvedColors } from '../theme/ThemeProvider';
import type { IconName } from '../icons';

const MIN_TOUCH_TARGET = 44;

export type EmptyStateMode = 'default' | 'error';

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
}

export interface EmptyStateProps {
  title: string;
  description: string;
  primaryAction: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Optional icon from registry; do not import icon libs directly. */
  icon?: IconName;
  mode?: EmptyStateMode;
  /** When true, show short offline hint (e.g. in error mode). Screens pass this; we do not detect network. */
  isOffline?: boolean;
  /** Short human copy for error mode. Shown below description when mode is error. */
  errorMessage?: string;
  style?: ViewStyle;
}

/**
 * Empty or error state with supportive copy. Buttons have clear labels and 44pt touch targets.
 * Text uses theme and respects font scaling.
 */
export function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  icon,
  mode = 'default',
  isOffline,
  errorMessage,
  style,
}: EmptyStateProps) {
  const colors = useResolvedColors();
  const isError = mode === 'error';

  const message = isError && errorMessage ? errorMessage : description;
  const hint = isError && isOffline
    ? 'Check your connection and try again.'
    : undefined;

  return (
    <View style={[styles.container, style]} accessibilityRole="none">
      {icon !== undefined && (
        <View style={styles.iconWrap}>
          <Icon
            name={icon}
            size={32}
            color={isError ? colors.error : colors.textMuted}
          />
        </View>
      )}
      <Text variant="bodyBold" color="text" style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text variant="body" color="textSecondary" style={styles.description}>
        {message}
      </Text>
      {hint !== undefined && (
        <Text variant="caption" color="textMuted" style={styles.hint}>
          {hint}
        </Text>
      )}
      <View style={styles.actions}>
        <Pressable
          onPress={primaryAction.onPress}
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: isError ? colors.primary : colors.primary },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={primaryAction.label}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text variant="bodyBold" color="primaryContrast">
            {primaryAction.label}
          </Text>
        </Pressable>
        {secondaryAction !== undefined && (
          <Pressable
            onPress={secondaryAction.onPress}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={secondaryAction.label}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text variant="body" color="text">
              {secondaryAction.label}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: tokens.spacing.xl,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: tokens.spacing.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
  },
  description: {
    textAlign: 'center',
    marginBottom: tokens.spacing.xs,
  },
  hint: {
    textAlign: 'center',
    marginBottom: tokens.spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
    marginTop: tokens.spacing.lg,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  primaryBtn: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtn: {
    minWidth: MIN_TOUCH_TARGET,
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: tokens.spacing.xl,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
