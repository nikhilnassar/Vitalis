import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RawHealthData } from '../types';
import { demoRaw, sparseRaw } from './demo';

export type Source = 'platform' | 'demo';

export const platformName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';

/** Ask for permission and read ~45 days of data from the phone's health store. */
export async function loadFromPlatform(opts: { background?: boolean; quiet?: boolean } = {}): Promise<RawHealthData> {
  // Required lazily so each OS only loads its own native module.
  const mod =
    Platform.OS === 'ios'
      ? (require('./appleHealth') as typeof import('./appleHealth'))
      : (require('./healthConnect') as typeof import('./healthConnect'));
  if (opts.background && Platform.OS === 'android') await (mod as typeof import('./healthConnect')).initQuiet();
  else if (opts.quiet && Platform.OS === 'android') {
    const hc = mod as typeof import('./healthConnect');
    await hc.initQuiet();
    // A quiet launch refresh normally shows no dialog. When this build needs a permission the person has not
    // been asked for yet (a new data type), ask once. The marker is saved first so it can never loop.
    const key = 'vitalis.permasked.v1';
    let asked = '';
    try {
      asked = (await AsyncStorage.getItem(key)) ?? '';
    } catch {}
    if (asked !== hc.PERMISSION_SET) {
      try {
        await AsyncStorage.setItem(key, hc.PERMISSION_SET);
      } catch {}
      try {
        await hc.requestAccess();
      } catch {}
    }
  } else await mod.requestAccess();
  return mod.readRaw();
}

/** Android only: permission to read Health Connect while the app is closed (needed for background updates). */
export async function requestBackgroundRead(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return (require('./healthConnect') as typeof import('./healthConnect')).requestBackgroundRead();
}

// EXPO_PUBLIC_DEMO=sparse previews the thin-data state a new tracker connection starts in.
export const loadDemo = (): RawHealthData => (process.env.EXPO_PUBLIC_DEMO === 'sparse' ? sparseRaw() : demoRaw());
