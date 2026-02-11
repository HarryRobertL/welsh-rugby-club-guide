import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { IconName } from '../icons';
import { getIoniconsName } from '../icons';

const DEFAULT_SIZE = 24;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Single icon component. All icons go through this component.
 * For buttons: put accessibilityLabel and hitSlop on the Pressable wrapper, not here.
 */
export function Icon({
  name,
  size = DEFAULT_SIZE,
  color = '#000',
  style,
}: IconProps) {
  const ioniconsName = getIoniconsName(name) as IoniconsName;
  return (
    <View style={[styles.wrapper, { pointerEvents: 'none' }, style]} accessibilityElementsHidden>
      <Ionicons name={ioniconsName} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
