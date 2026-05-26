import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { theme } from '../../theme';
import { useFeedQuery } from '../../hooks/useFeed';
import { FullScreenProofViewer } from '../../components/feed/FullScreenProofViewer';
import { LoadingSkeleton, EmptyState, ErrorState, useBreakpoint, ResponsiveContainer } from '@rivals/ui';
import type { FeedItem } from '@rivals/shared/zod/feed';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';

type Route = RouteProp<GroupsStackParamList, 'Feed'>;

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

function LogCard({
  item,
  onPhotoPress,
}: {
  item: FeedItem;
  onPhotoPress: (url: string) => void;
}) {
  const payload = item.payload as { habitName?: string; photoUrl?: string };
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          {item.actor.avatarUrl ? (
            <Image source={{ uri: item.actor.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{item.actor.displayName[0]}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actorName}>{item.actor.displayName}</Text>
          <Text style={styles.cardCaption}>
            completed {payload.habitName ?? 'a habit'} · {timeAgo(item.createdAt)}
          </Text>
        </View>
      </View>
      {payload.photoUrl && (
        <Pressable onPress={() => onPhotoPress(payload.photoUrl!)}>
          <Image source={{ uri: payload.photoUrl }} style={styles.proofImage} resizeMode="cover" />
        </Pressable>
      )}
    </View>
  );
}

function MilestoneCard({ item }: { item: FeedItem }) {
  const payload = item.payload as { streak?: number };
  return (
    <View style={[styles.card, styles.milestoneCard]}>
      <Text style={styles.milestoneEmoji}>🔥</Text>
      <Text style={styles.milestoneText}>
        {item.actor.displayName} hit a {payload.streak ?? '?'}-day streak!
      </Text>
      <Text style={styles.cardCaption}>{timeAgo(item.createdAt)}</Text>
    </View>
  );
}

function BadgeCard({ item }: { item: FeedItem }) {
  const payload = item.payload as { badgeCode?: string; badgeTitle?: string };
  return (
    <View style={[styles.card, styles.milestoneCard]}>
      <Text style={styles.milestoneEmoji}>🏅</Text>
      <Text style={styles.milestoneText}>
        {item.actor.displayName} earned "{payload.badgeTitle ?? payload.badgeCode}"
      </Text>
      <Text style={styles.cardCaption}>{timeAgo(item.createdAt)}</Text>
    </View>
  );
}

function SimpleEventCard({ item, emoji, verb }: { item: FeedItem; emoji: string; verb: string }) {
  return (
    <View style={[styles.card, styles.simpleCard]}>
      <Text style={styles.simpleText}>
        {emoji} {item.actor.displayName} {verb}
      </Text>
      <Text style={styles.cardCaption}>{timeAgo(item.createdAt)}</Text>
    </View>
  );
}

function FeedCard({
  item,
  onPhotoPress,
}: {
  item: FeedItem;
  onPhotoPress: (url: string) => void;
}) {
  switch (item.kind) {
    case 'log':
      return <LogCard item={item} onPhotoPress={onPhotoPress} />;
    case 'streak_milestone':
      return <MilestoneCard item={item} />;
    case 'badge':
      return <BadgeCard item={item} />;
    case 'join':
      return <SimpleEventCard item={item} emoji="👋" verb="joined the group" />;
    case 'leave':
      return <SimpleEventCard item={item} emoji="👋" verb="left the group" />;
    case 'window_start':
      return <SimpleEventCard item={item} emoji="🏁" verb="started a challenge" />;
    case 'window_end':
      return <SimpleEventCard item={item} emoji="🏆" verb="completed a challenge" />;
    default:
      return null;
  }
}

export function FeedScreen() {
  const route = useRoute<Route>();
  const { groupId } = route.params;
  const feedQ = useFeedQuery(groupId);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const bp = useBreakpoint();
  const numColumns = bp === 'lg' ? 3 : bp === 'md' ? 2 : 1;

  const allItems = feedQ.data?.pages.flatMap((p) => p.items) ?? [];

  const handleEndReached = useCallback(() => {
    if (feedQ.hasNextPage && !feedQ.isFetchingNextPage) {
      feedQ.fetchNextPage();
    }
  }, [feedQ]);

  if (feedQ.isPending) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSkeleton variant="card" count={3} />
      </SafeAreaView>
    );
  }

  if (feedQ.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState
          title="Couldn't load feed"
          description={(feedQ.error as Error).message}
          onRetry={() => feedQ.refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ResponsiveContainer maxWidth={1200}>
      <FlatList
        key={`cols-${numColumns}`}
        data={allItems}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? { gap: 12 } : undefined}
        renderItem={({ item }) => (
          <View style={numColumns > 1 ? { flex: 1 } : undefined}>
            <FeedCard item={item} onPhotoPress={setViewerUrl} />
          </View>
        )}
        contentContainerStyle={styles.list}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={feedQ.isRefetching && !feedQ.isFetchingNextPage}
            onRefresh={() => feedQ.refetch()}
            tintColor={theme.colors.accent}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="📰"
            title="No activity yet"
            description="Complete a habit to create the first feed event."
          />
        }
        ListFooterComponent={
          feedQ.isFetchingNextPage ? (
            <ActivityIndicator color={theme.colors.accent} style={{ padding: 16 }} />
          ) : null
        }
      />
      </ResponsiveContainer>
      <FullScreenProofViewer
        visible={!!viewerUrl}
        photoUrl={viewerUrl}
        onClose={() => setViewerUrl(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 40, height: 40 },
  avatarText: { color: theme.colors.accent, fontSize: 16, fontWeight: '700' },
  actorName: { ...theme.typography.heading, color: theme.colors.text, fontSize: 15 },
  cardCaption: { ...theme.typography.caption, color: theme.colors.textMuted },
  proofImage: { width: '100%', height: 240, borderRadius: theme.radius.sm },
  milestoneCard: { alignItems: 'center', paddingVertical: 20 },
  milestoneEmoji: { fontSize: 36 },
  milestoneText: {
    ...theme.typography.heading,
    color: theme.colors.text,
    textAlign: 'center',
    fontSize: 16,
  },
  simpleCard: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  simpleText: { ...theme.typography.body, color: theme.colors.text },
});
