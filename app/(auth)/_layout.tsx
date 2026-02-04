import { Stack } from 'expo-router';

/**
 * Auth stack: sign-in (default), sign-up. No header for minimal UI.
 * File: app/(auth)/_layout.tsx — route group (auth) keeps URL without segment.
 */
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
