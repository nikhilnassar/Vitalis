import { DailyData } from '../types';
import { summarizeSession } from './sleep';
import { clamp, defined, mean, round, sd } from './util';

export interface SleepBalance {
  nights: number; // nights with sleep in the last 7
  needHours: number;
  avgHours?: number;
  debtHours: number; // 7-night shortfall; extra sleep on one night does not cancel debt on another beyond a cap
  debtLevel: 'none' | 'small' | 'moderate' | 'large';
  consistency?: number; // 0-100
  socialJetlagMin?: number; // weekend vs weekday sleep midpoint shift
  suggestedBed?: { hour: number; minute: number };
  text: string;
}

/** Minutes after 18:00 local so bed times either side of midnight sit on one axis. */
const fromEvening = (t: number) => {
  const d = new Date(t);
  return (d.getHours() * 60 + d.getMinutes() - 18 * 60 + 1440) % 1440;
};
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : undefined;
};

export function computeSleepBalance(days: DailyData[], needHours: number, tonightNeedHours: number): SleepBalance {
  const withSleep = days.filter((d) => d.sleep);
  const last7 = withSleep.slice(-7);
  const hours = last7.map((d) => summarizeSession(d.sleep!).asleepMin / 60);
  // Surplus offsets at most 25% of the shortfall, so one long night does not wipe out a week of short ones.
  const short = hours.reduce((s, h) => s + Math.max(0, needHours - h), 0);
  const surplus = hours.reduce((s, h) => s + Math.max(0, h - needHours), 0);
  const debt = round(Math.max(0, short - Math.min(surplus, 0.25 * short)), 1);
  const debtLevel = debt < 1 ? 'none' : debt < 4 ? 'small' : debt < 8 ? 'moderate' : 'large';

  const recent14 = withSleep.slice(-14);
  let consistency: number | undefined;
  if (last7.length >= 3) {
    const bed = sd(last7.map((d) => fromEvening(d.sleep!.start)));
    const wake = sd(last7.map((d) => fromEvening(d.sleep!.end)));
    consistency = round(100 * clamp(1 - (bed + wake) / 2 / 120, 0, 1));
  }

  // Midpoint of sleep on weekend mornings (Sat/Sun wake-ups) vs weekday mornings, last 4 weeks.
  let socialJetlagMin: number | undefined;
  const mid = (d: DailyData) => fromEvening((d.sleep!.start + d.sleep!.end) / 2);
  const isWeekend = (d: DailyData) => {
    const w = new Date(d.sleep!.end).getDay();
    return w === 0 || w === 6;
  };
  const wk = withSleep.slice(-28);
  const we = wk.filter(isWeekend).map(mid);
  const wd = wk.filter((d) => !isWeekend(d)).map(mid);
  if (we.length >= 3 && wd.length >= 8) socialJetlagMin = round(mean(we) - mean(wd));

  // Bedtime that gives tonight's need before the usual wake time, with ~20 minutes to fall asleep.
  let suggestedBed: SleepBalance['suggestedBed'];
  const wakeMed = median(recent14.map((d) => fromEvening(d.sleep!.end)));
  if (defined(wakeMed) && recent14.length >= 4) {
    const bedMin = (((wakeMed - tonightNeedHours * 60 - 20 + 18 * 60) % 1440) + 1440) % 1440;
    suggestedBed = { hour: Math.floor(bedMin / 60), minute: Math.round(bedMin % 60) % 60 };
  }

  let text: string;
  if (last7.length < 3) text = 'Needs about 3 nights of sleep data to estimate your sleep debt.';
  else if (debtLevel === 'none') text = 'No meaningful sleep debt this week. Keep the routine.';
  else if (debtLevel === 'small') text = `About ${debt} h behind your need this week. One earlier night will cover it.`;
  else if (debtLevel === 'moderate') text = `${debt} h behind this week. Aim for 30 to 45 minutes extra on each of the next few nights rather than one long sleep-in.`;
  else text = `${debt} h behind this week, which is a lot. Protect sleep for several nights and go easier on training until it comes down.`;

  return {
    nights: last7.length,
    needHours: round(needHours, 1),
    avgHours: hours.length ? round(mean(hours), 1) : undefined,
    debtHours: debt,
    debtLevel,
    consistency,
    socialJetlagMin,
    suggestedBed,
    text,
  };
}
