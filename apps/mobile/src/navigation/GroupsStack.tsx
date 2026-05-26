import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { GroupsListScreen } from '../screens/groups/GroupsListScreen';
import { GroupDashboardScreen } from '../screens/groups/GroupDashboardScreen';
import { GroupSettingsScreen } from '../screens/groups/GroupSettingsScreen';
import { CreateGroupScreen } from '../screens/groups/CreateGroupScreen';
import { JoinGroupScreen } from '../screens/groups/JoinGroupScreen';
import { CameraScreen } from '../screens/camera/CameraScreen';
import { LeaderboardScreen } from '../screens/groups/LeaderboardScreen';
import { PastChallengesScreen } from '../screens/groups/PastChallengesScreen';
import { FeedScreen } from '../screens/groups/FeedScreen';
import { PersonalStatsScreen } from '../screens/PersonalStatsScreen';
import { JoinLandingScreen } from '../screens/groups/JoinLandingScreen';

export type GroupsStackParamList = {
  GroupsList: undefined;
  GroupDashboard: { groupId: string };
  GroupSettings: { groupId: string };
  CreateGroup: undefined;
  JoinGroup: { code?: string };
  CaptureProof: { groupId: string; habitId: string; habitName: string };
  Leaderboard: { groupId: string };
  PastChallenges: { groupId: string };
  Feed: { groupId: string };
  Stats: { groupId: string };
  JoinLanding: { code: string };
};

const Stack = createNativeStackNavigator<GroupsStackParamList>();

export function GroupsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="GroupsList"
        component={GroupsListScreen}
        options={{ title: 'Groups' }}
      />
      <Stack.Screen
        name="GroupDashboard"
        component={GroupDashboardScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="GroupSettings"
        component={GroupSettingsScreen}
        options={{ title: 'Group settings' }}
      />
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: 'New group', presentation: 'modal' }}
      />
      <Stack.Screen
        name="JoinGroup"
        component={JoinGroupScreen}
        options={{ title: 'Join group', presentation: 'modal' }}
      />
      <Stack.Screen
        name="CaptureProof"
        component={CameraScreen}
        options={{
          headerShown: false,
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{ title: 'Leaderboard' }}
      />
      <Stack.Screen
        name="PastChallenges"
        component={PastChallengesScreen}
        options={{ title: 'Challenges' }}
      />
      <Stack.Screen
        name="Feed"
        component={FeedScreen}
        options={{ title: 'Feed' }}
      />
      <Stack.Screen
        name="Stats"
        component={PersonalStatsScreen}
        options={{ title: 'My Stats' }}
      />
      <Stack.Screen
        name="JoinLanding"
        component={JoinLandingScreen}
        options={{ title: 'Join Group' }}
      />
    </Stack.Navigator>
  );
}

