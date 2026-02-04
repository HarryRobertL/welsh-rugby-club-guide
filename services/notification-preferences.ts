import { supabase } from '../lib/supabase';
import type { NotificationPreferences } from '../types/notifications';

/**
 * Get and update user notification preferences. Respected when sending push notifications.
 * File: services/notification-preferences.ts
 */
export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('users')
    .select('notify_lineup_published, notify_score_change, notify_full_time')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  const row = data as { notify_lineup_published?: boolean; notify_score_change?: boolean; notify_full_time?: boolean };
  return {
    notify_lineup_published: row.notify_lineup_published ?? true,
    notify_score_change: row.notify_score_change ?? true,
    notify_full_time: row.notify_full_time ?? true,
  };
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<{ error: Error | null }> {
  const update: Record<string, boolean> = {};
  if (prefs.notify_lineup_published !== undefined) update.notify_lineup_published = prefs.notify_lineup_published;
  if (prefs.notify_score_change !== undefined) update.notify_score_change = prefs.notify_score_change;
  if (prefs.notify_full_time !== undefined) update.notify_full_time = prefs.notify_full_time;
  if (Object.keys(update).length === 0) return { error: null };
  const { error } = await (supabase.from('users') as any).update(update).eq('id', userId);
  return { error: error as Error | null };
}
