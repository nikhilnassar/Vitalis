export const colors = {
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

export const bandColor = (b: 'red' | 'yellow' | 'green' | null | undefined) =>
  b === 'green' ? colors.mint : b === 'yellow' ? colors.sun : b === 'red' ? colors.coral : colors.border;

export const bandEmoji = (b: 'red' | 'yellow' | 'green' | null | undefined) =>
  b === 'green' ? '🤩' : b === 'yellow' ? '🙂' : b === 'red' ? '😴' : '🔋';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { card: 24, pill: 99, button: 18 };
