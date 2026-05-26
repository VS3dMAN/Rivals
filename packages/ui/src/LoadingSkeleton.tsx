import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, type ViewStyle } from 'react-native';

interface SkeletonLineProps {
  width?: ViewStyle['width'];
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

function SkeletonLine({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonLineProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#1A2340', opacity },
        style,
      ]}
    />
  );
}

export interface LoadingSkeletonProps {
  variant?: 'list' | 'card' | 'grid';
  count?: number;
  style?: ViewStyle;
}

function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <SkeletonLine width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonLine width="60%" height={14} />
          <SkeletonLine width="30%" height={12} />
        </View>
      </View>
      <SkeletonLine height={120} borderRadius={8} />
      <SkeletonLine width="80%" height={14} />
    </View>
  );
}

function ListItemSkeleton() {
  return (
    <View style={styles.listItem}>
      <SkeletonLine width={36} height={36} borderRadius={18} />
      <View style={{ flex: 1, gap: 4 }}>
        <SkeletonLine width="70%" height={14} />
        <SkeletonLine width="40%" height={12} />
      </View>
    </View>
  );
}

export function LoadingSkeleton({ variant = 'list', count = 4, style }: LoadingSkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'card') {
    return (
      <View style={[styles.container, style]}>
        {items.map((i) => <CardSkeleton key={i} />)}
      </View>
    );
  }

  if (variant === 'grid') {
    return (
      <View style={[styles.grid, style]}>
        {items.map((i) => (
          <SkeletonLine key={i} height={80} borderRadius={8} style={{ flex: 1, minWidth: 140 }} />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {items.map((i) => <ListItemSkeleton key={i} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12, padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  card: {
    backgroundColor: '#121A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#26304F',
    padding: 16,
    gap: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
});
