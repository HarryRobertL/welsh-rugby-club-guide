import { Stack } from 'expo-router';

/**
 * Match centre group: index (match centre), lineup (team sheet builder).
 * File: app/(tabs)/games/[id]/_layout.tsx
 */
export default function MatchIdLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Match centre' }} />
      <Stack.Screen name="lineup" options={{ title: 'Team sheet' }} />
      <Stack.Screen name="live" options={{ title: 'Live console' }} />
    </Stack>
  );
}
