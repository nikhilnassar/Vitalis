import { KEYS, readJson, writeJson } from './storage';

export interface Settings {
  morningSummary: boolean; // notification with today's recovery
  bedtimeReminder: boolean; // notification when it is time to wind down
  bpReminder: boolean; // weekly nudge to log a cuff reading
  crashReports: boolean; // opt-in, anonymous crash reports
}

export const DEFAULT_SETTINGS: Settings = { morningSummary: false, bedtimeReminder: false, bpReminder: false, crashReports: false };

export const loadSettings = async (): Promise<Settings> => ({ ...DEFAULT_SETTINGS, ...(await readJson<Partial<Settings>>(KEYS.settings, {})) });
export const saveSettings = (s: Settings) => writeJson(KEYS.settings, s);
