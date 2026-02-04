import { Stack } from 'expo-router';

/**
 * Competitions stack: list (default) and detail [id] with league table + form.
 * File: app/(tabs)/competitions/_layout.tsx — stack inside Competitions tab.
 */
export default function CompetitionsLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, title: 'Competitions' }}>
      <Stack.Screen name="index" options={{ title: 'Competitions' }} />
      <Stack.Screen name="[id]" options={{ title: 'League table' }} />
    </Stack>
  );
}
