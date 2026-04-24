import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';
import { useGroupQuery } from '../../hooks/useGroups';
import { useTodayHabitsQuery, useCreateHabit, type TodayHabit } from '../../hooks/useHabits';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'GroupDashboard'>;
type Route = RouteProp<GroupsStackParamList, 'GroupDashboard'>;

function StateChip({ habit }: { habit: TodayHabit }) {
  if (habit.completedToday) {
    return (
      <View style={[styles.chip, styles.chipCompleted]}>
        <Text style={styles.chipText}>Completed</Text>
      </View>
    );
  }
  if (habit.inGrace) {
    return (
      <View style={[styles.chip, styles.chipGrace]}>
        <Text style={styles.chipText}>Grace</Text>
      </View>
    );
  }
  return (
    <View style={[styles.chip, styles.chipPending]}>
      <Text style={styles.chipText}>Pending</Text>
    </View>
  );
}

function HabitCard({ habit }: { habit: TodayHabit }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {habit.name}
        </Text>
        <StateChip habit={habit} />
      </View>
      {habit.description ? (
        <Text style={styles.cardBody} numberOfLines={2}>
          {habit.description}
        </Text>
      ) : null}
      <Pressable
        style={[styles.completeBtn, habit.completedToday && styles.completeBtnDone]}
        disabled={habit.completedToday}
        onPress={() => {
          Alert.alert('Camera integration lands in Phase 3');
        }}
      >
        <Text style={styles.completeBtnText}>
          {habit.completedToday ? 'Done for today' : 'Complete'}
        </Text>
      </Pressable>
    </View>
  );
}

function AddHabitModal({
  visible,
  groupId,
  onClose,
}: {
  visible: boolean;
  groupId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [graceDays, setGraceDays] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mut = useCreateHabit(groupId);

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
          <Text style={styles.modalTitle}>New habit</Text>
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

export function GroupDashboardScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { groupId } = route.params;
  const [modalOpen, setModalOpen] = useState(false);

  const groupQ = useGroupQuery(groupId);
  const habitsQ = useTodayHabitsQuery(groupId);

  const isAdmin = groupQ.data?.isAdmin ?? false;
  const habits = habitsQ.data?.habits ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {groupQ.data?.name ?? 'Group'}
          </Text>
          <Text style={styles.subtitle}>
            {groupQ.data ? `${groupQ.data.members.length} members` : 'Loading…'}
          </Text>
        </View>
        <Pressable
          style={styles.settingsBtn}
          onPress={() => nav.navigate('GroupSettings', { groupId })}
        >
          <Text style={styles.settingsBtnText}>⚙︎</Text>
        </Pressable>
      </View>

      {habitsQ.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={habits}
          keyExtractor={(h) => h.id}
          renderItem={({ item }) => <HabitCard habit={item} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No habits yet</Text>
              <Text style={styles.emptyBody}>
                {isAdmin
                  ? 'Add your first habit to kick things off.'
                  : 'The admin hasn’t added any habits yet.'}
              </Text>
            </View>
          }
          refreshing={habitsQ.isRefetching}
          onRefresh={() => habitsQ.refetch()}
        />
      )}

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.btn,
            isAdmin ? styles.btnPrimary : styles.btnDisabled,
          ]}
          disabled={!isAdmin}
          onPress={() => {
            if (isAdmin) setModalOpen(true);
            else Alert.alert('Only the admin can add habits');
          }}
        >
          <Text style={isAdmin ? styles.btnPrimaryText : styles.btnDisabledText}>
            + Add habit{isAdmin ? '' : ' (admin only)'}
          </Text>
        </Pressable>
      </View>

      <AddHabitModal
        visible={modalOpen}
        groupId={groupId}
        onClose={() => setModalOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: { ...theme.typography.caption, color: theme.colors.textMuted },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  settingsBtnText: { color: theme.colors.text, fontSize: 18 },
  list: { padding: theme.spacing.md, gap: theme.spacing.md },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  cardTitle: { ...theme.typography.heading, color: theme.colors.text, flex: 1 },
  cardBody: { ...theme.typography.body, color: theme.colors.textMuted },
  chip: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
  },
  chipPending: { backgroundColor: theme.colors.surfaceRaised },
  chipGrace: { backgroundColor: theme.colors.accentMuted },
  chipCompleted: { backgroundColor: theme.colors.success },
  chipText: { ...theme.typography.caption, color: '#0B1220', fontWeight: '700' },
  completeBtn: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  completeBtnDone: { backgroundColor: theme.colors.surfaceRaised },
  completeBtnText: { ...theme.typography.heading, color: '#0B1220' },
  footer: { padding: theme.spacing.md },
  btn: { padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: { ...theme.typography.heading, color: '#0B1220' },
  btnSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flex: 1,
  },
  btnSecondaryText: { ...theme.typography.heading, color: theme.colors.text },
  btnDisabled: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnDisabledText: { ...theme.typography.body, color: theme.colors.textMuted },
  empty: { alignItems: 'center', padding: theme.spacing.xl, gap: theme.spacing.sm },
  emptyTitle: { ...theme.typography.heading, color: theme.colors.text },
  emptyBody: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
  },
  modalTitle: { ...theme.typography.title, color: theme.colors.text },
  input: {
    backgroundColor: theme.colors.background,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
  },
  label: { ...theme.typography.caption, color: theme.colors.textMuted },
  graceRow: { flexDirection: 'row', gap: theme.spacing.sm },
  gracePill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  gracePillActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  gracePillText: { color: theme.colors.text, ...theme.typography.body },
  modalActions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  error: { color: theme.colors.danger, ...theme.typography.caption },
});
