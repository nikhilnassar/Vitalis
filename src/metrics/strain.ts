import { DailyData, UserProfile } from '../types';
import { MIN, clamp, dayStart, round } from './util';

export interface StrainResult {
  strain: number; // 0-21
  load: number; // weighted zone-minutes (Edwards-style TRIMP)
  zoneMinutes: number[]; // index 0 = below 50% HRR, 1..5 = zones 1-5
  avgHr?: number;
  peakHr?: number;
  source: 'heart-rate' | 'estimated';
}

const ZONE_WEIGHTS = [0, 1, 2, 3, 4, 5];
const MAX_HOLD = 6 * MIN; // a sample represents at most 6 minutes
const K = 180; // load at which strain reaches ~63% of the 21 ceiling

export function estimateMaxHr(p: UserProfile): number {
  return p.maxHr ?? 208 - 0.7 * p.age; // Tanaka et al. 2001
}

/** Convert weighted zone-minutes to a 0-21 logarithmic-style scale (diminishing returns). */
export const loadToStrain = (load: number) => 21 * (1 - Math.exp(-load / K));

export function computeStrain(day: DailyData, profile: UserProfile, restingHr?: number): StrainResult {
  const hrMax = estimateMaxHr(profile);
  const hrRest = day.rhr ?? restingHr ?? 60;
  const reserve = Math.max(hrMax - hrRest, 40);

  const from = dayStart(day.date);
  const to = from + 24 * 60 * MIN;
  const asleepFrom = day.sleep?.start ?? Infinity;
  const asleepTo = day.sleep?.end ?? -Infinity;

  const samples = day.hrSamples
    .filter((s) => s.t >= from && s.t < to && !(s.t >= asleepFrom && s.t < asleepTo))
    .sort((a, b) => a.t - b.t);

  const zoneMinutes = [0, 0, 0, 0, 0, 0];

  if (samples.length >= 30) {
    let load = 0;
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const next = i + 1 < samples.length ? samples[i + 1].t : samples[i].t + MAX_HOLD;
      const minutes = Math.min(next - samples[i].t, MAX_HOLD) / MIN;
      const pct = (samples[i].bpm - hrRest) / reserve;
      const zone = pct < 0.5 ? 0 : Math.min(5, Math.floor(pct * 10) - 4); // 0.5-0.6 -> 1 ... >=0.9 -> 5
      zoneMinutes[zone] += minutes;
      load += ZONE_WEIGHTS[zone] * minutes;
      sum += samples[i].bpm;
      peak = Math.max(peak, samples[i].bpm);
    }
    return {
      strain: round(clamp(loadToStrain(load), 0, 21), 1),
      load: round(load, 1),
      zoneMinutes: zoneMinutes.map((m) => round(m, 1)),
      avgHr: round(sum / samples.length),
      peakHr: peak,
      source: 'heart-rate',
    };
  }

  // No usable heart-rate stream: rough estimate from workouts and steps.
  const workoutMin = day.workouts.reduce((s, w) => s + (w.end - w.start) / MIN, 0);
  const load = workoutMin * 2.2 + (day.steps ?? 0) / 2500;
  return {
    strain: round(clamp(loadToStrain(load), 0, 21), 1),
    load: round(load, 1),
    zoneMinutes,
    source: 'estimated',
  };
}
