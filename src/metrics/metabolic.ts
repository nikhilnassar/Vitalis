import { DailyData, UserProfile } from '../types';
import { estimateMaxHr } from './strain';
import { StrainResult } from './strain';
import { clamp, defined, mean, round } from './util';

export interface MetabolicResult {
  bmr: number; // kcal/day at rest
  bmrMethod: 'katch-mcardle' | 'mifflin-st-jeor';
  activeKcal: number; // today so far (tracker value, or estimated)
  activeSource: 'tracker' | 'estimated';
  tdee: number; // bmr + active
  avgTdee7d?: number;
  leanMassKg?: number;
  metabolicAge?: number; // only with body-fat data
  fatBurnZone: { low: number; high: number }; // bpm, ~60-70% of max HR
  cardioZone: { low: number; high: number }; // bpm, 70-85%
  zoneMinutes: { fatBurn: number; cardio: number; peak: number };
  fitnessScore: number; // 0-100 composite, see below
  fitnessParts: { name: string; score: number }[];
}

export function mifflin(p: UserProfile, age = p.age): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161);
}

function activeFor(day: DailyData, profile: UserProfile): { kcal: number; source: 'tracker' | 'estimated' } {
  if (defined(day.activeKcal) && day.activeKcal > 0) return { kcal: day.activeKcal, source: 'tracker' };
  const workoutKcal = day.workouts.reduce((s, w) => s + (w.kcal ?? 0), 0);
  const stepKcal = (day.steps ?? 0) * 0.04 * (profile.weightKg / 70);
  return { kcal: workoutKcal + stepKcal, source: 'estimated' };
}

export function computeMetabolic(
  profile: UserProfile,
  days: DailyData[], // oldest first, last = today
  todayStrain?: StrainResult,
  bodyFatPct?: number,
): MetabolicResult {
  const today = days[days.length - 1];
  const bf = bodyFatPct ?? profile.bodyFatPct;

  let bmr: number;
  let method: MetabolicResult['bmrMethod'];
  let lean: number | undefined;
  let metabolicAge: number | undefined;
  if (defined(bf)) {
    lean = profile.weightKg * (1 - bf / 100);
    bmr = 370 + 21.6 * lean; // Katch-McArdle
    method = 'katch-mcardle';
    // Mifflin slope is ~5 kcal per year; a faster-than-predicted BMR reads "younger".
    metabolicAge = round(clamp(profile.age - (bmr - mifflin(profile)) / 5, profile.age - 15, profile.age + 15));
  } else {
    bmr = mifflin(profile);
    method = 'mifflin-st-jeor';
  }

  const active = today ? activeFor(today, profile) : { kcal: 0, source: 'estimated' as const };
  const last7 = days.slice(-7).map((d) => bmr + activeFor(d, profile).kcal);

  const hrMax = estimateMaxHr(profile);
  const zones = {
    fatBurn: { low: round(hrMax * 0.6), high: round(hrMax * 0.7) },
    cardio: { low: round(hrMax * 0.7), high: round(hrMax * 0.85) },
  };
  const zm = { fatBurn: 0, cardio: 0, peak: 0 };
  if (today) {
    const s = [...today.hrSamples].sort((a, b) => a.t - b.t);
    for (let i = 0; i < s.length; i++) {
      const next = i + 1 < s.length ? s[i + 1].t : s[i].t + 5 * 60_000;
      const min = Math.min(next - s[i].t, 6 * 60_000) / 60_000;
      const b = s[i].bpm;
      if (b >= hrMax * 0.85) zm.peak += min;
      else if (b >= zones.cardio.low) zm.cardio += min;
      else if (b >= zones.fatBurn.low) zm.fatBurn += min;
    }
  }

  // Metabolic fitness: transparent composite of things that track metabolic health.
  const recent = days.slice(-14);
  const rhr = mean(recent.map((d) => d.rhr).filter(defined));
  const steps = mean(recent.map((d) => d.steps).filter(defined));
  const parts: { name: string; score: number }[] = [];
  if (!Number.isNaN(rhr)) parts.push({ name: 'Resting heart rate', score: round(clamp((80 - rhr) / 30, 0, 1) * 100) });
  if (!Number.isNaN(steps)) parts.push({ name: 'Daily movement', score: round(clamp(steps / 10000, 0, 1) * 100) });
  const vo2 = [...recent].reverse().find((d) => defined(d.vo2max))?.vo2max;
  if (defined(vo2)) parts.push({ name: 'Cardio fitness', score: round(clamp((vo2 - 25) / 30, 0, 1) * 100) });
  if (defined(bf)) {
    const mid = profile.sex === 'male' ? 15 : 24;
    parts.push({ name: 'Body composition', score: round(clamp(1 - Math.abs(bf - mid) / 15, 0, 1) * 100) });
  }

  return {
    bmr: round(bmr),
    bmrMethod: method,
    activeKcal: round(active.kcal),
    activeSource: active.source,
    tdee: round(bmr + active.kcal),
    avgTdee7d: last7.length ? round(mean(last7)) : undefined,
    leanMassKg: defined(lean) ? round(lean, 1) : undefined,
    metabolicAge,
    fatBurnZone: zones.fatBurn,
    cardioZone: zones.cardio,
    zoneMinutes: { fatBurn: round(zm.fatBurn), cardio: round(zm.cardio), peak: round(zm.peak) },
    fitnessScore: parts.length ? round(mean(parts.map((p) => p.score))) : 0,
    fitnessParts: parts,
  };
}
