import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../../features/auth/AuthContext';
import { Icon } from '../../lib/ui';
import { theme, tokens } from '../../lib/theme';

/**
 * Tab layout. Role-aware gate: must be signed in to see tabs; else redirect to sign-in.
 * File: app/(tabs)/_layout.tsx — (tabs) group keeps URLs without /tabs/ segment.
 */
export default function TabLayout() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={tokens.colors.dark.primary} />
      </View>
    );
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        header: () => null,
        headerStyle: { height: 0, minHeight: 0, backgroundColor: 'transparent' },
        headerTransparent: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          paddingTop: 6,
          paddingBottom: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          lineHeight: 14,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Icon name="Home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="games"
        options={{
          headerShown: false,
          title: 'Games',
          tabBarIcon: ({ color, size }) => <Icon name="Rugby" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="competitions"
        options={{
          headerShown: false,
          title: 'Competitions',
          tabBarIcon: ({ color, size }) => <Icon name="Trophy" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          headerShown: false,
          title: 'Search',
          tabBarIcon: ({ color, size }) => <Icon name="Search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          headerShown: false,
          title: 'Account',
          tabBarIcon: ({ color, size }) => <Icon name="Person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="favourites"
        options={{
          href: null,
          title: 'Favourites',
        }}
      />
      <Tabs.Screen
        name="debug"
        options={{
          href: null,
          title: 'Debug',
        }}
      />
      <Tabs.Screen
        name="design-system"
        options={{
          href: null,
          title: 'Design system',
        }}
      />
      <Tabs.Screen
        name="claim-club"
        options={{
          href: null,
          title: 'Claim club',
        }}
      />
      <Tabs.Screen
        name="club-claims"
        options={{
          href: null,
          title: 'Club claims',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.dark.background,
  },
});
