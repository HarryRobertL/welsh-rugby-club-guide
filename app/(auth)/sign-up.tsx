import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../features/auth/AuthContext';

/**
 * Sign-up screen. Email/password; creates auth user + public.users row (role supporter); redirects to tabs.
 * File: app/(auth)/sign-up.tsx — route /sign-up.
 */
export default function SignUpScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Enter email and password');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email.trim(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Sign up failed', error.message);
      return;
    }
    router.replace('/(tabs)');
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Text style={{ marginBottom: 8 }}>Email</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => passwordRef.current?.focus()}
        style={{ borderWidth: 1, padding: 12, marginBottom: 16 }}
      />
      <Text style={{ marginBottom: 8 }}>Password (min 6)</Text>
      <TextInput
        ref={passwordRef}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={handleSubmit}
        style={{ borderWidth: 1, padding: 12, marginBottom: 24 }}
      />
      <TouchableOpacity onPress={handleSubmit} disabled={loading} style={{ padding: 12, alignItems: 'center', backgroundColor: '#ddd' }}>
        {loading ? <ActivityIndicator /> : <Text>Create account</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16, alignItems: 'center' }}>
        <Text>Back to sign in</Text>
      </TouchableOpacity>
    </View>
  );
}
