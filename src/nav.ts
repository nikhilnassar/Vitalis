export const TABS = [
  { key: 'Today', emoji: '🔥' },
  { key: 'Sleep', emoji: '🌙' },
  { key: 'Trends', emoji: '📈' },
  { key: 'Body', emoji: '💪' },
  { key: 'BP', emoji: '🩺' },
  { key: 'You', emoji: '😎' },
] as const;

export type Tab = (typeof TABS)[number]['key'];
