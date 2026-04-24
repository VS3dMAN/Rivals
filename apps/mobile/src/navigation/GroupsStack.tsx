import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { GroupsListScreen } from '../screens/groups/GroupsListScreen';
import { GroupDashboardScreen } from '../screens/groups/GroupDashboardScreen';
import { GroupSettingsScreen } from '../screens/groups/GroupSettingsScreen';
import { CreateGroupScreen } from '../screens/groups/CreateGroupScreen';
import { JoinGroupScreen } from '../screens/groups/JoinGroupScreen';

export type GroupsStackParamList = {
  GroupsList: undefined;
  GroupDashboard: { groupId: string };
  GroupSettings: { groupId: string };
  CreateGroup: undefined;
  JoinGroup: { code?: string };
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
    </Stack.Navigator>
  );
}
