/**
 * Team sheet / lineup types.
 * File: types/lineup.ts
 */

export type LineupRow = {
  shirt_number: number;
  position: string;
  player_name: string;
  sort_order: number;
};

export const STARTERS_COUNT = 15;
export const BENCH_COUNT = 8;
export const LINEUP_SIZE = STARTERS_COUNT + BENCH_COUNT;
