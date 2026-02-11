import { Stack } from 'expo-router';

/**
 * Games stack: fixtures list (default) and match centre [id].
 * File: app/(tabs)/games/_layout.tsx — stack inside Games tab.
 */
export default function GamesLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
