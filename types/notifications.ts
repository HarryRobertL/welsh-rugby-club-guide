/**
 * Push notifications and user preferences.
 * File: types/notifications.ts
 */

export type PushPlatform = 'ios' | 'android';

export type NotificationPreferences = {
  notify_lineup_published: boolean;
  notify_score_change: boolean;
  notify_full_time: boolean;
  // TODO: quiet hours — add quiet_hours_start, quiet_hours_end (TIME) and timezone;
  //       skip sending when current time (in user TZ) is within that window.
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  notify_lineup_published: true,
  notify_score_change: true,
  notify_full_time: true,
};
