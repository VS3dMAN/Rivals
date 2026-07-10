import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LoadingSkeleton, ErrorState } from '@rivals/ui';
import { theme } from '../../theme';
import { CalendarHeatmap } from '../../components/CalendarHeatmap';
import {
  usePersonalHabitsQuery,
  usePersonalHabitStats,
  useUpdatePersonalHabit,
  useDeletePersonalHabit,
  type PersonalHabit,
} from '../../hooks/usePersonalHabits';
import type { PersonalStackParamList } from '../../navigation/PersonalStack';

type Nav = NativeStackNavigationProp<PersonalStackParamList, 'PersonalHabitDetail'>;
type Route = RouteProp<PersonalStackParamList, 'PersonalHabitDetail'>;

function confirmDelete(name: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    // RN Alert is a no-op on web
    if (window.confirm(`Delete "${name}" and all its history? This cannot be undone.`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert('Delete habit', `Delete "${name}" and all its history? This cannot be undone.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EditHabitModal({
  habit,
  visible,
  onClose,
}: {
  habit: PersonalHabit;
  visible: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(habit.name);
  const [description, setDescription] = useState(habit.description ?? '');
  const [graceDays, setGraceDays] = useState(habit.graceDays);
  const [error, setError] = useState<string | null>(null);
  const mut = useUpdatePersonalHabit();

  const submit = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      await mut.mutateAsync({
        habitId: habit.id,
        name: name.trim(),
        description: description.trim() || null,
        graceDays,
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Edit habit</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            maxLength={60}
            placeholder="Habit name"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TextInput
            style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Description (optional)"
            placeholderTextColor={theme.colors.textMuted}
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
            <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={submit}
              disabled={mut.isPending}
            >
              <Text style={styles.btnPrimaryText}>{mut.isPending ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function PersonalHabitDetailScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { habitId } = route.params;
  const [editOpen, setEditOpen] = useState(false);

  const listQ = usePersonalHabitsQuery();
  const statsQ = usePersonalHabitStats(habitId);
  const update = useUpdatePersonalHabit();
  const del = useDeletePersonalHabit();

  const habit = listQ.data?.habits.find((h) => h.id === habitId);

  if (listQ.isPending || statsQ.isPending) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSkeleton variant="card" count={2} />
      </SafeAreaView>
    );
  }

  if (listQ.isError || statsQ.isError || !habit || !statsQ.data) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState
          title="Couldn't load this habit"
          onRetry={() => {
            void listQ.refetch();
            void statsQ.refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  const stats = statsQ.data;

  const onPauseResume = () => {
    update.mutate({ habitId, isActive: !habit.isActive });
  };

  const onDelete = () => {
    confirmDelete(habit.name, () => {
      del.mutate(habitId, { onSuccess: () => nav.goBack() });
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{habit.name}</Text>
            {habit.description ? (
              <Text style={styles.description}>{habit.description}</Text>
            ) : null}
          </View>
          <Pressable
            style={styles.editBtn}
            onPress={() => setEditOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Edit habit"
          >
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <StatCard label="Current Streak" value={`${stats.currentStreak}d`} />
          <StatCard label="Longest Streak" value={`${stats.longestStreak}d`} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Total Days" value={stats.totalLogs} />
          <StatCard label="30d Rate" value={`${stats.completionRate30d}%`} />
        </View>

        <CalendarHeatmap calendar={stats.calendar} />

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={onPauseResume}
            disabled={update.isPending}
            accessibilityRole="button"
          >
            <Text style={styles.btnSecondaryText}>
              {habit.isActive ? 'Pause habit' : 'Resume habit'}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnDanger]}
            onPress={onDelete}
            disabled={del.isPending}
            accessibilityRole="button"
          >
            <Text style={styles.btnDangerText}>{del.isPending ? 'Deleting…' : 'Delete'}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <EditHabitModal
        key={`${habit.id}-${editOpen}`}
        habit={habit}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md },
  title: { ...theme.typography.title, color: theme.colors.text },
  description: { ...theme.typography.body, color: theme.colors.textMuted, marginTop: 4 },
  editBtn: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editBtnText: { color: theme.colors.text },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 28, fontWeight: '700', color: theme.colors.accent },
  statLabel: { ...theme.typography.caption, color: theme.colors.textMuted },
  actions: { gap: theme.spacing.md, marginTop: theme.spacing.md },
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
  btn: {
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: { fontWeight: '700', color: '#0B1220' },
  btnSecondary: { borderWidth: 1, borderColor: theme.colors.border },
  btnSecondaryText: { color: theme.colors.text },
  btnDanger: { borderWidth: 1, borderColor: '#F87171' },
  btnDangerText: { color: '#F87171', fontWeight: '600' },
});
