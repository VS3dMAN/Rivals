import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation } from '@tanstack/react-query';
import { theme } from '../../theme';
import { api } from '../../lib/api';
import { useSessionStore } from '../../stores/session';
import { ErrorState } from '@rivals/ui';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';

type Route = RouteProp<GroupsStackParamList, 'JoinLanding'>;
type Nav = NativeStackNavigationProp<GroupsStackParamList, 'JoinLanding'>;

interface GroupPreview {
  id: string;
  name: string;
  avatarUrl: string | null;
  memberCount: number;
}

export function JoinLandingScreen() {
  const route = useRoute<Route>();
  const nav = useNavigation<Nav>();
  const { code } = route.params;
  const isLoggedIn = !!useSessionStore((s) => s.accessToken);

  const previewQ = useQuery({
    queryKey: ['invite-preview', code],
    queryFn: () => api<GroupPreview>(`/invites/${code}/preview`),
  });

  const joinMut = useMutation({
    mutationFn: () =>
      api<{ groupId: string }>('/groups/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: code }),
      }),
    onSuccess: (data) => {
      nav.replace('GroupDashboard', { groupId: data.groupId });
    },
  });

  if (previewQ.isPending) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={theme.colors.accent} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (previewQ.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState
          title="Invalid invite"
          description="This invite link is expired or invalid."
          onRetry={() => previewQ.refetch()}
        />
      </SafeAreaView>
    );
  }

  const group = previewQ.data!;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{group.name[0]}</Text>
          </View>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.memberCount}>{group.memberCount} members</Text>
        </View>

        {isLoggedIn ? (
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => joinMut.mutate()}
            disabled={joinMut.isPending}
          >
            <Text style={styles.btnPrimaryText}>
              {joinMut.isPending ? 'Joining...' : 'Join Group'}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.authActions}>
            <Text style={styles.authPrompt}>Sign in to join this group</Text>
            <Pressable style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnPrimaryText}>Sign Up</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnSecondary]}>
              <Text style={styles.btnSecondaryText}>Log In</Text>
            </Pressable>
          </View>
        )}

        {joinMut.isError && (
          <Text style={styles.error}>{(joinMut.error as Error).message}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1, padding: theme.spacing.lg, justifyContent: 'center', gap: theme.spacing.lg },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  avatarText: { fontSize: 36, fontWeight: '700', color: theme.colors.text },
  groupName: { ...theme.typography.title, color: theme.colors.text },
  memberCount: { ...theme.typography.body, color: theme.colors.textMuted },
  authActions: { gap: theme.spacing.sm, alignItems: 'center' },
  authPrompt: { ...theme.typography.body, color: theme.colors.textMuted, marginBottom: 8 },
  btn: { padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center', width: '100%' },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: { ...theme.typography.heading, color: '#0B1220' },
  btnSecondary: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  btnSecondaryText: { ...theme.typography.heading, color: theme.colors.text },
  error: { color: theme.colors.danger, ...theme.typography.caption, textAlign: 'center' },
});
