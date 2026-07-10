import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { LoadingSkeleton, ErrorState, EmptyState } from '@rivals/ui';
import { theme } from '../../theme';
import {
  usePersonalHabitsQuery,
  useCreatePersonalHabit,
  useCompletePersonalHabit,
  useUncompletePersonalHabit,
  type PersonalHabit,
} from '../../hooks/usePersonalHabits';
import { track } from '../../lib/analytics';
import type { PersonalStackParamList } from '../../navigation/PersonalStack';

type Nav = NativeStackNavigationProp<PersonalStackParamList, 'MyHabits'>;

function buzz() {
  if (Platform.OS !== 'web') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
}

function HabitCard({
  habit,
  onToggle,
  onOpen,
  busy,
}: {
  habit: PersonalHabit;
  onToggle: (habit: PersonalHabit) => void;
  onOpen: (habit: PersonalHabit) => void;
  busy: boolean;
}) {
  const streakLine =
    habit.currentStreak > 0
      ? `🔥 ${habit.currentStreak} day streak · best ${habit.longestStreak}`
      : habit.longestStreak > 0
        ? `best ${habit.longestStreak} days`
        : 'No streak yet — start today';

  return (
    <Pressable
      style={[styles.card, !habit.isActive && styles.cardPaused]}
      onPress={() => onOpen(habit)}
      accessibilityRole="button"
      accessibilityLabel={`${habit.name}, ${
        habit.completedToday ? 'completed today' : 'not completed today'
      }`}
    >
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{habit.name}</Text>
        {habit.description ? (
          <Text style={styles.cardDescription} numberOfLines={1}>
            {habit.description}
          </Text>
        ) : null}
        <Text style={styles.cardStreak}>
          {habit.isActive ? streakLine : 'Paused'}
          {habit.inGrace ? '  ·  ⏳ grace' : ''}
        </Text>
      </View>
      {habit.isActive ? (
        <Pressable
          style={[styles.checkBtn, habit.completedToday && styles.checkBtnDone]}
          onPress={() => onToggle(habit)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={
            habit.completedToday ? `Undo ${habit.name}` : `Complete ${habit.name}`
          }
        >
          <Text style={[styles.checkText, habit.completedToday && styles.checkTextDone]}>
            {habit.completedToday ? '✓' : '○'}
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function AddPersonalHabitModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [graceDays, setGraceDays] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mut = useCreatePersonalHabit();

  const reset = () => {
    setName('');
    setDescription('');
    setGraceDays(0);
    setError(null);
  };

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await mut.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        graceDays,
      });
      track('personal_habit_created', { graceDays });
      reset();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>New personal habit</Text>
          <TextInput
            style={styles.input}
            placeholder="Habit name"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={60}
          />
          <TextInput
            style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Description (optional)"
            placeholderTextColor={theme.colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Text style={styles.label}>Grace days: {graceDays}</Text>
          <View style={styles.graceRow}>
            {[0, 1, 2].map((g) => (
              <Pressable
                key={g}
                style={[styles.gracePill, graceDays === g && styles.gracePillActive]}
                onPress={() => setGraceDays(g)}
              >
                <Text style={styles.gracePillText}>{g}</Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => {
                reset();
                onClose();
              }}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={submit}
              disabled={mut.isPending}
            >
              <Text style={styles.btnPrimaryText}>
                {mut.isPending ? 'Adding…' : 'Add habit'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function MyHabitsScreen() {
  const nav = useNavigation<Nav>();
  const [modalOpen, setModalOpen] = useState(false);
  const q = usePersonalHabitsQuery();
  const complete = useCompletePersonalHabit();
  const uncomplete = useUncompletePersonalHabit();

  const habits = q.data?.habits ?? [];
  const active = habits.filter((h) => h.isActive);
  const paused = habits.filter((h) => !h.isActive);
  const doneCount = active.filter((h) => h.completedToday).length;

  const onToggle = (habit: PersonalHabit) => {
    if (habit.completedToday) {
      uncomplete.mutate(habit.id);
    } else {
      buzz();
      track('personal_habit_completed', { habitId: habit.id });
      complete.mutate(habit.id);
    }
  };

  const onOpen = (habit: PersonalHabit) => {
    nav.navigate('PersonalHabitDetail', { habitId: habit.id, name: habit.name });
  };

  if (q.isPending) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSkeleton variant="card" count={3} />
      </SafeAreaView>
    );
  }

  if (q.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState title="Couldn't load your habits" onRetry={() => q.refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={[...active, ...paused]}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subtitle}>
                {active.length > 0
                  ? `${doneCount} of ${active.length} done today`
                  : 'Private — only you can see these'}
              </Text>
            </View>
            <Pressable
              style={styles.addBtn}
              onPress={() => setModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Add personal habit"
            >
              <Text style={styles.addBtnText}>+ New</Text>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="🌱"
            title="No personal habits yet"
            description="This space is just for you — no proof photos, no leaderboard. Add a habit and check it off each day."
          />
        }
        renderItem={({ item }) => (
          <HabitCard
            habit={item}
            onToggle={onToggle}
            onOpen={onOpen}
            busy={complete.isPending || uncomplete.isPending}
          />
        )}
      />
      <AddPersonalHabitModal visible={modalOpen} onClose={() => setModalOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  subtitle: { ...theme.typography.body, color: theme.colors.textMuted },
  addBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { fontWeight: '700', color: '#0B1220' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  cardPaused: { opacity: 0.55 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: { ...theme.typography.heading, color: theme.colors.text },
  cardDescription: { ...theme.typography.caption, color: theme.colors.textMuted },
  cardStreak: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
  checkBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnDone: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkText: { fontSize: 20, color: theme.colors.textMuted },
  checkTextDone: { color: '#0B1220', fontWeight: '700' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.md,
    borderTopRightRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  modalTitle: { ...theme.typography.heading, color: theme.colors.text },
  input: {
    backgroundColor: theme.colors.surfaceRaised,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    padding: 12,
  },
  label: { ...theme.typography.caption, color: theme.colors.textMuted },
  graceRow: { flexDirection: 'row', gap: 8 },
  gracePill: {
    width: 40,
    height: 32,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gracePillActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  gracePillText: { color: theme.colors.text },
  error: { color: '#F87171' },
  modalActions: { flexDirection: 'row', gap: theme.spacing.md, justifyContent: 'flex-end' },
  btn: { borderRadius: theme.radius.md, paddingHorizontal: 16, paddingVertical: 10 },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: { fontWeight: '700', color: '#0B1220' },
  btnSecondary: { borderWidth: 1, borderColor: theme.colors.border },
  btnSecondaryText: { color: theme.colors.text },
});
