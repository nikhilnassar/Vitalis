const DARK = {
  bg: '#14112B',
  card: '#201C44',
  cardAlt: '#2B2658',
  border: '#3A3470',
  text: '#FFFFFF',
  sub: '#A9A3D6',
  // candy accents
  lime: '#B6F23C',
  mint: '#3DF2B5',
  sun: '#FFD43B',
  coral: '#FF7A59',
  pink: '#FF5FA2',
  sky: '#4DD8FF',
  grape: '#A56BFF',
  ink: '#1A1438', // dark text on bright buttons
  // legacy names used by older screens
  red: '#FF7A59',
  yellow: '#FFD43B',
  green: '#3DF2B5',
  blue: '#4DD8FF',
  violet: '#A56BFF',
};

const LIGHT: typeof DARK = {
  bg: '#F3F1FC',
  card: '#FFFFFF',
  cardAlt: '#ECE9FA',
  border: '#D3CEEE',
  text: '#1A1438',
  sub: '#5C5690',
  lime: '#6FB100',
  mint: '#0DA678',
  sun: '#D99A00',
  coral: '#E5573A',
  pink: '#DB2F7C',
  sky: '#0A8FCB',
  grape: '#7A3FE0',
  ink: '#FFFFFF',
  red: '#E5573A',
  yellow: '#D99A00',
  green: '#0DA678',
  blue: '#0A8FCB',
  violet: '#7A3FE0',
};

export type ThemeMode = 'dark' | 'light' | 'auto';

/** The shared palette object is updated in place, so every screen reads the active theme when it renders. */
export const colors: typeof DARK = { ...DARK };

export function resolveTheme(mode: ThemeMode, system?: string | null): 'dark' | 'light' {
  return mode === 'auto' ? (system === 'light' ? 'light' : 'dark') : mode;
}

export function applyTheme(mode: ThemeMode, system?: string | null): 'dark' | 'light' {
  const t = resolveTheme(mode, system);
  Object.assign(colors, t === 'light' ? LIGHT : DARK);
  return t;
}

export const bandColor = (b: 'red' | 'yellow' | 'green' | null | undefined) =>
  b === 'green' ? colors.mint : b === 'yellow' ? colors.sun : b === 'red' ? colors.coral : colors.border;

export const bandEmoji = (b: 'red' | 'yellow' | 'green' | null | undefined) =>
  b === 'green' ? '🤩' : b === 'yellow' ? '🙂' : b === 'red' ? '😴' : '🔋';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { card: 24, pill: 99, button: 18 };
