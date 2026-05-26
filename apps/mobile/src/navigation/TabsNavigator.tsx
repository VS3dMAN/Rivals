import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { theme } from '../theme';
import { DashboardScreen } from '../screens/DashboardScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationPreferencesScreen } from '../screens/NotificationPreferencesScreen';
import { BadgesScreen } from '../screens/BadgesScreen';
import { PrivacyScreen } from '../screens/PrivacyScreen';
import { GroupsStack } from './GroupsStack';
import { useUnreadCount } from '../hooks/useNotifications';

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
const NotificationsStack = makeStack(NotificationsScreen, 'Notifications');

const ProfileStackNav = createNativeStackNavigator();
function ProfileStack() {
  return (
    <ProfileStackNav.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <ProfileStackNav.Screen name="Profile" component={ProfileScreen} />
      <ProfileStackNav.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{ title: 'Notification settings' }}
      />
      <ProfileStackNav.Screen
        name="Badges"
        component={BadgesScreen}
        options={{ title: 'Badges' }}
      />
      <ProfileStackNav.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{ title: 'Privacy & data' }}
      />
    </ProfileStackNav.Navigator>
  );
}

function tabIcon(label: string) {
  return function Icon({ color }: { color: string }) {
    return <Text style={{ color, fontSize: 12 }}>{label}</Text>;
  };
}

export function TabsNavigator() {
  const unread = useUnreadCount();
  const badgeCount = unread.data?.count ?? 0;

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
        options={{
          title: 'Inbox',
          tabBarIcon: tabIcon('N'),
          tabBarBadge: badgeCount > 0 ? badgeCount : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.colors.accent, color: '#0B1220' },
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{ title: 'Profile', tabBarIcon: tabIcon('P') }}
      />
    </Tab.Navigator>
  );
}
