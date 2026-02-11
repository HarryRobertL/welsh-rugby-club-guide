import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../features/auth/AuthContext';
import { tokens } from '../lib/theme';

/**
 * Root index: gate by auth. If session → tabs; else → sign-in.
 * File: app/index.tsx — initial route; no UI.
 */
export default function Index() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={tokens.colors.dark.primary} />
      </View>
    );
  }
  if (session) return <Redirect href="/(tabs)" />;
  return <Redirect href="/(auth)/sign-in" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.dark.background,
  },
});
