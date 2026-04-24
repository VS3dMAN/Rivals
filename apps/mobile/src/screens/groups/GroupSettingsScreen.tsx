import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../../theme';
import {
  useGroupQuery,
  useInviteByUsername,
  useLeaveGroup,
  useRegenerateInvite,
  useRemoveMember,
  useTransferAdmin,
  useUserSearch,
  type GroupMember,
} from '../../hooks/useGroups';
import { useSessionStore } from '../../stores/session';
import type { GroupsStackParamList } from '../../navigation/GroupsStack';

type Nav = NativeStackNavigationProp<GroupsStackParamList, 'GroupSettings'>;
type Route = RouteProp<GroupsStackParamList, 'GroupSettings'>;

function MemberRow({
  member,
  isAdmin,
  isSelf,
  groupId,
}: {
  member: GroupMember;
  isAdmin: boolean;
  isSelf: boolean;
  groupId: string;
}) {
  const remove = useRemoveMember(groupId);
  const transfer = useTransferAdmin(groupId);

  const onMenu = () => {
    if (!isAdmin || isSelf) return;
    Alert.alert(
      `@${member.username}`,
      undefined,
      [
        {
          text: 'Make admin',
          onPress: () =>
            transfer
              .mutateAsync(member.userId)
              .catch((e: Error) => Alert.alert('Transfer failed', e.message)),
        },
        {
          text: 'Remove from group',
          style: 'destructive',
          onPress: () =>
            remove
              .mutateAsync(member.userId)
              .catch((e: Error) => Alert.alert('Remove failed', e.message)),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  return (
    <Pressable style={styles.memberRow} onPress={onMenu} disabled={!isAdmin || isSelf}>
      <View style={styles.avatarFallback}>
        <Text style={styles.avatarText}>
          {member.displayName[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.memberName}>
          {member.displayName}
          {isSelf ? ' (you)' : ''}
        </Text>
        <Text style={styles.memberHandle}>@{member.username}</Text>
      </View>
      {member.role === 'admin' ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>ADMIN</Text>
        </View>
      ) : isAdmin && !isSelf ? (
        <Text style={styles.kebab}>⋯</Text>
      ) : null}
    </Pressable>
  );
}

function InviteModal({
  visible,
  groupId,
  onClose,
}: {
  visible: boolean;
  groupId: string;
  onClose: () => void;
}) {
  const [prefix, setPrefix] = useState('');
  const search = useUserSearch(prefix);
  const invite = useInviteByUsername(groupId);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Invite by username</Text>
          <TextInput
            style={styles.input}
            placeholder="@username"
            placeholderTextColor={theme.colors.textMuted}
            value={prefix}
            onChangeText={(t) => setPrefix(t.toLowerCase().replace(/^@/, ''))}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <FlatList
            style={{ maxHeight: 260 }}
            data={search.data?.users ?? []}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => (
              <Pressable
                style={styles.searchResult}
                onPress={async () => {
                  try {
                    await invite.mutateAsync(item.username);
                    Alert.alert('Invited', `@${item.username} has been invited.`);
                    setPrefix('');
                    onClose();
                  } catch (e) {
                    Alert.alert('Invite failed', (e as Error).message);
                  }
                }}
              >
                <Text style={styles.memberName}>{item.displayName}</Text>
                <Text style={styles.memberHandle}>@{item.username}</Text>
              </Pressable>
            )}
            ListEmptyComponent={
              prefix.length >= 2 ? (
                <Text style={styles.dim}>No matches</Text>
              ) : (
                <Text style={styles.dim}>Type at least 2 characters</Text>
              )
            }
          />
          <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onClose}>
            <Text style={styles.btnSecondaryText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function GroupSettingsScreen() {
  const nav = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { groupId } = route.params;
  const session = useSessionStore((s) => s.user);

  const groupQ = useGroupQuery(groupId);
  const regen = useRegenerateInvite(groupId);
  const leave = useLeaveGroup(groupId);
  const [inviteOpen, setInviteOpen] = useState(false);

  const group = groupQ.data;
  const selfId = session?.id ?? '';
  const isAdmin = group?.isAdmin ?? false;

  if (groupQ.isLoading || !group) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const inviteLink = `https://rivals.app/join/${group.inviteCode}`;

  const doShareInvite = async () => {
    try {
      await Share.share({
        message: `Join ${group.name} on Rivals: ${inviteLink}`,
      });
    } catch {
      // ignore
    }
  };

  const doLeave = () => {
    Alert.alert('Leave group?', 'You can rejoin later via invite.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leave.mutateAsync();
            nav.popToTop();
          } catch (e) {
            Alert.alert('Could not leave', (e as Error).message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.list}
        data={group.members}
        keyExtractor={(m) => m.userId}
        renderItem={({ item }) => (
          <MemberRow
            member={item}
            isAdmin={isAdmin}
            isSelf={item.userId === selfId}
            groupId={groupId}
          />
        )}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
            <Text style={styles.title}>{group.name}</Text>
            {group.description ? (
              <Text style={styles.body}>{group.description}</Text>
            ) : null}

            <View style={styles.inviteCard}>
              <Text style={styles.label}>Invite code</Text>
              <Text style={styles.inviteCode}>{group.inviteCode}</Text>
              <Text style={styles.inviteLink}>{inviteLink}</Text>
              <View style={styles.row}>
                <Pressable style={[styles.btn, styles.btnSecondary]} onPress={doShareInvite}>
                  <Text style={styles.btnSecondaryText}>Share</Text>
                </Pressable>
                {isAdmin ? (
                  <Pressable
                    style={[styles.btn, styles.btnSecondary]}
                    onPress={() =>
                      regen
                        .mutateAsync()
                        .catch((e: Error) => Alert.alert('Failed', e.message))
                    }
                    disabled={regen.isPending}
                  >
                    <Text style={styles.btnSecondaryText}>
                      {regen.isPending ? 'Regenerating…' : 'Regenerate'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              {isAdmin ? (
                <Pressable
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => setInviteOpen(true)}
                >
                  <Text style={styles.btnPrimaryText}>Invite by username</Text>
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.sectionTitle}>
              Members ({group.members.length})
            </Text>
          </View>
        }
        ListFooterComponent={
          <Pressable style={[styles.btn, styles.btnDanger]} onPress={doLeave}>
            <Text style={styles.btnDangerText}>Leave group</Text>
          </Pressable>
        }
      />
      <InviteModal
        visible={inviteOpen}
        groupId={groupId}
        onClose={() => setInviteOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  title: { ...theme.typography.title, color: theme.colors.text },
  body: { ...theme.typography.body, color: theme.colors.textMuted },
  sectionTitle: { ...theme.typography.heading, color: theme.colors.text },
  inviteCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  label: { ...theme.typography.caption, color: theme.colors.textMuted },
  inviteCode: {
    ...theme.typography.title,
    color: theme.colors.accent,
    letterSpacing: 4,
    textAlign: 'center',
  },
  inviteLink: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...theme.typography.heading, color: theme.colors.text },
  memberName: { ...theme.typography.body, color: theme.colors.text },
  memberHandle: { ...theme.typography.caption, color: theme.colors.textMuted },
  badge: {
    backgroundColor: theme.colors.accentMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  badgeText: { ...theme.typography.caption, color: '#fff', fontWeight: '700' },
  kebab: { color: theme.colors.textMuted, fontSize: 22, paddingHorizontal: 4 },
  btn: { padding: theme.spacing.md, borderRadius: theme.radius.md, alignItems: 'center', flex: 1 },
  btnPrimary: { backgroundColor: theme.colors.accent },
  btnPrimaryText: { ...theme.typography.heading, color: '#0B1220' },
  btnSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnSecondaryText: { ...theme.typography.heading, color: theme.colors.text },
  btnDanger: { backgroundColor: theme.colors.danger, marginTop: theme.spacing.lg },
  btnDangerText: { ...theme.typography.heading, color: '#fff' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
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
  searchResult: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  dim: {
    ...theme.typography.caption,
    color: theme.colors.textMuted,
    textAlign: 'center',
    padding: theme.spacing.md,
  },
});
