import { useState } from 'react';
import {
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { theme } from '../../theme';
import { useCreateGroup } from '../../hooks/useGroups';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';
import { useSessionStore } from '../../stores/session';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'CreateGroup'>;

function guessTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

async function uploadAvatar(localUri: string, accessToken: string): Promise<string> {
  const extra = Constants.expoConfig?.extra as
    | { supabaseUrl?: string; supabaseAnonKey?: string }
    | undefined;
  if (!extra?.supabaseUrl || !extra.supabaseAnonKey) {
    throw new Error('Supabase not configured for avatar upload');
  }
  const supabase = createClient(extra.supabaseUrl, extra.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false },
  });

  const res = await fetch(localUri);
  const blob = await res.blob();
  const ext = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const key = `groups/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: upErr } = await supabase.storage.from('avatars').upload(key, blob, {
    contentType: blob.type || 'image/jpeg',
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message);
  const { data } = supabase.storage.from('avatars').getPublicUrl(key);
  return data.publicUrl;
}

export function CreateGroupScreen() {
  const nav = useNavigation<Nav>();
  const accessToken = useSessionStore((s) => s.accessToken);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [tz, setTz] = useState(guessTz());
  const [error, setError] = useState<string | null>(null);
  const mut = useCreateGroup();

  const pickAvatar = async () => {
    if (!accessToken) {
      Alert.alert('Sign in required', 'Please sign in again before uploading an avatar.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required to pick an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]?.uri) return;
    try {
      setAvatarUploading(true);
      const publicUrl = await uploadAvatar(result.assets[0].uri, accessToken);
      setAvatarUrl(publicUrl);
    } catch (e) {
      Alert.alert('Upload failed', (e as Error).message);
    } finally {
      setAvatarUploading(false);
    }
  };

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

          <Text style={styles.label}>Avatar (optional)</Text>
          <Pressable
            onPress={pickAvatar}
            style={styles.avatarPicker}
            accessibilityRole="button"
            accessibilityLabel="Pick a group avatar image"
            disabled={avatarUploading}
          >
            {avatarUploading ? (
              <ActivityIndicator color={theme.colors.accent} />
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarPickerText}>Tap to upload</Text>
            )}
          </Pressable>

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
  avatarPicker: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginTop: theme.spacing.xs,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarPickerText: { ...theme.typography.caption, color: theme.colors.textMuted },
});
