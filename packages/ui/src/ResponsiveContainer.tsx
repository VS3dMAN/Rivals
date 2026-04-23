import type { ReactNode } from 'react';
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native';

interface Props {
  children: ReactNode;
  maxWidth?: number;
}

export function ResponsiveContainer({ children, maxWidth = 960 }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  if (!isDesktop) return <>{children}</>;

  return (
    <View style={styles.outer}>
      <View style={[styles.inner, { maxWidth, width: '100%' }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1 },
});
