import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

export function GroupsScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Groups</Text>
        <Text style={styles.body}>Your groups will live here.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { ...theme.typography.title, color: theme.colors.text },
  body: { ...theme.typography.body, color: theme.colors.textMuted },
});
