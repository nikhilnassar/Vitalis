import { DailyData } from '../types';
import type { DayMetrics } from './analyze';
import { defined, mean, round, sd } from './util';

/** One local day of self-reported context. `date` is the day the habits happened on. */
export interface JournalEntry {
  date: string; // YYYY-MM-DD
  habits: string[]; // habit ids
  feel?: 1 | 2 | 3 | 4 | 5; // how you felt that morning
}

export const HABITS = [
  { id: 'alcohol', label: 'Alcohol', emoji: '🍷' },
  { id: 'caffeine-late', label: 'Late caffeine', emoji: '☕' },
  { id: 'late-meal', label: 'Late meal', emoji: '🍕' },
  { id: 'stress', label: 'Stressful day', emoji: '😤' },
  { id: 'screens', label: 'Screens in bed', emoji: '📱' },
  { id: 'nap', label: 'Nap', emoji: '😴' },
  { id: 'sauna-cold', label: 'Sauna / cold', emoji: '🧖' },
  { id: 'meditation', label: 'Meditation', emoji: '🧘' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'sick', label: 'Feeling unwell', emoji: '🤒' },
] as const;

export const FEEL = [
  { v: 1, emoji: '😩', label: 'Awful' },
  { v: 2, emoji: '😕', label: 'Meh' },
  { v: 3, emoji: '😐', label: 'Okay' },
  { v: 4, emoji: '🙂', label: 'Good' },
  { v: 5, emoji: '🤩', label: 'Great' },
] as const;

export interface HabitEffect {
  id: string;
  label: string;
  emoji: string;
  marker: string;
  unit: string;
  diff: number; // mean with habit minus mean without, in marker units
  good: boolean;
  nWith: number;
  nWithout: number;
  t: number;
  sentence: string;
}

export interface FeelCheck {
  n: number;
  r?: number;
  verdict: 'learning' | 'matches' | 'weak' | 'mismatch';
  text: string;
}

export interface JournalInsights {
  loggedDays: number;
  effects: HabitEffect[];
  feel: FeelCheck;
  ready: boolean;
}

export const MIN_LOGGED_DAYS = 14;
const MIN_PER_GROUP = 4;

/** Welch t with a day-count discount, since consecutive days are not independent. */
function welchT(a: number[], b: number[]) {
  const va = sd(a) ** 2 / (a.length / 2);
  const vb = sd(b) ** 2 / (b.length / 2);
  const se = Math.sqrt(va + vb);
  return se ? (mean(a) - mean(b)) / se : 0;
}

export function computeJournalInsights(days: DailyData[], metrics: DayMetrics[], entries: JournalEntry[]): JournalInsights {
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const idx = new Map(days.map((d, i) => [d.date, i]));

  // Habit logged on day D -> biomarker the morning of D+1.
  const markers = [
    { name: 'next-morning HRV', unit: 'ms', higherIsGood: true, get: (i: number) => days[i].hrv },
    { name: 'next-morning resting heart rate', unit: 'bpm', higherIsGood: false, get: (i: number) => days[i].rhr },
    { name: 'next-day recovery', unit: 'points', higherIsGood: true, get: (i: number) => (metrics[i].recovery.status === 'ok' ? metrics[i].recovery.score ?? undefined : undefined) },
  ];

  const logged = entries.filter((e) => idx.has(e.date));
  const loggedDays = logged.length;
  const effects: HabitEffect[] = [];

  if (loggedDays >= MIN_LOGGED_DAYS) {
    for (const h of HABITS) {
      for (const m of markers) {
        const withH: number[] = [];
        const without: number[] = [];
        for (const e of logged) {
          const i = idx.get(e.date)!;
          if (i + 1 >= days.length) continue;
          const y = m.get(i + 1);
          if (y == null) continue;
          (e.habits.includes(h.id) ? withH : without).push(y);
        }
        if (withH.length < MIN_PER_GROUP || without.length < MIN_PER_GROUP) continue;
        const t = welchT(withH, without);
        if (Math.abs(t) < 2) continue;
        const diff = round(mean(withH) - mean(without), 1);
        if (diff === 0) continue;
        const good = diff > 0 === m.higherIsGood;
        effects.push({
          id: h.id,
          label: h.label,
          emoji: h.emoji,
          marker: m.name,
          unit: m.unit,
          diff,
          good,
          nWith: withH.length,
          nWithout: without.length,
          t: round(t, 1),
          sentence: `${h.label.toLowerCase()} days: ${m.name} was ${Math.abs(diff)} ${m.unit} ${diff > 0 ? 'higher' : 'lower'} (${withH.length} days with, ${without.length} without)`,
        });
      }
    }
  }
  // Keep the strongest effect per habit so one habit does not fill the list.
  effects.sort((a, b) => Math.abs(b.t) - Math.abs(a.t));
  const seen = new Set<string>();
  const top = effects.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))).slice(0, 5);

  return { loggedDays, effects: top, feel: feelCheck(days, metrics, byDate), ready: loggedDays >= MIN_LOGGED_DAYS };
}

/** Does your own morning rating line up with the recovery score? Tells you whether to trust it. */
function feelCheck(days: DailyData[], metrics: DayMetrics[], byDate: Map<string, JournalEntry>): FeelCheck {
  const xs: number[] = [];
  const ys: number[] = [];
  days.forEach((d, i) => {
    const e = byDate.get(d.date);
    const s = metrics[i].recovery;
    if (e?.feel && s.status === 'ok' && s.score != null) {
      xs.push(e.feel);
      ys.push(s.score);
    }
  });
  if (xs.length < 10) return { n: xs.length, verdict: 'learning', text: `Rate how you feel each morning. After about 10 ratings Vitalis can tell you how well recovery matches you (${xs.length} so far).` };
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (!sxx || !syy) return { n: xs.length, verdict: 'learning', text: 'Your ratings have all been the same so far. Vary them honestly and a pattern can show.' };
  const r = round(sxy / Math.sqrt(sxx * syy), 2);
  const verdict = r >= 0.4 ? 'matches' : r >= 0.15 ? 'weak' : 'mismatch';
  const text =
    verdict === 'matches'
      ? `Recovery tracks how you feel (r = ${r}, ${xs.length} days). Its advice is worth trusting.`
      : verdict === 'weak'
        ? `Recovery only loosely follows how you feel (r = ${r}, ${xs.length} days). Treat it as one input, not the verdict.`
        : `Recovery is not matching how you feel (r = ${r}, ${xs.length} days). Your tracker may be missing HRV or heart rate; check Data check on the You tab.`;
  return { n: xs.length, r, verdict, text };
}
