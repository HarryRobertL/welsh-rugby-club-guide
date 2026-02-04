import { useState } from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { useFavourites } from '../features/favourites/useFavourites';
import type { FavouriteEntityType } from '../types/favourites';

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
    <TouchableOpacity
      onPress={handlePress}
      disabled={pressing}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{ padding: 4 }}
    >
      <Text style={{ fontSize: size, color: favourited ? '#c00' : '#999' }}>
        {favourited ? '♥' : '♡'}
      </Text>
    </TouchableOpacity>
  );
}
