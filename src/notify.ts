import { Platform } from 'react-native';
import { Settings } from './settings';
import { planNotifications } from './notifyPlan';
import type { Analysis } from './metrics';
import { KEYS, readJson, writeJson } from './storage';

const supported = Platform.OS === 'android' || Platform.OS === 'ios';
const N = () => require('expo-notifications') as typeof import('expo-notifications');

const IDS = { bedtime: 'vitalis-bedtime', bp: 'vitalis-bp-weekly' };
const CHANNEL = 'vitalis';

export function setupNotifications() {
  if (!supported) return;
  const n = N();
  n.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });
  if (Platform.OS === 'android') n.setNotificationChannelAsync(CHANNEL, { name: 'Daily insights', importance: n.AndroidImportance.DEFAULT }).catch(() => {});
}

export async function ensurePermission(): Promise<boolean> {
  if (!supported) return false;
  const n = N();
  const cur = await n.getPermissionsAsync();
  if (cur.granted) return true;
  return (await n.requestPermissionsAsync()).granted;
}

const todayStamp = () => new Date().toDateString();

/** Apply the person's settings to the schedule and, if it is morning and not yet sent, deliver today's summary. */
export async function syncNotifications(a: Analysis, s: Settings, opts: { allowMorning: boolean }) {
  if (!supported) return;
  const n = N();
  const plan = planNotifications(a);

  await n.cancelScheduledNotificationAsync(IDS.bedtime).catch(() => {});
  await n.cancelScheduledNotificationAsync(IDS.bp).catch(() => {});

  if (s.bedtimeReminder && plan.bedtime) {
    await n.scheduleNotificationAsync({
      identifier: IDS.bedtime,
      content: { title: plan.bedtime.title, body: plan.bedtime.body },
      trigger: { type: n.SchedulableTriggerInputTypes.DAILY, channelId: CHANNEL, hour: plan.bedtime.hour, minute: plan.bedtime.minute },
    });
  }
  if (s.bpReminder) {
    await n.scheduleNotificationAsync({
      identifier: IDS.bp,
      content: { title: 'Blood pressure check 🩺', body: 'A cuff reading this week keeps your trend honest. Sit quietly for 5 minutes first.' },
      trigger: { type: n.SchedulableTriggerInputTypes.WEEKLY, channelId: CHANNEL, weekday: 1, hour: 9, minute: 0 },
    });
  }

  if (s.morningSummary && opts.allowMorning && plan.morning && new Date().getHours() >= 5) {
    const last = await readJson<string>(KEYS.lastNotified, '');
    if (last !== todayStamp()) {
      await n.scheduleNotificationAsync({ content: { title: plan.morning.title, body: plan.morning.body }, trigger: null });
      await writeJson(KEYS.lastNotified, todayStamp());
    }
  }
}

export async function cancelAllNotifications() {
  if (!supported) return;
  await N().cancelAllScheduledNotificationsAsync().catch(() => {});
}
