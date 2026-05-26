import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'sm' | 'md' | 'lg';

/**
 * Returns the current breakpoint based on window width.
 * sm: < 768px (mobile)
 * md: 768-1279px (tablet)
 * lg: >= 1280px (desktop)
 */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width >= 1280) return 'lg';
  if (width >= 768) return 'md';
  return 'sm';
}
