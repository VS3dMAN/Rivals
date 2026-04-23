import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { theme } from '../theme';
import { DashboardScreen } from '../screens/DashboardScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

function makeStack(component: React.ComponentType, title: string) {
  const Stack = createNativeStackNavigator();
  return function StackWrap() {
    return (
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name={title} component={component} />
      </Stack.Navigator>
    );
  };
}

const DashboardStack = makeStack(DashboardScreen, 'Today');
const GroupsStack = makeStack(GroupsScreen, 'Groups');
const NotificationsStack = makeStack(NotificationsScreen, 'Notifications');
const ProfileStack = makeStack(ProfileScreen, 'Profile');

function tabIcon(label: string) {
  return function Icon({ color }: { color: string }) {
    return <Text style={{ color, fontSize: 12 }}>{label}</Text>;
  };
}

export function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
      }}
    >
      <Tab.Screen
        name="DashboardTab"
        component={DashboardStack}
        options={{ title: 'Today', tabBarIcon: tabIcon('T') }}
      />
      <Tab.Screen
        name="GroupsTab"
        component={GroupsStack}
        options={{ title: 'Groups', tabBarIcon: tabIcon('G') }}
      />
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsStack}
        options={{ title: 'Inbox', tabBarIcon: tabIcon('N') }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{ title: 'Profile', tabBarIcon: tabIcon('P') }}
      />
    </Tab.Navigator>
  );
}
