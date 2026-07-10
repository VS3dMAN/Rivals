import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { theme } from '../theme';
import { useStatsQuery } from '../hooks/useStats';
import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { LoadingSkeleton, ErrorState, EmptyState } from '@rivals/ui';

type Route = RouteProp<{ Stats: { groupId: string } }, 'Stats'>;

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function PersonalStatsScreen() {
  const route = useRoute<Route>();
  const { groupId } = route.params;
  const q = useStatsQuery(groupId);

  if (q.isPending) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSkeleton variant="card" count={2} />
      </SafeAreaView>
    );
  }

  if (q.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState title="Couldn't load stats" onRetry={() => q.refetch()} />
      </SafeAreaView>
    );
  }

  if (!q.data) {
    return (
      <SafeAreaView style={styles.safe}>
        <EmptyState icon="📊" title="No stats yet" description="Complete habits to see your stats." />
      </SafeAreaView>
    );
  }

  const { currentStreak, longestStreak, totalLogs, completionRate30d, calendar } = q.data;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your Stats</Text>

        <View style={styles.statsRow}>
          <StatCard label="Current Streak" value={`${currentStreak}d`} />
          <StatCard label="Longest Streak" value={`${longestStreak}d`} />
        </View>
        <View style={styles.statsRow}>
          <StatCard label="Total Logs" value={totalLogs} />
          <StatCard label="30d Rate" value={`${completionRate30d}%`} />
        </View>

        <CalendarHeatmap calendar={calendar} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { ...theme.typography.title, color: theme.colors.text },
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
});
