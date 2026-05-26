import { useCallback } from 'react';
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
import { theme } from '../theme';
import {
  useNotificationsQuery,
  useMarkRead,
  useMarkAllRead,
  type NotificationItem,
} from '../hooks/useNotifications';
import { LoadingSkeleton, EmptyState, ErrorState } from '@rivals/ui';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const kindEmoji: Record<string, string> = {
  group_activity: '📸',
  milestone: '🔥',
  streak_at_risk: '⚠️',
  daily_reminder: '⏰',
  challenge_start: '🏁',
  challenge_end: '🏆',
  member_join: '👋',
  admin_transfer: '👑',
};

function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItem;
  onPress: () => void;
}) {
  const payload = item.payload as { title?: string; body?: string };
  const isUnread = !item.readAt;

  return (
    <Pressable
      style={[styles.row, isUnread && styles.rowUnread]}
      onPress={onPress}
    >
      <Text style={styles.rowEmoji}>{kindEmoji[item.kind] ?? '🔔'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {payload.title ?? item.kind}
        </Text>
        {payload.body ? (
          <Text style={styles.rowBody} numberOfLines={2}>
            {payload.body}
          </Text>
        ) : null}
        <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
      </View>
      {isUnread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

export function NotificationsScreen() {
  const q = useNotificationsQuery();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();

  const allItems = q.data?.pages.flatMap((p) => p.items) ?? [];

  const handleEndReached = useCallback(() => {
    if (q.hasNextPage && !q.isFetchingNextPage) {
      q.fetchNextPage();
    }
  }, [q]);

  if (q.isPending) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSkeleton variant="list" count={6} />
      </SafeAreaView>
    );
  }

  if (q.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState
          title="Couldn't load notifications"
          onRetry={() => q.refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {allItems.some((i) => !i.readAt) && (
        <Pressable
          style={styles.markAllBtn}
          onPress={() => markAll.mutate()}
          disabled={markAll.isPending}
        >
          <Text style={styles.markAllText}>Mark all as read</Text>
        </Pressable>
      )}
      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            onPress={() => {
              if (!item.readAt) markRead.mutate(item.id);
            }}
          />
        )}
        contentContainerStyle={styles.list}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => q.refetch()}
            tintColor={theme.colors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="🔔"
            title="No notifications"
            description="You'll see updates from your groups here."
          />
        }
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <ActivityIndicator color={theme.colors.accent} style={{ padding: 16 }} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  list: { gap: 1 },
  markAllBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  markAllText: { ...theme.typography.caption, color: theme.colors.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowUnread: { backgroundColor: theme.colors.surfaceRaised },
  rowEmoji: { fontSize: 24, width: 36, textAlign: 'center' },
  rowTitle: { ...theme.typography.heading, color: theme.colors.text, fontSize: 15 },
  rowBody: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
  rowTime: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
  },
});
