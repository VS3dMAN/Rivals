import { Platform } from 'react-native';
import { api } from './api';
import { track } from './analytics';

/**
 * Register for push notifications and send the token to the backend.
 * Must be called after the user is authenticated.
 *
 * Requires `expo-notifications` to be installed.
 * On web, this is a no-op (web push handled separately).
 */
export async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    // @ts-ignore — expo-notifications must be installed manually
    const Notifications = await import('expo-notifications');
    // @ts-ignore — expo-device must be installed manually
    const Device = await import('expo-device');

    // Push only works on physical devices
    if (!Device.isDevice) {
      console.log('[push] Not a physical device, skipping registration');
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[push] Permission not granted');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    await api('/push/register', {
      method: 'POST',
      body: JSON.stringify({
        platform: Platform.OS as 'ios' | 'android',
        token,
      }),
    });

    console.log('[push] Registered token:', token.slice(0, 20) + '...');

    Notifications.addNotificationResponseReceivedListener((response: { notification: { request: { content: { data?: Record<string, unknown> } } } }) => {
      const data = response?.notification?.request?.content?.data ?? {};
      track('notification_opened', { kind: data.kind, groupId: data.groupId });
    });
  } catch (err) {
    console.error('[push] Registration failed:', err);
  }
}
