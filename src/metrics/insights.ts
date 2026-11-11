import { DailyData } from '../types';
import { DayMetrics } from './analyze';
import { summarizeSession } from './sleep';
import { defined, mean, round } from './util';

/** Long-term direction of a biomarker: the last 30 days against the 30 before that. */
export interface BiomarkerTrend {
  key: string;
  label: string;
  emoji: string;
  unit: string;
  recent?: number;
  prior?: number;
  delta?: number;
  verdict: 'better' | 'worse' | 'steady' | 'unknown';
  nRecent: number;
}

/** A within-you pattern: a habit one day against a biomarker the next morning. */
export interface HabitInsight {
  habit: string;
  marker: string;
  r: number;
  n: number;
  sentence: string;
  good: boolean;
}

export interface InsightsResult {
  trends: BiomarkerTrend[];
  habits: HabitInsight[];
  habitDaysUsed: number;
  habitsReady: boolean;
}

export const MIN_HABIT_DAYS = 21;

const pearson = (x: number[], y: number[]) => {
  const mx = mean(x);
  const my = mean(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxx && syy ? { r: sxy / Math.sqrt(sxx * syy), slope: sxy / sxx } : undefined;
};

const sleepHours = (d: DailyData) => (d.sleep ? summarizeSession(d.sleep).asleepMin / 60 : undefined);
// Bedtime as hours after 18:00, so 23:30 -> 5.5 and 01:00 -> 7 (no wrap at midnight).
const bedtime = (d: DailyData) => {
  if (!d.sleep) return undefined;
  const t = new Date(d.sleep.start);
  return ((t.getHours() + t.getMinutes() / 60 - 18 + 24) % 24) as number;
};

export function computeInsights(days: DailyData[], metrics: DayMetrics[]): InsightsResult {
  const trendOf = (key: string, label: string, emoji: string, unit: string, pick: (d: DailyData) => number | undefined, better: 'higher' | 'lower', minDelta: number): BiomarkerTrend => {
    const vals = days.map(pick);
    const recent = vals.slice(-30).filter(defined);
    const prior = vals.slice(-60, -30).filter(defined);
    if (recent.length < 7 || prior.length < 7) return { key, label, emoji, unit, verdict: 'unknown', nRecent: recent.length, recent: recent.length ? round(mean(recent), 1) : undefined };
    const delta = round(mean(recent) - mean(prior), 1);
    const verdict = Math.abs(delta) < minDelta ? 'steady' : (delta > 0) === (better === 'higher') ? 'better' : 'worse';
    return { key, label, emoji, unit, recent: round(mean(recent), 1), prior: round(mean(prior), 1), delta, verdict, nRecent: recent.length };
  };

  const trends = [
    trendOf('hrv', 'Heart-rate variability', '💓', 'ms', (d) => d.hrv, 'higher', 2),
    trendOf('rhr', 'Resting heart rate', '🫀', 'bpm', (d) => d.rhr, 'lower', 1),
    trendOf('sleep', 'Sleep per night', '🌙', 'h', sleepHours, 'higher', 0.2),
    trendOf('vo2', 'Cardio fitness (VO2max)', '🫁', '', (d) => d.vo2max ?? undefined, 'higher', 0.5),
    trendOf('weight', 'Weight', '⚖️', 'kg', (d) => d.weightKg, 'lower', 0.5),
    trendOf('sys', 'Systolic blood pressure', '🩺', 'mmHg', (d) => (d.bp.length ? mean(d.bp.map((b) => b.sys)) : undefined), 'lower', 3),
  ].filter((t) => t.verdict !== 'unknown' || t.recent != null);

  // Yesterday's habit -> this morning's biomarker.
  const habits: { name: string; unit: string; get: (i: number) => number | undefined; scale: number; higherLabel: string }[] = [
    { name: 'a harder day (+3 strain)', unit: '', scale: 3, higherLabel: '', get: (i) => (metrics[i].strain.hasData ? metrics[i].strain.strain : undefined) },
    { name: '3,000 more steps', unit: '', scale: 3000, higherLabel: '', get: (i) => days[i].steps },
    { name: 'an extra hour of sleep', unit: '', scale: 1, higherLabel: '', get: (i) => sleepHours(days[i]) },
    { name: 'going to bed an hour later', unit: '', scale: 1, higherLabel: '', get: (i) => bedtime(days[i]) },
  ];
  const markers: { name: string; unit: string; higherIsGood: boolean; get: (i: number) => number | undefined }[] = [
    { name: 'next-morning HRV', unit: 'ms', higherIsGood: true, get: (i) => days[i].hrv },
    { name: 'next-morning resting heart rate', unit: 'bpm', higherIsGood: false, get: (i) => days[i].rhr },
    { name: 'next-day recovery', unit: 'points', higherIsGood: true, get: (i) => (metrics[i].recovery.status === 'ok' ? metrics[i].recovery.score ?? undefined : undefined) },
  ];

  const out: HabitInsight[] = [];
  let used = 0;
  for (const h of habits) {
    for (const m of markers) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 1; i < days.length; i++) {
        const x = h.get(i - 1);
        const y = m.get(i);
        if (x != null && y != null) {
          xs.push(x);
          ys.push(y);
        }
      }
      used = Math.max(used, xs.length);
      if (xs.length < MIN_HABIT_DAYS) continue;
      const p = pearson(xs, ys);
      if (!p) continue;
      // Consecutive days are correlated, so count only half the days when judging significance.
      const nEff = xs.length / 2;
      const t = (p.r * Math.sqrt(nEff - 2)) / Math.sqrt(Math.max(1e-9, 1 - p.r ** 2));
      if (Math.abs(p.r) < 0.3 || Math.abs(t) < 2) continue;
      const change = p.slope * h.scale;
      const up = change > 0;
      const good = up === m.higherIsGood;
      out.push({
        habit: h.name,
        marker: m.name,
        r: round(p.r, 2),
        n: xs.length,
        good,
        sentence: `After ${h.name}, your ${m.name} tended to be ${Math.abs(round(change, 1))} ${m.unit} ${up ? 'higher' : 'lower'}.`,
      });
    }
  }
  out.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return { trends, habits: out.slice(0, 4), habitDaysUsed: used, habitsReady: used >= MIN_HABIT_DAYS };
}
