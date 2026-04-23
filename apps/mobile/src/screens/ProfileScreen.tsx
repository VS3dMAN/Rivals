import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '../theme';
import { api } from '../lib/api';
import { clearSession } from '../lib/session';
import { useSessionStore } from '../stores/session';
import { useCurrentUser } from '../hooks/useCurrentUser';

export function ProfileScreen() {
  const { data: user, isLoading } = useCurrentUser();
  const clear = useSessionStore((s) => s.clear);
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');

  const updateMut = useMutation({
    mutationFn: (body: { displayName: string }) =>
      api('/me', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  const logoutAllMut = useMutation({
    mutationFn: () => api('/auth/logout-all', { method: 'POST' }),
    onSuccess: async () => {
      await clearSession();
      queryClient.clear();
      clear();
    },
    onError: (e) => Alert.alert('Logout failed', (e as Error).message),
  });

  if (isLoading || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={theme.colors.accent} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.row}>
          <Text style={styles.label}>@username</Text>
          <Text style={styles.value}>{user.username}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user.email}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Display name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How friends see you"
            placeholderTextColor={theme.colors.textMuted}
          />
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => updateMut.mutate({ displayName })}
            disabled={updateMut.isPending || displayName === user.displayName}
          >
            <Text style={styles.btnText}>
              {updateMut.isPending ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.btn, styles.btnDanger]}
          onPress={() => logoutAllMut.mutate()}
          disabled={logoutAllMut.isPending}
        >
          <Text style={styles.btnText}>
            {logoutAllMut.isPending ? 'Signing out…' : 'Log out from all devices'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { ...theme.typography.title, color: theme.colors.text, marginBottom: theme.spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { ...theme.typography.body, color: theme.colors.textMuted },
  value: { ...theme.typography.body, color: theme.colors.text },
  field: { gap: theme.spacing.sm, marginTop: theme.spacing.md },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
  },
  btn: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnDanger: { backgroundColor: theme.colors.danger, marginTop: theme.spacing.lg },
  btnText: { ...theme.typography.heading, color: '#0B1220' },
});
