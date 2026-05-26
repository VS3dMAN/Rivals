import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Dimensions,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../theme';

const { width } = Dimensions.get('window');

interface OnboardingSlide {
  emoji: string;
  title: string;
  body: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    emoji: '📸',
    title: 'Proof or it didn\'t happen',
    body: 'Submit photo proof every day to keep your streak alive. No faking it.',
  },
  {
    emoji: '🏆',
    title: 'See who\'s ahead',
    body: 'Real-time leaderboards show who\'s putting in the work. Compete with friends.',
  },
  {
    emoji: '👥',
    title: 'Join your people',
    body: 'Create a group, invite friends, and hold each other accountable.',
  },
];

interface OnboardingCarouselProps {
  onComplete: () => void;
}

export function OnboardingCarousel({ onComplete }: OnboardingCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const isLast = activeIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable style={styles.skipBtn} onPress={onComplete}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>

        <Pressable
          style={styles.nextBtn}
          onPress={() => {
            if (isLast) {
              onComplete();
            } else {
              flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
            }
          }}
        >
          <Text style={styles.nextBtnText}>
            {isLast ? 'Get Started' : 'Next'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  skipBtn: { alignSelf: 'flex-end', padding: theme.spacing.md },
  skipText: { ...theme.typography.body, color: theme.colors.textMuted },
  slide: {
    width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: theme.spacing.md,
  },
  emoji: { fontSize: 80, marginBottom: theme.spacing.md },
  title: { ...theme.typography.title, color: theme.colors.text, textAlign: 'center' },
  body: { ...theme.typography.body, color: theme.colors.textMuted, textAlign: 'center', lineHeight: 24 },
  footer: { padding: theme.spacing.lg, gap: theme.spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.surfaceRaised },
  dotActive: { backgroundColor: theme.colors.accent, width: 24 },
  nextBtn: {
    backgroundColor: theme.colors.accent,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  nextBtnText: { ...theme.typography.heading, color: '#0B1220' },
});
