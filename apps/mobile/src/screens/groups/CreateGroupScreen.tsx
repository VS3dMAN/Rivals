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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';
import { useCreateGroup } from '../../hooks/useGroups';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'CreateGroup'>;

function guessTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

export function CreateGroupScreen() {
  const nav = useNavigation<Nav>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [tz, setTz] = useState(guessTz());
  const [error, setError] = useState<string | null>(null);
  const mut = useCreateGroup();

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Create a group</Text>
          <Text style={styles.subtitle}>
            You&apos;ll be the admin. You can edit these later.
          </Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Morning Runners"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={80}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
            placeholder="What this group is about"
            placeholderTextColor={theme.colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
          />

          <Text style={styles.label}>Avatar URL (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://..."
            placeholderTextColor={theme.colors.textMuted}
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Reference timezone</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. America/Los_Angeles"
            placeholderTextColor={theme.colors.textMuted}
            value={tz}
            onChangeText={setTz}
            autoCapitalize="none"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            disabled={mut.isPending}
            onPress={async () => {
              setError(null);
              if (!name.trim()) {
                setError('Name is required');
                return;
              }
              try {
                const group = await mut.mutateAsync({
                  name: name.trim(),
                  description: description.trim() || undefined,
                  avatarUrl: avatarUrl.trim() || undefined,
                  referenceTz: tz,
                });
                nav.replace('GroupDashboard', { groupId: group.id });
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Text style={styles.btnText}>{mut.isPending ? 'Creating…' : 'Create'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  label: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
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
    marginTop: theme.spacing.lg,
  },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnText: { ...theme.typography.heading, color: '#0B1220' },
  error: { color: theme.colors.danger, ...theme.typography.caption, marginTop: theme.spacing.sm },
});
