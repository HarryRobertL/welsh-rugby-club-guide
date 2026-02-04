import { Stack } from 'expo-router';

/**
 * Games stack: fixtures list (default) and match centre [id].
 * File: app/(tabs)/games/_layout.tsx — stack inside Games tab.
 */
export default function GamesLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, title: 'Games' }}>
      <Stack.Screen name="index" options={{ title: 'Fixtures' }} />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
