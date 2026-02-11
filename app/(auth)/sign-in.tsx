import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../features/auth/AuthContext';
import { GlassCard, Text, useResolvedColors } from '../../lib/ui';
import { tokens } from '../../lib/theme';

/**
 * Sign-in screen. Email/password; redirects to tabs on success.
 * File: app/(auth)/sign-in.tsx — route /sign-in.
 */
export default function SignInScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const colors = useResolvedColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Enter email and password');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Sign in failed', error.message);
      return;
    }
    router.replace('/(tabs)');
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.logoWrap}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Cymru Rugby"
          />
        </View>
        <GlassCard variant="panel" gradient style={styles.card}>
          <Text variant="h2" color="text">Welcome back</Text>
          <Text variant="body" color="textSecondary" style={styles.description}>
            Sign in to follow your clubs, leagues, and live match updates.
          </Text>

          <View style={styles.field}>
            <Text variant="caption" color="textSecondary">Email</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              onSubmitEditing={() => passwordRef.current?.focus()}
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.surfaceMuted,
                },
              ]}
            />
          </View>

          <View style={styles.field}>
            <Text variant="caption" color="textSecondary">Password</Text>
            <TextInput
              ref={passwordRef}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSubmit}
              style={[
                styles.input,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.surfaceMuted,
                },
              ]}
            />
          </View>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.primary },
              (pressed || loading) && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryContrast} />
            ) : (
              <Text variant="bodyBold" color="primaryContrast">Sign in</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/sign-up')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Create account"
          >
            <Text variant="body" color="textSecondary">Create account</Text>
          </Pressable>
        </GlassCard>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboard: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
  logoWrap: {
    alignItems: 'center',
  },
  logo: {
    width: 170,
    height: 70,
    marginBottom: tokens.spacing.md,
  },
  card: {
    gap: tokens.spacing.md,
  },
  description: {
    marginBottom: tokens.spacing.sm,
  },
  field: {
    gap: tokens.spacing.xs,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: tokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.spacing.sm,
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: tokens.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
});
