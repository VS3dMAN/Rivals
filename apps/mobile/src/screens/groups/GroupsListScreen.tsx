import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';
import { useGroupsQuery, type GroupSummary } from '../../hooks/useGroups';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'GroupsList'>;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function GroupRow({ group, onPress }: { group: GroupSummary; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {group.avatarUrl ? (
        <Image source={{ uri: group.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarText}>{initials(group.name)}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {group.name}
          </Text>
          {group.isAdmin ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>ADMIN</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
          {' · '}
          {group.leaderboardMode}
        </Text>
      </View>
    </Pressable>
  );
}

function EmptyState({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>👥</Text>
      <Text style={styles.emptyTitle}>No groups yet</Text>
      <Text style={styles.emptyBody}>
        You&apos;re not in any groups yet — create one or join via an invite link.
      </Text>
      <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onCreate}>
        <Text style={styles.btnPrimaryText}>Create a group</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onJoin}>
        <Text style={styles.btnSecondaryText}>Join via invite link</Text>
      </Pressable>
    </View>
  );
}

export function GroupsListScreen() {
  const nav = useNavigation<Nav>();
  const query = useGroupsQuery();
  const groups = query.data?.groups ?? [];

  if (query.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={groups.length === 0 ? styles.emptyContainer : styles.listContainer}
        data={groups}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <GroupRow
            group={item}
            onPress={() => nav.navigate('GroupDashboard', { groupId: item.id })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            onCreate={() => nav.navigate('CreateGroup')}
            onJoin={() => nav.navigate('JoinGroup', { code: undefined })}
          />
        }
        ListHeaderComponent={
          groups.length > 0 ? (
            <View style={styles.header}>
              <Pressable
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => nav.navigate('CreateGroup')}
              >
                <Text style={styles.btnPrimaryText}>+ New group</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnSecondary]}
                onPress={() => nav.navigate('JoinGroup', { code: undefined })}
              >
                <Text style={styles.btnSecondaryText}>Join with code</Text>
              </Pressable>
            </View>
          ) : null
        }
        refreshing={query.isRefetching}
        onRefresh={() => query.refetch()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContainer: { padding: theme.spacing.md, gap: theme.spacing.sm },
  emptyContainer: { flex: 1, padding: theme.spacing.lg },
  header: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...theme.typography.heading, color: theme.colors.text },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  rowTitle: { ...theme.typography.heading, color: theme.colors.text, flexShrink: 1 },
  rowSub: { ...theme.typography.caption, color: theme.colors.textMuted, marginTop: 2 },
  badge: {
    backgroundColor: theme.colors.accentMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  badgeText: { ...theme.typography.caption, color: '#fff', fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { ...theme.typography.title, color: theme.colors.text },
  emptyBody: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  btn: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    flex: 1,
  },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: { ...theme.typography.heading, color: '#0B1220' },
  btnSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnSecondaryText: { ...theme.typography.heading, color: theme.colors.text },
});
