import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../../theme';

export function HttpsRequiredError() {
  const nav = useNavigation();
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Camera requires HTTPS</Text>
      <Text style={styles.body}>
        Browsers only allow camera access on secure (HTTPS) origins. Open Rivals on the
        production URL or via localhost during development.
      </Text>
      <Pressable style={styles.btn} onPress={() => nav.goBack()}>
        <Text style={styles.btnText}>Go back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  title: { ...theme.typography.title, color: theme.colors.text },
  body: { ...theme.typography.body, color: theme.colors.textMuted },
  btn: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  btnText: { ...theme.typography.heading, color: '#0B1220' },
});
