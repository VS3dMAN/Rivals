import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again.',
  onRetry,
  style,
}: ErrorStateProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.icon}>!</Text>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {onRetry && (
        <Pressable
          style={styles.retryBtn}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', padding: 32, gap: 8 },
  icon: {
    fontSize: 24,
    fontWeight: '700',
    color: '#EF4444',
    width: 48,
    height: 48,
    lineHeight: 48,
    textAlign: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '600', color: '#F1F5F9', textAlign: 'center' },
  description: { fontSize: 14, color: '#94A3B8', textAlign: 'center', maxWidth: 280 },
  retryBtn: {
    backgroundColor: '#1A2340',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26304F',
    marginTop: 16,
  },
  retryBtnText: { fontSize: 16, fontWeight: '600', color: '#F1F5F9' },
});
