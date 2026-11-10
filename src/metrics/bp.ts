import { BpReading, DailyData } from '../types';
import type { DayMetrics } from './analyze';
import { addDays, dayKey, daysBetween, defined, mean, round, slope } from './util';

export type BpCategory = 'low' | 'normal' | 'elevated' | 'high1' | 'high2' | 'urgent';

/** Category bands follow the common AHA/ACC adult ranges. One reading is never a diagnosis. */
export function classify(sys: number, dia: number): BpCategory {
  if (sys >= 180 || dia >= 120) return 'urgent';
  if (sys >= 140 || dia >= 90) return 'high2';
  if (sys >= 130 || dia >= 80) return 'high1';
  if (sys >= 120) return 'elevated';
  if (sys < 90 || dia < 60) return 'low';
  return 'normal';
}

export const categoryLabel: Record<BpCategory, string> = {
  low: 'On the low side',
  normal: 'Normal',
  elevated: 'Elevated',
  high1: 'High (stage 1 range)',
  high2: 'High (stage 2 range)',
  urgent: 'Very high',
};

export interface Avg {
  sys: number;
  dia: number;
  n: number;
}

export interface BpSummary {
  count: number; // readings in the window
  last?: BpReading & { category: BpCategory };
  daysSinceLast?: number;
  avg7?: Avg;
  avg30?: Avg;
  category30?: BpCategory;
  morning?: Avg; // before 12:00
  evening?: Avg; // 17:00 or later
  slopePerWeek?: { sys: number; dia: number }; // mmHg per week over daily means
  series: { date: string; sys: number; dia: number }[]; // daily means, last 60 days
  urgentRecent?: BpReading; // last 24 h at 180/120 or above
  recent: BpReading[]; // newest first, up to 8
}

const avg = (rs: BpReading[]): Avg | undefined =>
  rs.length ? { sys: round(mean(rs.map((r) => r.sys))), dia: round(mean(rs.map((r) => r.dia))), n: rs.length } : undefined;

export function summarizeBp(days: DailyData[], now = Date.now()): BpSummary {
  const today = dayKey(now);
  const all = days.flatMap((d) => d.bp).sort((a, b) => a.t - b.t);
  const inLast = (n: number) => all.filter((r) => dayKey(r.t) > addDays(today, -n));
  const r30 = inLast(30);
  const r7 = inLast(7);

  const last = all[all.length - 1];
  const dailyMap = new Map<string, BpReading[]>();
  for (const r of all) {
    const k = dayKey(r.t);
    dailyMap.set(k, [...(dailyMap.get(k) ?? []), r]);
  }
  const series = [...dailyMap.entries()]
    .filter(([k]) => k > addDays(today, -60))
    .map(([date, rs]) => ({ date, sys: round(mean(rs.map((r) => r.sys)), 1), dia: round(mean(rs.map((r) => r.dia)), 1) }));

  const last30Series = series.filter((s) => s.date > addDays(today, -30));
  let slopePerWeek: BpSummary['slopePerWeek'];
  if (last30Series.length >= 6) {
    const xs = last30Series.map((s) => daysBetween(last30Series[0].date, s.date));
    const ss = slope(xs, last30Series.map((s) => s.sys));
    const sd = slope(xs, last30Series.map((s) => s.dia));
    if (defined(ss) && defined(sd)) slopePerWeek = { sys: round(ss * 7, 1), dia: round(sd * 7, 1) };
  }

  const hourOf = (t: number) => new Date(t).getHours();
  const a30 = avg(r30);

  return {
    count: r30.length,
    last: last ? { ...last, category: classify(last.sys, last.dia) } : undefined,
    daysSinceLast: last ? daysBetween(dayKey(last.t), today) : undefined,
    avg7: avg(r7),
    avg30: a30,
    category30: a30 ? classify(a30.sys, a30.dia) : undefined,
    morning: avg(r30.filter((r) => hourOf(r.t) < 12)),
    evening: avg(r30.filter((r) => hourOf(r.t) >= 17)),
    slopePerWeek,
    series,
    recent: all.slice(-8).reverse(),
    urgentRecent: all.find((r) => now - r.t <= 24 * 3600_000 && (r.sys >= 180 || r.dia >= 120)),
  };
}

export interface BpPrompt {
  show: boolean;
  tone: 'info' | 'warn';
  title: string;
  reason: string;
}

const NONE: BpPrompt = { show: false, tone: 'info', title: '', reason: '' };

/**
 * A nudge to take a cuff reading, never an estimate. It fires when the body shows a stress pattern
 * (HRV or resting HR clearly off your baseline, or short sleep, on most of the last 4 days) and your
 * last reading is a week old, or when a recent reading was high and has not been rechecked.
 */
export function bpPrompt(summary: BpSummary, recent: DayMetrics[]): BpPrompt {
  if (summary.urgentRecent) return NONE; // the urgent banner handles this case
  if (summary.count === 0 && (summary.daysSinceLast === undefined || summary.daysSinceLast > 30)) {
    return {
      show: true,
      tone: 'info',
      title: 'Take your first reading',
      reason: 'Log a cuff reading (or let your cuff app sync it) to start your BP history.',
    };
  }
  if (summary.last && (summary.last.category === 'high1' || summary.last.category === 'high2') && (summary.daysSinceLast ?? 0) >= 3) {
    return {
      show: true,
      tone: 'warn',
      title: 'Time to recheck',
      reason: `Your last reading (${summary.last.sys}/${summary.last.dia}) was in the high range ${summary.daysSinceLast} days ago. Take another seated reading after 5 minutes of rest.`,
    };
  }
  const last4 = recent.slice(-4);
  const offDays = last4.filter((d) => (d.recovery.components.hrv?.z ?? 0) < -1 || (d.recovery.components.rhr?.z ?? 0) < -1).length;
  const poorSleep = last4.filter((d) => (d.sleep?.performance ?? 100) < 60).length;
  if ((offDays >= 3 || poorSleep >= 3) && (summary.daysSinceLast ?? 99) >= 7) {
    return {
      show: true,
      tone: 'info',
      title: 'Worth a quick check',
      reason:
        offDays >= 3
          ? 'Your HRV or resting heart rate has been off your normal for several days, and your last reading is over a week old.'
          : 'You have had several short-sleep nights, and your last reading is over a week old.',
    };
  }
  return NONE;
}

export const URGENT_TEXT =
  'A reading this high needs prompt attention. Sit quietly for 5 minutes and measure again. If it is still this high, or you have chest pain, shortness of breath, weakness, confusion, trouble speaking or a severe headache, get emergency care right away.';
