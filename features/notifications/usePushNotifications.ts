import { useEffect, useRef } from 'react';
import {
  registerForPushNotificationsAsync,
  savePushToken,
  removePushToken,
} from '../../services/push';

/**
 * Registers for push notifications when the user is authenticated and saves the token to Supabase.
 * On sign out (userId becomes null), removes the stored token so this device stops receiving notifications.
 * Call this from the root layout so it runs for the whole app.
 * File: features/notifications/usePushNotifications.ts
 */
export function usePushNotifications(userId: string | undefined): void {
  const tokenRef = useRef<string | null>(null);
  const userIdRef = useRef<string | undefined>(userId);

  useEffect(() => {
    const previousUserId = userIdRef.current;
    userIdRef.current = userId;

    if (userId) {
      registerForPushNotificationsAsync().then(async (token) => {
        if (!token) return;
        tokenRef.current = token;
        await savePushToken(userId, token);
      });
      return;
    }

    // User signed out: remove this device's token so they don't receive notifications
    if (previousUserId && tokenRef.current) {
      removePushToken(previousUserId, tokenRef.current).then(() => {
        tokenRef.current = null;
      });
    }
  }, [userId]);
}
