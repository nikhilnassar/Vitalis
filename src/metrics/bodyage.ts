import { DailyData, UserProfile } from '../types';
import { estimateMaxHr } from './strain';
import { summarizeSession } from './sleep';
import { clamp, defined, mean, round } from './util';

/**
 * Biological-age ESTIMATE. Each factor converts to "years older/younger than your calendar age".
 * Constants are rough, literature-inspired heuristics, not a validated clinical model.
 */
export interface AgeFactor {
  name: string;
  detail: string;
  years: number; // negative = younger
  estimated?: boolean;
}

export interface BioAgeResult {
  bioAge: number | null;
  offsetYears: number | null;
  factors: AgeFactor[];
  confidence: 'low' | 'medium' | 'high';
  missing: string[];
}

const cap = (x: number, c: number) => clamp(x, -c, c);

/** Age at which the population-median VO2max equals `v` (approximate linear decline). */
function vo2Age(v: number, sex: UserProfile['sex']): number {
  const [peak, slope] = sex === 'male' ? [50, 0.35] : [41, 0.3]; // mL/kg/min at 20, loss per year
  return clamp(20 + (peak - v) / slope, 18, 90);
}

function lastDefined<T>(vals: (T | undefined)[]): T | undefined {
  for (let i = vals.length - 1; i >= 0; i--) if (defined(vals[i])) return vals[i];
  return undefined;
}

export function estimateBioAge(profile: UserProfile, days: DailyData[]): BioAgeResult {
  const recent = days.slice(-30);
  const factors: AgeFactor[] = [];
  const missing: string[] = [];

  // 1. Cardiorespiratory fitness (largest weight)
  let vo2 = lastDefined(recent.map((d) => d.vo2max));
  let vo2Estimated = false;
  const rhrs = recent.map((d) => d.rhr).filter(defined);
  const rhrAvg = rhrs.length >= 5 ? mean(rhrs) : undefined;
  if (!defined(vo2) && defined(rhrAvg)) {
    vo2 = 15.3 * (estimateMaxHr(profile) / rhrAvg); // Uth et al. 2004 resting-HR estimate
    vo2Estimated = true;
  }
  if (defined(vo2)) {
    const years = cap(vo2Age(vo2, profile.sex) - profile.age, vo2Estimated ? 6 : 12);
    factors.push({
      name: 'Cardio fitness',
      detail: `VO2max ${round(vo2, 1)}${vo2Estimated ? ' (estimated from resting HR)' : ''}`,
      years: round(years, 1),
      estimated: vo2Estimated,
    });
  } else missing.push('VO2max or resting heart rate');

  // 2. Resting heart rate (~0.13 years per bpm around 60)
  if (defined(rhrAvg)) {
    factors.push({ name: 'Resting heart rate', detail: `${round(rhrAvg)} bpm average`, years: round(cap((rhrAvg - 60) * 0.13, 3), 1) });
  }

  // 3. HRV vs age norm (ln RMSSD ~ 4.0 at 25, falling ~0.017/yr). Wide person-to-person spread, so capped low.
  const hrvs = recent.map((d) => d.hrv).filter(defined);
  if (hrvs.length >= 5) {
    const lnAvg = mean(hrvs.map(Math.log));
    const hrvAge = 25 + (4.0 - lnAvg) / 0.017;
    factors.push({
      name: 'Heart-rate variability',
      detail: `${round(Math.exp(lnAvg))} ms average`,
      years: round(cap((hrvAge - profile.age) * 0.4, 4), 1),
    });
  } else missing.push('overnight HRV');

  // 4. Sleep duration (U-shaped around 7.5 h)
  const sleepHrs = recent.filter((d) => d.sleep).map((d) => summarizeSession(d.sleep!).asleepMin / 60);
  if (sleepHrs.length >= 5) {
    const avg = mean(sleepHrs);
    factors.push({
      name: 'Sleep duration',
      detail: `${round(avg, 1)} h average`,
      years: round(clamp((Math.abs(avg - 7.5) - 0.5) * 1.2, -1, 4), 1),
    });
  } else missing.push('sleep');

  // 5. Daily movement
  const steps = recent.map((d) => d.steps).filter(defined);
  if (steps.length >= 5) {
    const avg = mean(steps);
    factors.push({
      name: 'Daily steps',
      detail: `${round(avg).toLocaleString()} per day`,
      years: round(cap(-2.5 * Math.log2(Math.max(avg, 1500) / 7000), 4), 1),
    });
  } else missing.push('steps');

  // 6. Body composition
  const bf = profile.bodyFatPct ?? lastDefined(recent.map((d) => d.bodyFatPct));
  if (defined(bf)) {
    const mid = profile.sex === 'male' ? 14 + 0.1 * (profile.age - 20) : 23 + 0.1 * (profile.age - 20);
    const over = Math.max(0, Math.abs(bf - mid) - 4);
    factors.push({ name: 'Body fat', detail: `${round(bf, 1)}%`, years: round(Math.min(over * 0.4, 4), 1) });
  } else {
    const h = profile.heightCm / 100;
    const bmi = profile.weightKg / (h * h);
    const over = bmi > 25 ? bmi - 25 : bmi < 18.5 ? 18.5 - bmi : 0;
    factors.push({ name: 'BMI', detail: `${round(bmi, 1)} (add body fat for better accuracy)`, years: round(Math.min(over * 0.5, 4), 1), estimated: true });
  }

  if (!factors.some((f) => f.name === 'Cardio fitness')) {
    return { bioAge: null, offsetYears: null, factors, confidence: 'low', missing };
  }
  // Fitness, resting HR and HRV are correlated, so the plain sum double-counts; shrink it by 30%.
  const offset = 0.7 * factors.reduce((s, f) => s + f.years, 0);
  const real = factors.filter((f) => !f.estimated).length;
  const confidence = real >= 5 ? 'high' : real >= 3 ? 'medium' : 'low';
  return {
    bioAge: round(profile.age + clamp(offset, -15, 15), 1),
    offsetYears: round(clamp(offset, -15, 15), 1),
    factors,
    confidence,
    missing,
  };
}
