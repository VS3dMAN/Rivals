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
    },
  },
  android: {
    package: 'com.rivals.app',
    permissions: ['CAMERA'],
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
    output: 'static',
  },
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  },
};

export default config;
