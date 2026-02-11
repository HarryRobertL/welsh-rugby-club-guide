/**
 * Timezone and date/time display for Cymru Rugby.
 * Policy: Welsh domestic display uses Europe/London. Source times stored as UTC in DB; display in London when appropriate.
 * File: lib/dateTime.ts
 */

const WELSH_DISPLAY_TZ = 'Europe/London';

/**
 * Format a date for display (day, month, time). Uses Europe/London for consistency.
 */
export function formatKickoffDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      timeZone: WELSH_DISPLAY_TZ,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/**
 * Time only (e.g. "14:30") in Europe/London.
 */
export function formatKickoffTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-GB', {
      timeZone: WELSH_DISPLAY_TZ,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Short date key for grouping (e.g. "Mon 3 Feb").
 */
export function toDateKey(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', {
      timeZone: WELSH_DISPLAY_TZ,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}
