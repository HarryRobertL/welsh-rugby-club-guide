import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import type { PushPlatform } from '../types/notifications';

/**
 * Request permissions and get Expo push token. Returns null if not a physical device or permission denied.
 * File: services/push.ts
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('match-updates', {
      name: 'Match updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ffffff',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResult.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Upsert push token for the current user. Call after registerForPushNotificationsAsync when authenticated.
 */
export async function savePushToken(
  userId: string,
  token: string
): Promise<{ error: Error | null }> {
  const platform: PushPlatform = Platform.OS === 'ios' ? 'ios' : 'android';
  const { error } = await (supabase.from('push_tokens') as any).upsert(
    { user_id: userId, token, platform },
    { onConflict: 'user_id,token' }
  );
  return { error: error as Error | null };
}

/**
 * Remove push token for the current user (e.g. on sign out).
 */
export async function removePushToken(userId: string, token: string): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
  return { error: error as Error | null };
}
