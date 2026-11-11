import type { DayMetrics } from './analyze';
import { defined, mean, round } from './util';

export interface Coaching {
  headline: string;
  targetStrain: { low: number; high: number } | null;
  tonightSleepHours: number;
  insights: string[];
  overreachingFlag: boolean;
  illnessWatch: boolean;
  trends: {
    label: string;
    last7?: number;
    prior?: number; // the 7+ days before that, up to 21
    unit: string;
    betterWhen: 'higher' | 'lower';
  }[];
}

const avg = (xs: (number | undefined)[]) => {
  const v = xs.filter(defined);
  return v.length ? round(mean(v), 1) : undefined;
};

export function buildCoaching(days: DayMetrics[], tonightNeedHours: number): Coaching {
  const today = days[days.length - 1];
  const rec = today.recovery;
  const insights: string[] = [];

  let targetStrain: Coaching['targetStrain'] = null;
  let headline = 'Wear your tracker overnight to unlock daily coaching.';
  if (rec.score !== null) {
    if (rec.band === 'green') {
      targetStrain = { low: 14, high: 18 };
      headline = 'Primed. Your body can handle a hard session today.';
    } else if (rec.band === 'yellow') {
      targetStrain = { low: 10, high: 14 };
      headline = 'Moderate day. Train, but keep it controlled.';
    } else {
      targetStrain = { low: 4, high: 9 };
      headline = 'Run down. Prioritize light movement and sleep.';
    }
  } else if (rec.status === 'calibrating') {
    headline = 'Calibrating. A few more nights of data and your scores will unlock.';
  }

  insights.push(...rec.notes);
  if (today.sleep) {
    if (today.sleep.debtHours >= 1) insights.push(`You are ${today.sleep.debtHours} h short of your sleep need.`);
    if (defined(today.sleep.consistency) && today.sleep.consistency < 60)
      insights.push('Irregular bed and wake times are costing you sleep quality.');
  }

  // Overreaching: HRV below your normal for 3 days running while strain stays high.
  const last3 = days.slice(-3);
  const hrvLow = last3.length === 3 && last3.every((d) => (d.recovery.components.hrv?.z ?? 0) < -0.75);
  const highStrain = (avg(days.slice(-7).map((d) => (d.strain.hasData ? d.strain.strain : undefined))) ?? 0) >= 13;
  const overreachingFlag = hrvLow && highStrain;
  if (overreachingFlag) insights.push('HRV has been suppressed for 3 days under high load. Consider a rest day.');

  // Early-illness pattern: resting HR clearly up AND HRV clearly down (or breathing up) on 2 mornings running.
  const last2 = days.slice(-2);
  const illnessWatch =
    last2.length === 2 &&
    last2.every((d) => {
      const c = d.recovery.components;
      if (!c.rhr) return false;
      const hrvDown = c.hrv ? c.hrv.z <= -1 : false;
      const respUp = c.resp ? c.resp.z <= -1 : false;
      return c.rhr.z <= -1 && (hrvDown || respUp);
    });
  if (illnessWatch) insights.push('Resting heart rate is up and HRV is down two mornings in a row. That often shows up before a cold or flu, or after poor sleep, alcohol or heavy training. Consider taking it easy.');

  const split = (pick: (d: DayMetrics) => number | undefined) => {
    const v = days.map(pick);
    return { last7: avg(v.slice(-7)), prior: avg(v.slice(-21, -7)) };
  };
  const trends: Coaching['trends'] = [
    { label: 'Recovery', ...split((d) => d.recovery.score ?? undefined), unit: '%', betterWhen: 'higher' },
    { label: 'HRV', ...split((d) => d.recovery.components.hrv?.value), unit: 'ms', betterWhen: 'higher' },
    { label: 'Resting HR', ...split((d) => d.recovery.components.rhr?.value), unit: 'bpm', betterWhen: 'lower' },
    { label: 'Sleep', ...split((d) => d.sleep?.hoursAsleep), unit: 'h', betterWhen: 'higher' },
    { label: 'Strain', ...split((d) => (d.strain.hasData ? d.strain.strain : undefined)), unit: '', betterWhen: 'higher' },
  ];

  return { headline, targetStrain, tonightSleepHours: tonightNeedHours, insights, overreachingFlag, illnessWatch, trends };
}
