import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Rivals',
  slug: 'rivals',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'rivals',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.rivals.app',
    infoPlist: {
      NSCameraUsageDescription:
        'Rivals needs your camera to capture live proof photos for habit completions. Gallery uploads are not allowed.',
      NSPhotoLibraryUsageDescription:
        'Rivals only uses your photo library to pick a group avatar image.',
    },
  },
  android: {
    package: 'com.rivals.app',
    permissions: ['CAMERA', 'READ_MEDIA_IMAGES'],
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
    output: 'static',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission:
          'Rivals needs your camera to capture live proof photos. Gallery access is never requested.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Rivals needs photo library access to pick a group avatar image.',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#F59E0B',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    firebaseVapidKey: process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY,
    posthogApiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY,
    posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST,
  },
};

export default config;
