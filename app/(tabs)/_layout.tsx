import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router';
import { useAuth } from '../../features/auth/AuthContext';

/**
 * Tab layout. Role-aware gate: must be signed in to see tabs; else redirect to sign-in.
 * File: app/(tabs)/_layout.tsx — (tabs) group keeps URLs without /tabs/ segment.
 */
export default function TabLayout() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="games" options={{ title: 'Games' }} />
      <Tabs.Screen name="competitions" options={{ title: 'Competitions' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
