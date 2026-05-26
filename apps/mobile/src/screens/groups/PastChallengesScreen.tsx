import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { theme } from '../../theme';
import {
  useChallengesQuery,
  useCreateChallenge,
  type ChallengeWindow,
} from '../../hooks/useLeaderboard';
import { useSessionStore } from '../../stores/session';
import { useGroupQuery } from '../../hooks/useGroups';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';

type Route = RouteProp<GroupsStackParamList, 'PastChallenges'>;

function statusColor(status: string) {
  switch (status) {
    case 'active':
      return theme.colors.success;
    case 'upcoming':
      return theme.colors.accent;
    case 'completed':
      return theme.colors.textMuted;
    default:
      return theme.colors.textMuted;
  }
}

function ChallengeRow({ item }: { item: ChallengeWindow }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{item.name}</Text>
        <View style={[styles.statusPill, { borderColor: statusColor(item.status) }]}>
          <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.dateRange}>
        {item.startDate} → {item.endDate}
      </Text>
      {item.status === 'completed' && item.winnerUserId && (
        <Text style={styles.winner}>🏆 Winner declared</Text>
      )}
    </View>
  );
}

export function PastChallengesScreen() {
  const route = useRoute<Route>();
  const { groupId } = route.params;
  const session = useSessionStore((s) => s.user);

  const groupQ = useGroupQuery(groupId);
  const challengesQ = useChallengesQuery(groupId);
  const createChallenge = useCreateChallenge(groupId);
  const isAdmin = groupQ.data?.isAdmin ?? false;

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const challenges = challengesQ.data?.challenges ?? [];

  const handleCreate = async () => {
    if (!name || !startDate || !endDate) {
      Alert.alert('Missing fields', 'Fill in all fields to create a challenge.');
      return;
    }
    try {
      await createChallenge.mutateAsync({ name, startDate, endDate });
      setShowCreate(false);
      setName('');
      setStartDate('');
      setEndDate('');
      Alert.alert('Challenge created!', 'It will activate on the start date.');
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  if (challengesQ.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={challenges}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Challenges</Text>
            {isAdmin && (
              <Pressable
                style={styles.createBtn}
                onPress={() => setShowCreate(!showCreate)}
              >
                <Text style={styles.createBtnText}>
                  {showCreate ? 'Cancel' : '+ New'}
                </Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => <ChallengeRow item={item} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyTitle}>No challenges yet</Text>
            {isAdmin && (
              <Text style={styles.emptyBody}>
                Create a time-boxed challenge to compete!
              </Text>
            )}
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
      />

      {showCreate && (
        <View style={styles.createForm}>
          <Text style={styles.formTitle}>Create Challenge</Text>
          <TextInput
            style={styles.input}
            placeholder="Challenge name"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={styles.input}
            placeholder="Start date (YYYY-MM-DD)"
            placeholderTextColor={theme.colors.textMuted}
            value={startDate}
            onChangeText={setStartDate}
          />
          <TextInput
            style={styles.input}
            placeholder="End date (YYYY-MM-DD)"
            placeholderTextColor={theme.colors.textMuted}
            value={endDate}
            onChangeText={setEndDate}
          />
          <Pressable
            style={styles.submitBtn}
            onPress={handleCreate}
            disabled={createChallenge.isPending}
          >
            <Text style={styles.submitBtnText}>
              {createChallenge.isPending ? 'Creating…' : 'Create Challenge'}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: theme.spacing.lg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: { ...theme.typography.title, color: theme.colors.text },
  createBtn: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  createBtnText: {
    ...theme.typography.caption,
    fontWeight: '700',
    color: '#0B1220',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: { ...theme.typography.heading, color: theme.colors.text },
  statusPill: {
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  dateRange: { ...theme.typography.caption, color: theme.colors.textMuted },
  winner: { ...theme.typography.body, color: theme.colors.accent },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: theme.spacing.md,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { ...theme.typography.heading, color: theme.colors.text },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },

  // Create form
  createForm: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
  },
  formTitle: { ...theme.typography.heading, color: theme.colors.text },
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
  },
  submitBtn: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  submitBtnText: {
    ...theme.typography.heading,
    color: '#0B1220',
  },
});
