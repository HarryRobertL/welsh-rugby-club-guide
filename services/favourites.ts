import { supabase } from '../lib/supabase';
import type { FavouriteEntityType } from '../types/favourites';

/**
 * Add a favourite. Persists to Supabase.
 * File: services/favourites.ts
 */
export async function addFavourite(
  userId: string,
  entityType: FavouriteEntityType,
  entityId: string
): Promise<{ error: Error | null }> {
  const { error } = await (supabase.from('favourites') as any).insert({
    user_id: userId,
    entity_type: entityType,
    entity_id: entityId,
  });
  return { error: error as Error | null };
}

/**
 * Remove a favourite by entity type and id.
 */
export async function removeFavourite(
  userId: string,
  entityType: FavouriteEntityType,
  entityId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('favourites')
    .delete()
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  return { error: error as Error | null };
}
