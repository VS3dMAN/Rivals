import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';
import { useOnboardingStore } from '../stores/onboarding';

interface TooltipProps {
  id: string;
  title: string;
  body: string;
  /** Show the tooltip the first time this component mounts. */
  autoShow?: boolean;
}

export function Tooltip({ id, title, body, autoShow = true }: TooltipProps) {
  const hasSeen = useOnboardingStore((s) => s.dismissedTooltips.has(id));
  const dismiss = useOnboardingStore((s) => s.dismissTooltip);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (autoShow && !hasSeen) {
      // Small delay so the tooltip doesn't pop in before the screen settles.
      const t = setTimeout(() => setVisible(true), 400);
      return () => clearTimeout(t);
    }
  }, [autoShow, hasSeen]);

  const close = () => {
    setVisible(false);
    dismiss(id);
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Dismiss tip">
        <View style={styles.card} accessibilityLiveRegion="polite">
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable style={styles.btn} onPress={close}>
            <Text style={styles.btnText}>Got it</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    maxWidth: 360,
  },
  title: { ...theme.typography.heading, color: theme.colors.text },
  body: { ...theme.typography.body, color: theme.colors.textMuted },
  btn: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignSelf: 'flex-end',
  },
  btnText: { ...theme.typography.heading, color: '#0B1220' },
});
