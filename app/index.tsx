import { Redirect } from 'expo-router';
import { useAuth } from '../features/auth/AuthContext';

/**
 * Root index: gate by auth. If session → tabs; else → sign-in.
 * File: app/index.tsx — initial route; no UI.
 */
export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Redirect href="/(tabs)" />;
  return <Redirect href="/(auth)/sign-in" />;
}
