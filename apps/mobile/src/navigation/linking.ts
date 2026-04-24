import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';

// Deep links:
//   rivals://join/:code          (mobile scheme)
//   https://rivals.app/join/:code (universal link / web)
export const linking: LinkingOptions<ReturnType<typeof Object>> = {
  prefixes: [Linking.createURL('/'), 'rivals://', 'https://rivals.app'],
  config: {
    screens: {
      DashboardTab: 'today',
      GroupsTab: {
        screens: {
          GroupsList: 'groups',
          GroupDashboard: 'groups/:groupId',
          GroupSettings: 'groups/:groupId/settings',
          CreateGroup: 'groups/new',
          JoinGroup: 'join/:code',
        },
      },
      NotificationsTab: 'inbox',
      ProfileTab: 'me',
    },
  },
};
