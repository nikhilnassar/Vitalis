import { Platform } from 'react-native';
import { RawHealthData } from '../types';
import { demoRaw } from './demo';

export type Source = 'platform' | 'demo';

export const platformName = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';

/** Ask for permission and read ~45 days of data from the phone's health store. */
export async function loadFromPlatform(): Promise<RawHealthData> {
  // Required lazily so each OS only loads its own native module.
  const mod =
    Platform.OS === 'ios'
      ? (require('./appleHealth') as typeof import('./appleHealth'))
      : (require('./healthConnect') as typeof import('./healthConnect'));
  await mod.requestAccess();
  return mod.readRaw();
}

export const loadDemo = (): RawHealthData => demoRaw();
