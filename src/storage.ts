import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  profile: 'vitalis.profile.v1',
  source: 'vitalis.source.v1',
  manual: 'vitalis.manual.v1',
  journal: 'vitalis.journal.v1',
  labs: 'vitalis.labs.v1',
  settings: 'vitalis.settings.v1',
  cache: 'vitalis.cache.v1',
  errors: 'vitalis.errors.v1',
  onboarded: 'vitalis.onboarded.v1',
  lastNotified: 'vitalis.lastNotified.v1',
} as const;

export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage can be full or unavailable; the app keeps working from memory */
  }
}

/** Remove everything Vitalis keeps on the phone. */
export async function wipeAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
