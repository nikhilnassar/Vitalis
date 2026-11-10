import { DailyData } from '../types';
import { addDays, dayKey, daysBetween, defined, mean, round, slope } from './util';

export interface BodyCompResult {
  hasData: boolean;
  latest?: {
    date: string;
    weightKg: number;
    bodyFatPct?: number;
    leanKg?: number;
    fatKg?: number;
    waterPct?: number;
    boneKg?: number;
    bmi?: number;
  };
  avg7Kg?: number; // smoothed weight: daily readings swing 1-2 kg with water
  kgPerWeek?: number; // trend over the last 30 days
  bodyFatChange?: number; // percentage points, first vs latest reading in the last 30 days
  leanChangeKg?: number;
  series: { date: string; kg: number }[]; // last 60 days
  weighIns30: number;
  daysSinceWeighIn?: number;
}

const lastWith = <K extends keyof DailyData>(days: DailyData[], k: K) => [...days].reverse().find((d) => defined(d[k]));

export function computeBodyComp(days: DailyData[], heightCm?: number, now = Date.now()): BodyCompResult {
  const today = dayKey(now);
  const weighed = days.filter((d) => defined(d.weightKg));
  const series = weighed.filter((d) => d.date > addDays(today, -60)).map((d) => ({ date: d.date, kg: d.weightKg as number }));
  if (!weighed.length) return { hasData: false, series: [], weighIns30: 0 };

  const w = weighed[weighed.length - 1];
  const bfDay = lastWith(days, 'bodyFatPct');
  const leanDay = lastWith(days, 'leanMassKg');
  const waterDay = lastWith(days, 'bodyWaterPct');
  const boneDay = lastWith(days, 'boneMassKg');

  const weightKg = w.weightKg as number;
  const bf = bfDay?.bodyFatPct;
  const leanKg = leanDay?.leanMassKg ?? (defined(bf) ? round(weightKg * (1 - bf / 100), 1) : undefined);
  const fatKg = defined(bf) ? round((weightKg * bf) / 100, 1) : undefined;

  const last30 = series.filter((s) => s.date > addDays(today, -30));
  const kgPerWeek =
    last30.length >= 5
      ? (() => {
          const s = slope(last30.map((x) => daysBetween(last30[0].date, x.date)), last30.map((x) => x.kg));
          return defined(s) ? round(s * 7, 2) : undefined;
        })()
      : undefined;

  const last7 = series.filter((s) => s.date > addDays(today, -7)).map((s) => s.kg);
  const bf30 = days.filter((d) => defined(d.bodyFatPct) && d.date > addDays(today, -30));
  const lean30 = days.filter((d) => defined(d.leanMassKg) && d.date > addDays(today, -30));

  return {
    hasData: true,
    latest: {
      date: w.date,
      weightKg: round(weightKg, 1),
      bodyFatPct: defined(bf) ? round(bf, 1) : undefined,
      leanKg,
      fatKg,
      waterPct: waterDay?.bodyWaterPct,
      boneKg: boneDay?.boneMassKg,
      bmi: heightCm ? round(weightKg / (heightCm / 100) ** 2, 1) : undefined,
    },
    avg7Kg: last7.length ? round(mean(last7), 1) : round(weightKg, 1),
    kgPerWeek,
    bodyFatChange: bf30.length >= 2 ? round((bf30[bf30.length - 1].bodyFatPct as number) - (bf30[0].bodyFatPct as number), 1) : undefined,
    leanChangeKg: lean30.length >= 2 ? round((lean30[lean30.length - 1].leanMassKg as number) - (lean30[0].leanMassKg as number), 1) : undefined,
    series,
    weighIns30: last30.length,
    daysSinceWeighIn: daysBetween(w.date, today),
  };
}
