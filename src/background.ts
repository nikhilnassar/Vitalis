import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { loadFromPlatform } from './health';
import { build } from './pipeline';
import { reportError } from './errors';
import { syncNotifications } from './notify';
import { loadSettings } from './settings';
import { KEYS, readJson } from './storage';

export const TASK = 'vitalis-background-sync';

/**
 * Defined at import time (index.ts) so the OS can start it with the app closed.
 * It re-reads the health store, recomputes, and updates notifications. The OS decides when it
 * actually runs (roughly every 15+ minutes at best, less when the battery is low), so treat it as best-effort.
 */
if (Platform.OS !== 'web') {
  TaskManager.defineTask(TASK, async () => {
    try {
      const s = await loadSettings();
      if (!s.morningSummary && !s.bedtimeReminder && !s.bpReminder) return BackgroundTask.BackgroundTaskResult.Success;
      if ((await readJson<string>(KEYS.source, '')) !== 'platform') return BackgroundTask.BackgroundTaskResult.Success;
      const built = await build(await loadFromPlatform({ background: true }), 'platform');
      if (built.analysis) await syncNotifications(built.analysis, s, { allowMorning: true });
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (e) {
      reportError(e, 'background');
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Keep the task registered only while at least one feature needs it. */
export async function setBackgroundEnabled(on: boolean) {
  if (Platform.OS === 'web') return;
  try {
    const registered = await TaskManager.isTaskRegisteredAsync(TASK);
    if (on && !registered) await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 60 });
    if (!on && registered) await BackgroundTask.unregisterTaskAsync(TASK);
  } catch (e) {
    reportError(e, 'background-register');
  }
}
