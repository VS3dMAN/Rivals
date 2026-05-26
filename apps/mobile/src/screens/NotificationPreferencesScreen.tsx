import { View, Text, Switch, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '../theme';
import { api } from '../lib/api';
import type { NotificationPrefs } from '@rivals/shared/zod/notifications';

function useNotifPrefs() {
  return useQuery({
    queryKey: ['notification-prefs'],
    queryFn: () => api<NotificationPrefs>('/me/notification-prefs'),
  });
}

function useUpdateNotifPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) =>
      api('/me/notification-prefs', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });
}

const toggles: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: 'logSubmissions', label: 'Log submissions', description: 'When someone completes a habit' },
  { key: 'streakAtRisk', label: 'Streak at risk', description: 'When your streak is about to break' },
  { key: 'streakMilestones', label: 'Streak milestones', description: 'When you hit 7, 30, 90 day streaks' },
  { key: 'challengeEvents', label: 'Challenge events', description: 'Challenge starts, ends, reminders' },
  { key: 'groupInvites', label: 'Group invites', description: 'When invited to a group' },
  { key: 'adminTransfers', label: 'Admin transfers', description: 'When you become a group admin' },
];

export function NotificationPreferencesScreen() {
  const prefsQ = useNotifPrefs();
  const update = useUpdateNotifPrefs();
  const prefs = prefsQ.data ?? {};

  if (prefsQ.isPending) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Notification types</Text>
        {toggles.map((t) => (
          <View key={t.key} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>{t.label}</Text>
              <Text style={styles.rowDesc}>{t.description}</Text>
            </View>
            <Switch
              value={(prefs as Record<string, unknown>)[t.key] !== false}
              onValueChange={(val) => update.mutate({ [t.key]: val })}
              trackColor={{ true: theme.colors.accent, false: theme.colors.surfaceRaised }}
              thumbColor={theme.colors.text}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  sectionTitle: { ...theme.typography.heading, color: theme.colors.text, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLabel: { ...theme.typography.body, color: theme.colors.text },
  rowDesc: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
});
