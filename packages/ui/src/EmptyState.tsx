import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  primaryAction?: { label: string; onPress: () => void };
  secondaryAction?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {(primaryAction || secondaryAction) && (
        <View style={styles.actions}>
          {primaryAction && (
            <Pressable
              style={styles.primaryBtn}
              onPress={primaryAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={primaryAction.label}
            >
              <Text style={styles.primaryBtnText}>{primaryAction.label}</Text>
            </Pressable>
          )}
          {secondaryAction && (
            <Pressable
              style={styles.secondaryBtn}
              onPress={secondaryAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={secondaryAction.label}
            >
              <Text style={styles.secondaryBtnText}>{secondaryAction.label}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 32, gap: 8 },
  icon: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '600', color: '#F1F5F9', textAlign: 'center' },
  description: { fontSize: 14, color: '#94A3B8', textAlign: 'center', maxWidth: 280 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  primaryBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#0B1220' },
  secondaryBtn: {
    backgroundColor: '#121A2E',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26304F',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '600', color: '#F1F5F9' },
});
