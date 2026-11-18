import { DailyData } from '../types';
import type { DayMetrics } from './analyze';
import type { JournalEntry } from './journal';
import { addDays, defined, mean, round, sd } from './util';

/** "Avoid late caffeine for 14 days", "do meditation for 14 days". Compared with the 14 mornings before it began. */
export interface Experiment {
  id: string;
  habit: string; // journal habit id
  mode: 'avoid' | 'do';
  start: string; // YYYY-MM-DD, the first day of the experiment
  days: number;
}

export interface ExperimentEffect {
  marker: string;
  unit: string;
  before: number;
  during: number;
  diff: number;
  good: boolean;
  t: number;
  significant: boolean;
}

export interface ExperimentResult {
  exp: Experiment;
  status: 'running' | 'done';
  dayNumber: number; // 1-based, capped at exp.days
  daysLeft: number;
  adherence?: { followed: number; logged: number };
  nBefore: number;
  nDuring: number;
  effects: ExperimentEffect[];
  verdict: 'helped' | 'hurt' | 'no-clear-effect' | 'not-enough-data';
  summary: string;
}

const BEFORE_DAYS = 14;
const MIN_N = 5;

function welch(a: number[], b: number[]) {
  const va = sd(a) ** 2 / (a.length / 2);
  const vb = sd(b) ** 2 / (b.length / 2);
  const se = Math.sqrt(va + vb);
  return se ? (mean(a) - mean(b)) / se : 0;
}

export function computeExperiments(exps: Experiment[], days: DailyData[], metrics: DayMetrics[], entries: JournalEntry[], today: string): ExperimentResult[] {
  const idx = new Map(days.map((d, i) => [d.date, i]));
  const markers = [
    { name: 'HRV', unit: 'ms', higherIsGood: true, get: (i: number) => days[i].hrv },
    { name: 'resting heart rate', unit: 'bpm', higherIsGood: false, get: (i: number) => days[i].rhr },
    { name: 'recovery', unit: 'points', higherIsGood: true, get: (i: number) => (metrics[i].recovery.status === 'ok' ? metrics[i].recovery.score ?? undefined : undefined) },
    { name: 'sleep score', unit: 'points', higherIsGood: true, get: (i: number) => metrics[i].sleep?.performance },
  ];

  return exps.map((exp) => {
    const end = addDays(exp.start, exp.days - 1);
    const done = today > end;
    const dayNumber = Math.min(exp.days, Math.max(1, Math.round((Date.parse(today) - Date.parse(exp.start)) / 86400000) + 1));
    const daysLeft = done ? 0 : Math.max(0, exp.days - dayNumber);

    // The habit on day D shows up in the morning of D+1, so the experiment's mornings are start+1 .. end+1.
    const duringDates: string[] = [];
    for (let k = 1; k <= exp.days; k++) {
      const d = addDays(exp.start, k);
      if (d <= today) duringDates.push(d);
    }
    const beforeDates: string[] = [];
    for (let k = 0; k < BEFORE_DAYS; k++) beforeDates.push(addDays(exp.start, -k));

    const ids = (ds: string[]) => ds.map((d) => idx.get(d)).filter(defined);
    const di = ids(duringDates);
    const bi = ids(beforeDates);

    const logged = entries.filter((e) => e.date >= exp.start && e.date <= end && e.date <= today);
    const followed = logged.filter((e) => (exp.mode === 'avoid' ? !e.habits.includes(exp.habit) : e.habits.includes(exp.habit))).length;
    const adherence = logged.length ? { followed, logged: logged.length } : undefined;

    const effects: ExperimentEffect[] = [];
    let nDuring = 0;
    let nBefore = 0;
    for (const m of markers) {
      const during = di.map((i) => m.get(i)).filter(defined);
      const before = bi.map((i) => m.get(i)).filter(defined);
      nDuring = Math.max(nDuring, during.length);
      nBefore = Math.max(nBefore, before.length);
      if (during.length < MIN_N || before.length < MIN_N) continue;
      const t = welch(during, before);
      const diff = round(mean(during) - mean(before), 1);
      effects.push({
        marker: m.name,
        unit: m.unit,
        before: round(mean(before), 1),
        during: round(mean(during), 1),
        diff,
        good: diff > 0 === m.higherIsGood,
        t: round(t, 1),
        significant: Math.abs(t) >= 2 && diff !== 0,
      });
    }

    const sig = effects.filter((e) => e.significant);
    const good = sig.filter((e) => e.good).length;
    const bad = sig.length - good;
    let verdict: ExperimentResult['verdict'];
    if (effects.length === 0) verdict = 'not-enough-data';
    else if (good > bad) verdict = 'helped';
    else if (bad > good) verdict = 'hurt';
    else verdict = 'no-clear-effect';

    const lowAdh = adherence && adherence.logged >= 5 && adherence.followed / adherence.logged < 0.7;
    const verb = exp.mode === 'avoid' ? 'Avoiding it' : 'Doing it';
    let summary: string;
    if (verdict === 'not-enough-data') summary = `Needs at least ${MIN_N} mornings of data during the experiment. ${nDuring} so far.`;
    else if (verdict === 'helped') summary = `${verb} lined up with better readings: ${sig.filter((e) => e.good).map((e) => `${e.marker} ${e.diff > 0 ? '+' : ''}${e.diff} ${e.unit}`).join(', ')}.`;
    else if (verdict === 'hurt') summary = `${verb} lined up with worse readings: ${sig.filter((e) => !e.good).map((e) => `${e.marker} ${e.diff > 0 ? '+' : ''}${e.diff} ${e.unit}`).join(', ')}. Other things may have changed too.`;
    else summary = `No clear change in your numbers so far. That is a real result: it probably is not a big lever for you.`;
    if (lowAdh) summary += ' You followed it on fewer than 70% of logged days, so treat this loosely.';
    if (!done && verdict !== 'not-enough-data') summary = 'Early read: ' + summary;

    return { exp, status: done ? 'done' : 'running', dayNumber, daysLeft, adherence, nBefore, nDuring, effects, verdict, summary };
  });
}
