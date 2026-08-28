/**
 * The Finto design tokens, same values as the web app's CSS custom properties
 * and the original design file. Kept as a plain object because React Native
 * has no cascade to inherit from.
 */
export const colors = {
  ink: '#0B0C0B',
  ink2: '#3F453F',
  muted: '#6B726C',
  faint: '#9AA09A',
  hairline: '#E4E7E1',
  hairline2: '#D3D8CF',

  paper: '#F6F7F4',
  surface: '#FFFFFF',
  surface2: '#F1F3EE',
  surface3: '#EDEFEA',

  forest: '#14301A',
  forest2: '#3A4740',
  lime: '#A9EE68',
  lime2: '#96E44F',
  limeWash: '#DCF5B8',
  limeDeep: '#2F5B1E',

  income: '#2E7D46',
  danger: '#C93A2E',
  dangerBg: '#FDECEA',
  warn: '#8A6410',
  warnBg: '#FBF0D9',

  white: '#FFFFFF'
} as const;

/** Avatar chip palette: [background, foreground]. */
const TINTS: Record<string, [string, string]> = {
  lime: ['#DCF5B8', '#2F5B1E'],
  forest: ['#DDE7DC', '#14301A'],
  sand: ['#F3EBDA', '#7A5C21'],
  sky: ['#DEE9F2', '#2C4F6B'],
  stone: ['#EDEFEA', '#4A514A']
};

export function tint(key: string | undefined): { bg: string; fg: string } {
  const [bg, fg] = TINTS[key ?? 'stone'] ?? TINTS.stone!;
  return { bg, fg };
}

/** 8pt spacing, matching the design's rhythm. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 28 } as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 20, xxl: 26, xxxl: 28 } as const;

/**
 * Manrope 500–800, as the design specifies. The family names come from
 * @expo-google-fonts/manrope and must match what is loaded in _layout.tsx.
 */
export const font = {
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold'
} as const;

export const type = {
  screenTitle: { fontFamily: font.extrabold, fontSize: 28, letterSpacing: -1.1 },
  balance: { fontFamily: font.extrabold, fontSize: 42, letterSpacing: -1.9 },
  amount: { fontFamily: font.extrabold, fontSize: 15 },
  rowTitle: { fontFamily: font.bold, fontSize: 14.5, letterSpacing: -0.22 },
  rowMeta: { fontFamily: font.medium, fontSize: 12.5 },
  label: { fontFamily: font.bold, fontSize: 12.5 },
  button: { fontFamily: font.bold, fontSize: 15 }
} as const;
