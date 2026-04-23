import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { useCurrentUser } from '../hooks/useCurrentUser';

export function DashboardScreen() {
  const { data: user } = useCurrentUser();
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Today</Text>
        <Text style={styles.subtitle}>
          {user ? `Hello, ${user.displayName}` : 'Loading…'}
        </Text>
        <Text style={styles.body}>Your habit cards will live here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { ...theme.typography.title, color: theme.colors.text },
  subtitle: { ...theme.typography.heading, color: theme.colors.accent },
  body: { ...theme.typography.body, color: theme.colors.textMuted },
});
