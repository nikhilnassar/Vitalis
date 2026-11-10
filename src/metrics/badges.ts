import { DailyData } from '../types';
import type { DayMetrics } from './analyze';
import { dayKey, daysBetween, defined, mean } from './util';

export interface Badge {
  emoji: string;
  title: string;
  detail: string;
}

function streak(flags: boolean[]): number {
  let n = 0;
  for (let i = flags.length - 1; i >= 0 && flags[i]; i--) n++;
  return n;
}

/** Friendly "wins" computed from the same data, shown on the Today screen. */
export function computeBadges(days: DailyData[], metrics: DayMetrics[], now = Date.now()): Badge[] {
  const out: Badge[] = [];
  const today = dayKey(now);

  const sleepStreak = streak(metrics.map((m) => !!m.sleep && m.sleep.hoursAsleep >= m.sleep.needHours - 0.5));
  if (sleepStreak >= 2) out.push({ emoji: '🌙', title: `${sleepStreak}-night sleep streak`, detail: 'You are meeting your sleep need.' });

  const greenStreak = streak(metrics.map((m) => m.recovery.band === 'green'));
  if (greenStreak >= 2) out.push({ emoji: '💚', title: `${greenStreak} green days`, detail: 'Recovery has been in the green.' });

  const lastSteps = [...days].reverse().find((d) => defined(d.steps));
  if (lastSteps && (lastSteps.steps as number) >= 10000)
    out.push({ emoji: '👟', title: 'Step champ', detail: `${Math.round(lastSteps.steps as number).toLocaleString()} steps on ${lastSteps.date === today ? 'today' : lastSteps.date}.` });

  const hrv = metrics.map((m) => m.recovery.components.hrv?.value).filter(defined);
  if (hrv.length >= 14) {
    const recent = mean(hrv.slice(-7));
    const prior = mean(hrv.slice(-21, -7));
    if (recent >= prior * 1.05) out.push({ emoji: '🧘', title: 'HRV on the rise', detail: `Up ${Math.round((recent / prior - 1) * 100)}% on the last two weeks.` });
  }

  const lastBp = [...days].reverse().find((d) => d.bp.length);
  if (lastBp && daysBetween(lastBp.date, today) <= 7) out.push({ emoji: '🩺', title: 'BP check-in done', detail: 'You logged a reading this week.' });

  const lastWeigh = [...days].reverse().find((d) => defined(d.weightKg));
  if (lastWeigh && daysBetween(lastWeigh.date, today) <= 3) out.push({ emoji: '⚖️', title: 'Weigh-in logged', detail: 'Consistency beats any single number.' });

  return out;
}
