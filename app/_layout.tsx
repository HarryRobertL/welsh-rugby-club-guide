import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../features/auth/AuthContext';
import { usePushNotifications } from '../features/notifications/usePushNotifications';
import { ThemeProvider, useTheme } from '../lib/ui';
import { tokens } from '../lib/theme';

const MonaSansFont = require('../assets/MonaSans-VariableFont_wdth,wght.ttf');

/** On web, remove default document margin and set dark background so no white chrome shows. */
function WebDocumentStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const bg = tokens.colors.dark.background;
    const style = { margin: 0, padding: 0, backgroundColor: bg, minHeight: '100%' };
    Object.assign(document.body.style, style);
    const html = document.documentElement;
    Object.assign(html.style, { margin: 0, padding: 0, backgroundColor: bg, minHeight: '100%' });
    return () => {
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.body.style.backgroundColor = '';
      document.body.style.minHeight = '';
      html.style.margin = html.style.padding = html.style.backgroundColor = html.style.minHeight = '';
    };
  }, []);
  return null;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function PushNotificationsRegistration() {
  const { profile } = useAuth();
  usePushNotifications(profile?.id);
  return null;
}

/**
 * Root layout. AuthProvider wraps app; Stack has index, (auth), (tabs). Gating in index and (tabs).
 * File: app/_layout.tsx — expo-router root layout convention.
 */
function RootStack() {
  const { resolvedColors, mode } = useTheme();
  const systemDark = useColorScheme() === 'dark';
  const isDark = mode === 'system' ? systemDark : mode === 'dark';
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthProvider>
        <PushNotificationsRegistration />
        <Stack
          screenOptions={{
            headerShown: false,
            header: () => null,
            headerTransparent: true,
            headerStyle: { backgroundColor: 'transparent' },
            contentStyle: { backgroundColor: resolvedColors.background },
            animation: 'default',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthProvider>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    MonaSans: MonaSansFont,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <SafeAreaProvider>
        <View style={styles.bootSplash}>
          <ActivityIndicator size="small" color={tokens.colors.dark.primary} />
        </View>
      </SafeAreaProvider>
    );
  }
  if (fontError) {
    if (__DEV__ && typeof console !== 'undefined') console.warn('[fonts] MonaSans failed to load:', fontError);
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {Platform.OS === 'web' && <WebDocumentStyles />}
        <RootStack />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  bootSplash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.dark.background,
  },
});
