import { Stack } from 'expo-router';

/**
 * Match centre group: index (match centre), lineup (team sheet builder).
 * File: app/(tabs)/games/[id]/_layout.tsx
 */
export default function MatchIdLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="lineup" />
      <Stack.Screen name="live" />
    </Stack>
  );
}
