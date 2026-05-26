import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { theme } from '../../theme';
import {
  useLeaderboardQuery,
  type LeaderboardEntry,
} from '../../hooks/useLeaderboard';
import { useSessionStore } from '../../stores/session';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';
import { Tooltip } from '../../components/Tooltip';
import { ResponsiveContainer } from '@rivals/ui';

type Route = RouteProp<GroupsStackParamList, 'Leaderboard'>;

// -------- Rank Badge --------

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  if (medal) {
    return (
      <View style={styles.rankBadge}>
        <Text style={styles.medal}>{medal}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.rankBadge, styles.rankBadgeDefault]}>
      <Text style={styles.rankNumber}>{rank}</Text>
    </View>
  );
}

// -------- Countdown Banner --------

function CountdownBanner({
  name,
  endDate,
}: {
  name: string;
  endDate: string;
}) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const end = new Date(`${endDate}T23:59:59`);
      const diff = end.getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Ended');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setRemaining(`${days}d ${hours}h ${mins}m`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [endDate]);

  return (
    <View style={styles.countdownBanner}>
      <Text style={styles.countdownLabel}>⏱️ {name}</Text>
      <Text style={styles.countdownTime}>{remaining}</Text>
    </View>
  );
}

// -------- Mode Pill --------

function ModePill({ mode }: { mode: string }) {
  const label =
    mode === 'streak'
      ? '🔥 Streak'
      : mode === 'total'
        ? '📊 Total'
        : '🏆 Challenge';

  return (
    <View style={styles.modePill}>
      <Text style={styles.modePillText}>{label}</Text>
    </View>
  );
}

// -------- Leaderboard Row --------

function LeaderboardRow({
  entry,
  isCurrentUser,
}: {
  entry: LeaderboardEntry & { rank: number };
  isCurrentUser: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        isCurrentUser && styles.rowHighlighted,
      ]}
    >
      <RankBadge rank={entry.rank} />

      <View style={styles.avatarContainer}>
        {entry.avatarUrl ? (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>
              {entry.displayName[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarText}>
              {entry.displayName[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.nameCol}>
        <View style={styles.nameRow}>
          <Text style={styles.displayName} numberOfLines={1}>
            {entry.displayName}
          </Text>
          {isCurrentUser && (
            <View style={styles.youChip}>
              <Text style={styles.youChipText}>YOU</Text>
            </View>
          )}
        </View>
        <Text style={styles.username}>@{entry.username}</Text>
      </View>

      <View style={styles.scoreCol}>
        <Text style={styles.scoreNumber}>{entry.score}</Text>
        <View style={styles.streakPill}>
          <Text style={styles.streakPillText}>🔥 {entry.currentStreak}</Text>
        </View>
      </View>
    </View>
  );
}

// -------- Empty State --------

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>👥</Text>
      <Text style={styles.emptyTitle}>Waiting for Rivals</Text>
      <Text style={styles.emptyBody}>
        Invite friends to compete — share the group invite code to get started!
      </Text>
    </View>
  );
}

// -------- Main Screen --------

export function LeaderboardScreen() {
  const route = useRoute<Route>();
  const { groupId } = route.params;
  const session = useSessionStore((s) => s.user);
  const selfId = session?.id ?? '';

  const { data, isLoading, refetch, isRefetching } =
    useLeaderboardQuery(groupId);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const mode = data?.mode ?? 'streak';
  const entries = data?.entries ?? [];
  const memberCount = data?.memberCount ?? 0;
  const challengeWindow = data?.challengeWindow;
  const showEmpty = memberCount < 2;

  return (
    <SafeAreaView style={styles.safe}>
      <Tooltip
        id="leaderboard-mode-pill"
        title="Leaderboard mode"
        body="The pill shows which mode this group is in — streak, total, or window. Admins can change it in Group Settings."
      />
      <ResponsiveContainer maxWidth={720}>
      <FlatList
        data={showEmpty ? [] : entries}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={theme.colors.accent}
            colors={[theme.colors.accent]}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.headerTitle}>Leaderboard</Text>
              <ModePill mode={mode} />
            </View>
            {mode === 'window' && challengeWindow && (
              <CountdownBanner
                name={challengeWindow.name}
                endDate={challengeWindow.endDate}
              />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <LeaderboardRow
            entry={item}
            isCurrentUser={item.userId === selfId}
          />
        )}
        ListEmptyComponent={showEmpty ? <EmptyState /> : null}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.sm }} />}
      />
      </ResponsiveContainer>
    </SafeAreaView>
  );
}

// -------- Styles --------

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: theme.spacing.lg, paddingBottom: 100 },

  // Header
  header: { marginBottom: theme.spacing.lg },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  headerTitle: { ...theme.typography.title, color: theme.colors.text },

  // Mode pill
  modePill: {
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modePillText: { ...theme.typography.caption, color: theme.colors.accent },

  // Countdown
  countdownBanner: {
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  countdownLabel: { ...theme.typography.body, color: theme.colors.text },
  countdownTime: {
    ...theme.typography.heading,
    color: theme.colors.accent,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  rowHighlighted: {
    borderColor: theme.colors.accent,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },

  // Rank
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeDefault: {
    backgroundColor: theme.colors.surfaceRaised,
  },
  medal: { fontSize: 22 },
  rankNumber: { ...theme.typography.heading, color: theme.colors.textMuted },

  // Avatar
  avatarContainer: { width: 44, height: 44 },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...theme.typography.heading, color: theme.colors.text },

  // Name
  nameCol: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  displayName: { ...theme.typography.body, color: theme.colors.text },
  username: { ...theme.typography.caption, color: theme.colors.textMuted },

  // YOU chip
  youChip: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  youChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0B1220',
  },

  // Score
  scoreCol: { alignItems: 'flex-end', gap: 4 },
  scoreNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  streakPill: {
    backgroundColor: theme.colors.surfaceRaised,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  streakPillText: { fontSize: 12, color: theme.colors.accent },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: theme.spacing.md,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { ...theme.typography.title, color: theme.colors.text },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
});
