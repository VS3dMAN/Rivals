// Cross-platform design tokens. Mirror of apps/mobile/src/theme.ts but lives in
// the shared @rivals/ui package so other surfaces (web shell, future native
// targets) can consume the same values.

export const colors = {
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
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 6, md: 12, lg: 20 } as const;

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const },
  heading: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
} as const;

export const tokens = { colors, spacing, radius, typography } as const;

export type Tokens = typeof tokens;
