import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useFavourites } from '../features/favourites/useFavourites';
import type { FavouriteEntityType } from '../types/favourites';
import { useResolvedColors } from '../lib/ui';

type Props = {
  entityType: FavouriteEntityType;
  entityId: string;
  size?: number;
};

/**
 * Toggle favourite (add/remove). Optimistic update; reverts on error.
 * File: components/FavouriteButton.tsx
 */
export function FavouriteButton({ entityType, entityId, size = 24 }: Props) {
  const { isFavourite, toggleFavourite } = useFavourites();
  const colors = useResolvedColors();
  const [pressing, setPressing] = useState(false);
  const favourited = isFavourite(entityType, entityId);

  async function handlePress() {
    if (pressing) return;
    setPressing(true);
    try {
      await toggleFavourite(entityType, entityId);
    } catch {
      Alert.alert('Error', 'Could not update favourite. Try again.');
    } finally {
      setPressing(false);
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={pressing}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={favourited ? 'Remove from favourites' : 'Add to favourites'}
      accessibilityState={{ selected: favourited, disabled: pressing }}
      focusable
      style={({ pressed }) => [
        styles.button,
        (pressed || pressing) && styles.buttonPressed,
      ]}
    >
      <Text style={{ fontSize: size, color: favourited ? colors.error : colors.textMuted }}>
        {favourited ? '♥' : '♡'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
  },
});
