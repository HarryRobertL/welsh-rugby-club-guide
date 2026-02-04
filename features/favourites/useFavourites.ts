import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/AuthContext';
import { addFavourite as addFav, removeFavourite as removeFav } from '../../services/favourites';
import type { FavouriteEntityType } from '../../types/favourites';

type FavIds = {
  teams: string[];
  competitions: string[];
  fixtures: string[];
};

type FavRow = { entity_type: string; entity_id: string };

/**
 * Favourites with optimistic add/remove. Persists to Supabase.
 * File: features/favourites/useFavourites.ts
 */
export function useFavourites(): {
  teamIds: string[];
  competitionIds: string[];
  fixtureIds: string[];
  isFavourite: (entityType: FavouriteEntityType, entityId: string) => boolean;
  addFavourite: (entityType: FavouriteEntityType, entityId: string) => Promise<void>;
  removeFavourite: (entityType: FavouriteEntityType, entityId: string) => Promise<void>;
  toggleFavourite: (entityType: FavouriteEntityType, entityId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { session } = useAuth();
  const [ids, setIds] = useState<FavIds>({ teams: [], competitions: [], fixtures: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!session?.user?.id) {
      setIds({ teams: [], competitions: [], fixtures: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('favourites')
        .select('entity_type, entity_id')
        .eq('user_id', session.user.id)
        .in('entity_type', ['team', 'competition', 'fixture']);
      if (err) throw err;
      const rows = (data ?? []) as FavRow[];
      setIds({
        teams: rows.filter((r) => r.entity_type === 'team').map((r) => r.entity_id),
        competitions: rows.filter((r) => r.entity_type === 'competition').map((r) => r.entity_id),
        fixtures: rows.filter((r) => r.entity_type === 'fixture').map((r) => r.entity_id),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load favourites');
      setIds({ teams: [], competitions: [], fixtures: [] });
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const getIds = useCallback((type: FavouriteEntityType) => {
    switch (type) {
      case 'team':
        return ids.teams;
      case 'competition':
        return ids.competitions;
      case 'fixture':
        return ids.fixtures;
    }
  }, [ids]);

  const isFavourite = useCallback(
    (entityType: FavouriteEntityType, entityId: string) => getIds(entityType).includes(entityId),
    [getIds]
  );

  const addFavourite = useCallback(
    async (entityType: FavouriteEntityType, entityId: string) => {
      if (!session?.user?.id) return;
      const key = entityType === 'team' ? 'teams' : entityType === 'competition' ? 'competitions' : 'fixtures';
      const prev = ids[key];
      if (prev.includes(entityId)) return;
      setIds((s) => ({ ...s, [key]: [...s[key], entityId] }));
      const { error: err } = await addFav(session.user.id, entityType, entityId);
      if (err) {
        setIds((s) => ({ ...s, [key]: prev }));
        throw err;
      }
    },
    [session?.user?.id, ids]
  );

  const removeFavourite = useCallback(
    async (entityType: FavouriteEntityType, entityId: string) => {
      if (!session?.user?.id) return;
      const key = entityType === 'team' ? 'teams' : entityType === 'competition' ? 'competitions' : 'fixtures';
      const prev = ids[key];
      setIds((s) => ({ ...s, [key]: s[key].filter((id) => id !== entityId) }));
      const { error: err } = await removeFav(session.user.id, entityType, entityId);
      if (err) {
        setIds((s) => ({ ...s, [key]: prev }));
        throw err;
      }
    },
    [session?.user?.id, ids]
  );

  const toggleFavourite = useCallback(
    async (entityType: FavouriteEntityType, entityId: string) => {
      if (isFavourite(entityType, entityId)) {
        await removeFavourite(entityType, entityId);
      } else {
        await addFavourite(entityType, entityId);
      }
    },
    [isFavourite, addFavourite, removeFavourite]
  );

  return {
    teamIds: ids.teams,
    competitionIds: ids.competitions,
    fixtureIds: ids.fixtures,
    isFavourite,
    addFavourite,
    removeFavourite,
    toggleFavourite,
    loading,
    error,
    refetch: fetch,
  };
}
