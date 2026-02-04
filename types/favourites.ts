/**
 * Favourites entity types and view models.
 * File: types/favourites.ts
 */

export type FavouriteEntityType = 'team' | 'competition' | 'fixture';

export type Favourite = {
  id: string;
  entity_type: FavouriteEntityType;
  entity_id: string;
};
