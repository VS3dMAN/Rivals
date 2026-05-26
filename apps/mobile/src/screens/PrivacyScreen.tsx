import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Linking, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { theme } from '../theme';
import { api } from '../lib/api';
import { clearSession } from '../lib/session';
import { useSessionStore } from '../stores/session';

interface ExportJob {
  id: string;
  status: 'queued' | 'processing' | 'ready' | 'failed' | 'expired';
  signedUrl: string | null;
  urlExpiresAt: string | null;
  requestedAt: string;
  completedAt: string | null;
  error: string | null;
}

export function PrivacyScreen() {
  const queryClient = useQueryClient();
  const clear = useSessionStore((s) => s.clear);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const requestExport = useMutation({
    mutationFn: () => api<{ id: string; status: string }>('/me/export', { method: 'POST' }),
    onSuccess: (data) => {
      setActiveJobId(data.id);
      queryClient.invalidateQueries({ queryKey: ['export-job'] });
    },
    onError: (e) => Alert.alert('Export failed', (e as Error).message),
  });

  const exportQuery = useQuery({
    queryKey: ['export-job', activeJobId],
    queryFn: () => api<ExportJob>(`/me/export/${activeJobId}`),
    enabled: !!activeJobId,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'queued' || s === 'processing' ? 5000 : false;
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => api('/me', { method: 'DELETE' }),
    onSuccess: async () => {
      await clearSession();
      queryClient.clear();
      clear();
    },
    onError: (e) => Alert.alert('Deletion failed', (e as Error).message),
  });

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your profile, logs, and photos. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteAccount.mutate() },
      ],
    );
  };

  const job = exportQuery.data;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Privacy & data</Text>

        <Text style={styles.section}>Your data</Text>
        <Text style={styles.body}>
          Request a copy of everything we have on your account: profile, group memberships,
          habit logs, badges, and notification history.
        </Text>
        <Pressable
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => requestExport.mutate()}
          disabled={requestExport.isPending || job?.status === 'queued' || job?.status === 'processing'}
          accessibilityRole="button"
          accessibilityLabel="Request data export"
        >
          <Text style={styles.btnText}>
            {requestExport.isPending ? 'Requesting…' : 'Request data export'}
          </Text>
        </Pressable>

        {job && (
          <View style={styles.jobBox}>
            <Text style={styles.label}>Status: {job.status}</Text>
            {job.status === 'ready' && job.signedUrl && (
              <Pressable
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => Linking.openURL(job.signedUrl!)}
                accessibilityRole="link"
              >
                <Text style={styles.btnSecondaryText}>Download export</Text>
              </Pressable>
            )}
            {job.status === 'failed' && (
              <Text style={styles.error}>{job.error ?? 'Export failed.'}</Text>
            )}
          </View>
        )}

        <Text style={styles.section}>Delete account</Text>
        <Text style={styles.body}>
          Permanently removes your profile, anonymises your logs, and purges your photos.
          This action cannot be undone.
        </Text>
        <Pressable
          style={[styles.btn, styles.btnDanger]}
          onPress={confirmDelete}
          disabled={deleteAccount.isPending}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
        >
          <Text style={styles.btnText}>
            {deleteAccount.isPending ? 'Deleting…' : 'Delete my account'}
          </Text>
        </Pressable>

        <Text style={styles.section}>Legal</Text>
        <Pressable onPress={() => Linking.openURL('https://rivals.app/privacy')}>
          <Text style={styles.link}>Privacy policy</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL('https://rivals.app/terms')}>
          <Text style={styles.link}>Terms of service</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { ...theme.typography.title, color: theme.colors.text },
  section: { ...theme.typography.heading, color: theme.colors.text, marginTop: theme.spacing.lg },
  body: { ...theme.typography.body, color: theme.colors.textMuted },
  label: { ...theme.typography.body, color: theme.colors.text },
  error: { ...theme.typography.body, color: theme.colors.danger },
  link: { ...theme.typography.body, color: theme.colors.accent, paddingVertical: theme.spacing.xs },
  jobBox: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  btn: { padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center' },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnSecondaryText: { ...theme.typography.heading, color: theme.colors.text },
  btnDanger: { backgroundColor: theme.colors.danger, marginTop: theme.spacing.sm },
  btnText: { ...theme.typography.heading, color: '#0B1220' },
});
