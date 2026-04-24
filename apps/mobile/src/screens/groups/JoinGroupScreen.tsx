import { useEffect, useState } from 'react';
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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';
import { useJoinGroup } from '../../hooks/useGroups';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'JoinGroup'>;
type Route = RouteProp<GroupsStackParamList, 'JoinGroup'>;

export function JoinGroupScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const [code, setCode] = useState(route.params?.code ?? '');
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ groupId: string; name: string } | null>(null);
  const mut = useJoinGroup();

  useEffect(() => {
    if (route.params?.code) setCode(route.params.code);
  }, [route.params?.code]);

  const submit = async () => {
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{8}$/.test(trimmed)) {
      setError('Invite codes are 8 letters/digits');
      return;
    }
    try {
      const res = await mut.mutateAsync(trimmed);
      setJoined(res);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (joined) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Joined {joined.name}</Text>
          <Text style={styles.body}>You&apos;re in. Open the group to see today&apos;s habits.</Text>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => nav.replace('GroupDashboard', { groupId: joined.groupId })}
          >
            <Text style={styles.btnText}>Open group</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Join a group</Text>
          <Text style={styles.subtitle}>
            Paste the 8-character invite code your admin shared.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="ABCD1234"
            placeholderTextColor={theme.colors.textMuted}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={submit}
            disabled={mut.isPending}
          >
            <Text style={styles.btnText}>{mut.isPending ? 'Joining…' : 'Join'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: { ...theme.typography.body, color: theme.colors.textMuted },
  body: { ...theme.typography.body, color: theme.colors.textMuted },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    letterSpacing: 4,
    fontSize: 22,
    textAlign: 'center',
  },
  btn: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnText: { ...theme.typography.heading, color: '#0B1220' },
  error: { color: theme.colors.danger, ...theme.typography.caption },
});
