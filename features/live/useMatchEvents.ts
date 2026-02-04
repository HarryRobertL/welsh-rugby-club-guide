import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { MatchEventRow } from '../../types/live-events';

const POLL_INTERVAL_MS = 10_000;
const FALLBACK_DELAY_MS = 3_000;

export type RealtimeConnectionStatus = 'connecting' | 'realtime' | 'polling' | 'off';

export type UseMatchEventsOptions = {
  /** Called when events are updated (realtime or poll). Use to refetch match centre score. */
  onUpdate?: () => void;
};

/**
 * Fetches match_events for a match with Supabase Realtime subscription.
 * Handles reconnects (refetch on SUBSCRIBED) and falls back to polling when realtime is unavailable.
 * File: features/live/useMatchEvents.ts
 */
export function useMatchEvents(
  matchId: string | undefined,
  options?: UseMatchEventsOptions
): {
  events: MatchEventRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  connectionStatus: RealtimeConnectionStatus;
} {
  const { onUpdate } = options ?? {};
  const [events, setEvents] = useState<MatchEventRow[]>([]);
  const [loading, setLoading] = useState(!!matchId);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>(
    matchId ? 'connecting' : 'off'
  );
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(
    async (skipLoading = false) => {
      if (!matchId) {
        setEvents([]);
        setLoading(false);
        return;
      }
      if (!skipLoading) {
        setLoading(true);
      }
      setError(null);
      try {
        const { data, error: err } = await supabase
          .from('match_events')
          .select('id, match_id, event_type, minute, payload, created_at')
          .eq('match_id', matchId)
          .order('created_at', { ascending: true });
        if (err) throw err;
        setEvents((data ?? []) as MatchEventRow[]);
        onUpdate?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load events');
        setEvents([]);
      } finally {
        if (!skipLoading) {
          setLoading(false);
        }
      }
    },
    [matchId, onUpdate]
  );

  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;

  // Initial fetch and realtime subscription
  useEffect(() => {
    fetch();
  }, [fetch]);

  // Realtime subscription + reconnect handling + fallback to polling
  useEffect(() => {
    if (!matchId) {
      setConnectionStatus('off');
      return;
    }

    const channel = supabase
      .channel(`match_events:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          fetchRef.current(true);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          if (fallbackTimerRef.current) {
            clearTimeout(fallbackTimerRef.current);
            fallbackTimerRef.current = null;
          }
          setConnectionStatus('realtime');
          fetchRef.current(true);
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setConnectionStatus('polling');
        }
      });

    // If we don't get SUBSCRIBED within FALLBACK_DELAY_MS, assume realtime unavailable and use polling
    fallbackTimerRef.current = setTimeout(() => {
      setConnectionStatus((prev) => (prev === 'connecting' ? 'polling' : prev));
      fallbackTimerRef.current = null;
    }, FALLBACK_DELAY_MS);

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [matchId]); // Intentionally omit fetch to avoid resubscribing on every refetch

  // Fallback polling when connectionStatus is 'polling'
  useEffect(() => {
    if (connectionStatus !== 'polling' || !matchId) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }
    pollIntervalRef.current = setInterval(() => {
      fetch(true);
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [connectionStatus, matchId, fetch]);

  return { events, loading, error, refetch: () => fetch(false), connectionStatus };
}
