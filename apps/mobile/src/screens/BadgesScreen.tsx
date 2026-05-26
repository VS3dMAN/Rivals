import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useBadgesQuery, type BadgeItem } from '../hooks/useBadges';
import { LoadingSkeleton, EmptyState, ErrorState, useBreakpoint } from '@rivals/ui';

const badgeEmojis: Record<string, string> = {
  first_proof: '📸',
  streak_7: '🔥',
  streak_14: '💪',
  streak_30: '🏅',
  streak_90: '👑',
  total_100: '💯',
  total_500: '🌟',
  window_winner: '🏆',
  early_bird: '🐦',
  group_founder: '🏗️',
};

function BadgeCard({ badge }: { badge: BadgeItem }) {
  return (
    <View style={[styles.card, !badge.earned && styles.cardUnearned]}>
      <Text style={styles.emoji}>{badgeEmojis[badge.code] ?? '🎖️'}</Text>
      <Text style={[styles.title, !badge.earned && styles.textMuted]}>{badge.title}</Text>
      <Text style={[styles.desc, !badge.earned && styles.textMuted]}>{badge.description}</Text>
      {badge.earned && badge.awardedAt && (
        <Text style={styles.date}>
          {new Date(badge.awardedAt).toLocaleDateString()}
        </Text>
      )}
    </View>
  );
}

export function BadgesScreen() {
  const q = useBadgesQuery();
  const badges = q.data?.badges ?? [];
  const bp = useBreakpoint();
  const numColumns = bp === 'lg' ? 4 : bp === 'md' ? 3 : 2;
  const earnedIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const earned = new Set(badges.filter((b) => b.earned).map((b) => b.id));
    if (earnedIdsRef.current) {
      const newOnes = [...earned].filter((id) => !earnedIdsRef.current!.has(id));
      if (newOnes.length > 0 && Platform.OS !== 'web') {
        import('expo-haptics')
          .then((H) => H.notificationAsync(H.NotificationFeedbackType.Success))
          .catch(() => void 0);
      }
    }
    earnedIdsRef.current = earned;
  }, [badges]);

  if (q.isPending) {
    return (
      <SafeAreaView style={styles.safe}>
        <LoadingSkeleton variant="grid" count={8} />
      </SafeAreaView>
    );
  }

  if (q.isError) {
    return (
      <SafeAreaView style={styles.safe}>
        <ErrorState title="Couldn't load badges" onRetry={() => q.refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        key={`cols-${numColumns}`}
        data={badges}
        keyExtractor={(b) => b.id}
        numColumns={numColumns}
        renderItem={({ item }) => <BadgeCard badge={item} />}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={{ gap: 12 }}
        ListEmptyComponent={
          <EmptyState icon="🎖️" title="No badges yet" description="Keep going to earn your first badge!" />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  grid: { padding: 16, gap: 12 },
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  cardUnearned: { opacity: 0.4 },
  emoji: { fontSize: 36, marginBottom: 4 },
  title: { ...theme.typography.heading, color: theme.colors.text, fontSize: 14, textAlign: 'center' },
  desc: { ...theme.typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
  textMuted: { color: theme.colors.textMuted },
  date: { ...theme.typography.caption, color: theme.colors.accent, marginTop: 4 },
});
