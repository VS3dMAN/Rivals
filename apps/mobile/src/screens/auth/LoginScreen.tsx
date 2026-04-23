import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { loginSchema, type AuthSuccess } from '@rivals/shared/zod/auth';
import { theme } from '../../theme';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/session';
import { useSessionStore } from '../../stores/session';

const supabaseUrl = (Constants.expoConfig?.extra?.supabaseUrl as string | undefined) ?? '';

export function LoginScreen({ onSwitch }: { onSwitch: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setSession = useSessionStore((s) => s.setSession);

  const loginMut = useMutation({
    mutationFn: async () => {
      const parsed = loginSchema.safeParse({ email, password });
      if (!parsed.success) throw new Error('Invalid email or password');
      return api<AuthSuccess>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
    },
    onSuccess: async (data) => {
      await saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setSession(data);
    },
    onError: (e) => setError((e as Error).message),
  });

  const googleMut = useMutation({
    mutationFn: async () => {
      if (!supabaseUrl) throw new Error('Supabase not configured');
      const redirectUri = Linking.createURL('auth-callback');
      const authUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type !== 'success' || !result.url) {
        throw new Error('Google sign-in cancelled');
      }
      const parsed = Linking.parse(result.url);
      const code = (parsed.queryParams?.code as string | undefined) ?? undefined;
      if (!code) throw new Error('No auth code returned');
      return api<AuthSuccess>('/auth/oauth/callback', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    },
    onSuccess: async (data) => {
      await saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setSession(data);
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'center' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Welcome back</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => {
              setError(null);
              loginMut.mutate();
            }}
            disabled={loginMut.isPending}
          >
            <Text style={styles.btnText}>{loginMut.isPending ? 'Signing in…' : 'Log in'}</Text>
          </Pressable>

          <Text style={styles.or}>or</Text>

          <Pressable
            style={[styles.btn, styles.btnGoogle]}
            onPress={() => {
              setError(null);
              googleMut.mutate();
            }}
            disabled={googleMut.isPending}
          >
            <Text style={styles.btnGoogleText}>
              {googleMut.isPending ? 'Opening Google…' : 'Continue with Google'}
            </Text>
          </Pressable>

          <Pressable onPress={onSwitch}>
            <Text style={styles.link}>New here? Create an account</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.md },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
  },
  btn: { padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnGoogle: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  btnText: { ...theme.typography.heading, color: '#0B1220' },
  btnGoogleText: { ...theme.typography.heading, color: theme.colors.text },
  error: { color: theme.colors.danger, ...theme.typography.caption },
  or: { color: theme.colors.textMuted, textAlign: 'center' },
  link: {
    ...theme.typography.body,
    color: theme.colors.accent,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
});
