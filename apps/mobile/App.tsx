import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { View, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';

import { queryClient, createPersister } from './src/lib/queryClient';
import { loadSession } from './src/lib/session';
import { useSessionStore } from './src/stores/session';
import { TabsNavigator } from './src/navigation/TabsNavigator';
import { AuthGate } from './src/screens/auth/AuthGate';
import { theme } from './src/theme';
import { ResponsiveContainer } from '@rivals/ui';

// Sentry init — safe no-op when DSN absent
const sentryDsn = Constants.expoConfig?.extra?.sentryDsn as string | undefined;
if (sentryDsn) {
  // Lazy import to avoid crashing if native module unavailable on web
  import('@sentry/react-native')
    .then((Sentry) => {
      Sentry.init({ dsn: sentryDsn, tracesSampleRate: 0.2 });
    })
    .catch(() => void 0);
}

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    primary: theme.colors.accent,
  },
};

function SessionHydrator({ children }: { children: React.ReactNode }) {
  const setSession = useSessionStore((s) => s.setSession);
  const clear = useSessionStore((s) => s.clear);
  const hydrated = useSessionStore((s) => s.hydrated);
  const setHydrated = useSessionStore((s) => s.setHydrated);

  useEffect(() => {
    loadSession()
      .then((s) => {
        if (s) {
          setSession({
            accessToken: s.accessToken,
            refreshToken: s.refreshToken,
            user: { id: '', email: '', username: '', displayName: '' },
          });
        } else {
          clear();
        }
      })
      .catch(() => clear())
      .finally(() => setHydrated(true));
  }, [setSession, clear, setHydrated]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }
  return <>{children}</>;
}

function Root() {
  const accessToken = useSessionStore((s) => s.accessToken);
  return (
    <ResponsiveContainer>
      {accessToken ? <TabsNavigator /> : <AuthGate />}
    </ResponsiveContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{ persister: createPersister() }}
        >
          <NavigationContainer theme={navTheme}>
            <StatusBar style="light" />
            <SessionHydrator>
              <Root />
            </SessionHydrator>
          </NavigationContainer>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
