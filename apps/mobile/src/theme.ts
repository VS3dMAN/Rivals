export const theme = {
  colors: {
    background: '#0B1220',
    surface: '#121A2E',
    surfaceRaised: '#1A2340',
    border: '#26304F',
    text: '#F1F5F9',
    textMuted: '#94A3B8',
    accent: '#F59E0B',
    accentMuted: '#B45309',
    success: '#10B981',
    danger: '#EF4444',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 6,
    md: 12,
    lg: 20,
  },
  typography: {
    title: { fontSize: 24, fontWeight: '700' as const },
    heading: { fontSize: 18, fontWeight: '600' as const },
    body: { fontSize: 16, fontWeight: '400' as const },
    caption: { fontSize: 13, fontWeight: '400' as const },
  },
};

export type Theme = typeof theme;
