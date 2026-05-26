import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { signupSchema, type AuthSuccess } from '@rivals/shared/zod/auth';
import { theme } from '../../theme';
import { api } from '../../lib/api';
import { saveSession } from '../../lib/session';
import { useSessionStore } from '../../stores/session';

export function SignUpScreen({ onSwitch }: { onSwitch: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const setSession = useSessionStore((s) => s.setSession);

  const mut = useMutation({
    mutationFn: async () => {
      if (!consented) {
        throw new Error('You must agree to the Privacy Policy and Terms to sign up');
      }
      const parsed = signupSchema.safeParse({ email, password, username, displayName });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Invalid input');
      }
      return api<AuthSuccess>('/auth/signup', {
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

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Pick a username — friends will add you by it.</Text>

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
            placeholder="Password (min 8 chars)"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Username (a-z, 0-9, _)"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase())}
          />
          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor={theme.colors.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
          />

          <Pressable
            onPress={() => setConsented((c) => !c)}
            style={styles.consentRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consented }}
            accessibilityLabel="Agree to privacy policy and terms of service"
          >
            <View style={[styles.checkbox, consented && styles.checkboxChecked]}>
              {consented ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.consentText}>
              I agree to the{' '}
              <Text style={styles.link} onPress={() => Linking.openURL('https://rivals.app/privacy')}>
                Privacy Policy
              </Text>{' '}
              and{' '}
              <Text style={styles.link} onPress={() => Linking.openURL('https://rivals.app/terms')}>
                Terms of Service
              </Text>
              .
            </Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.btn, styles.btnPrimary, !consented && styles.btnDisabled]}
            onPress={() => {
              setError(null);
              mut.mutate();
            }}
            disabled={mut.isPending || !consented}
          >
            <Text style={styles.btnText}>
              {mut.isPending ? 'Creating…' : 'Create account'}
            </Text>
          </Pressable>

          <Pressable onPress={onSwitch}>
            <Text style={styles.link}>Already have an account? Log in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: { ...theme.typography.body, color: theme.colors.textMuted, marginBottom: theme.spacing.md },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
  },
  btn: { padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' },
  btnPrimary: { backgroundColor: theme.colors.accent, marginTop: theme.spacing.md },
  btnDisabled: { opacity: 0.5 },
  btnText: { ...theme.typography.heading, color: '#0B1220' },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkboxMark: { color: '#0B1220', fontWeight: '700' },
  consentText: { ...theme.typography.caption, color: theme.colors.textMuted, flex: 1 },
  error: { color: theme.colors.danger, ...theme.typography.caption },
  link: {
    ...theme.typography.body,
    color: theme.colors.accent,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
});
