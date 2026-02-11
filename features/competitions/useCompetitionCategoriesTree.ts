import { useCallback, useEffect, useState } from 'react';
import categoryTree from '../../data/categoryTree.rugbyUnion.allwalessport.json';
import { supabase } from '../../lib/supabase';
import type { CategoryNode, CategoryNodeChild } from '../../types/competitions';

type CompetitionRow = {
  id: string;
  name: string;
  slug: string;
};

type CompetitionCountsRow = {
  competition_id: string;
  fixtures_count: number | null;
  standings_count: number | null;
  latest_season_id: string | null;
};

type CategoryTreeJson = {
  sport: string;
  source: string;
  categories: {
    name: string;
    slug: string;
    children: {
      name: string;
      slug: string;
    }[];
  }[];
};

/**
 * Competition categories tree driven by the All Wales Sport JSON.
 * File: features/competitions/useCompetitionCategoriesTree.ts
 */
export function useCompetitionCategoriesTree(): {
  categories: CategoryNode[];
  loading: boolean;
  error?: string;
} {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      const tree = categoryTree as CategoryTreeJson;
      const childSlugs = tree.categories.flatMap((category) =>
        category.children.map((child) => child.slug)
      );
      const uniqueSlugs = Array.from(new Set(childSlugs));

      const { data: competitionsData, error: competitionsError } = await supabase
        .from('competitions')
        .select('id, name, slug')
        .in('slug', uniqueSlugs);
      if (competitionsError) throw competitionsError;

      const { data: countsData, error: countsError } = await supabase.rpc('competition_counts');
      if (countsError) throw countsError;

      const competitions = (competitionsData ?? []) as CompetitionRow[];
      const competitionBySlug = new Map<string, CompetitionRow>();
      competitions.forEach((competition) => {
        competitionBySlug.set(competition.slug, competition);
      });

      const countsRows = (countsData ?? []) as CompetitionCountsRow[];
      const countsByCompetitionId = new Map<string, CompetitionCountsRow>();
      countsRows.forEach((row) => {
        countsByCompetitionId.set(row.competition_id, row);
      });

      const mappedCategories: CategoryNode[] = tree.categories.map((category) => {
        const children: CategoryNodeChild[] = category.children.map((child) => {
          const competition = competitionBySlug.get(child.slug);
          if (!competition) {
            return {
              name: child.name,
              slug: child.slug,
            };
          }

          const counts = countsByCompetitionId.get(competition.id);
          return {
            name: child.name,
            slug: child.slug,
            competition: {
              id: competition.id,
              name: competition.name,
              slug: competition.slug,
              counts: {
                fixtures: counts?.fixtures_count ?? 0,
                standings: counts?.standings_count ?? 0,
              },
              seasonId: counts?.latest_season_id ?? undefined,
            },
          };
        });

        const linkedCompetitions = children.filter((child) => !!child.competition);
        const fixturesTotal = linkedCompetitions.reduce(
          (total, child) => total + (child.competition?.counts.fixtures ?? 0),
          0
        );
        const standingsTotal = linkedCompetitions.reduce(
          (total, child) => total + (child.competition?.counts.standings ?? 0),
          0
        );

        return {
          name: category.name,
          slug: category.slug,
          children,
          counts: {
            competitions: linkedCompetitions.length,
            fixtures: fixturesTotal,
            standings: standingsTotal,
          },
        };
      });

      setCategories(mappedCategories);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { categories, loading, error };
}
