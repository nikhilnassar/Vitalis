import { DailyData, UserProfile } from '../types';
import { MIN, clamp, dayStart, round } from './util';

export interface WorkoutStrain {
  type: string;
  start: number;
  end: number;
  minutes: number;
  strain: number; // what this session alone would score, 0-21
  load: number;
  zoneMinutes: number[]; // index 0 = below 50% HRR, 1..5 = zones 1-5
  avgHr?: number;
  peakHr?: number;
}

export interface StrainResult {
  workouts: WorkoutStrain[];
  strain: number; // 0-21
  load: number; // weighted zone-minutes (Edwards-style TRIMP)
  zoneMinutes: number[]; // index 0 = below 50% HRR, 1..5 = zones 1-5
  avgHr?: number;
  peakHr?: number;
  movementLoad: number; // credit for steps / active calories that heart rate alone did not capture
  source: 'heart-rate' | 'estimated';
  hasData: boolean; // false when there is no heart-rate stream, workout or step count to base a score on
}

const ZONE_WEIGHTS = [0, 1, 2, 3, 4, 5];
const MAX_HOLD = 6 * MIN; // a sample represents at most 6 minutes
const K = 180; // load at which strain reaches ~63% of the 21 ceiling

/**
 * Everyday movement (walking, chores) rarely lifts heart rate into the zones above ~50% of reserve, so a
 * heart-rate-only score stays at 0 on active-but-easy days. Steps and active calories add a modest credit
 * (about 3.5 strain for 10,000 steps), tapered away as zone-based load grows so nothing is counted twice.
 */
export function movementCredit(day: DailyData, zoneLoad: number): number {
  const fromSteps = Math.min(60, (day.steps ?? 0) / 300);
  const fromKcal = Math.min(60, (day.activeKcal ?? 0) / 12);
  const base = Math.max(fromSteps, fromKcal);
  return round(base * Math.max(0, 1 - zoneLoad / 80), 1);
}

export function estimateMaxHr(p: UserProfile): number {
  return p.maxHr ?? 208 - 0.7 * p.age; // Tanaka et al. 2001
}

/** Convert weighted zone-minutes to a 0-21 logarithmic-style scale (diminishing returns). */
export const loadToStrain = (load: number) => 21 * (1 - Math.exp(-load / K));

function zoneOf(bpm: number, hrRest: number, reserve: number) {
  const pct = (bpm - hrRest) / reserve;
  return pct < 0.5 ? 0 : Math.min(5, Math.floor(pct * 10) - 4);
}

/** Score each workout on its own from the heart-rate samples recorded during it. */
export function computeWorkoutStrains(day: DailyData, hrMax: number, hrRest: number): WorkoutStrain[] {
  const reserve = Math.max(hrMax - hrRest, 40);
  const out: WorkoutStrain[] = [];
  for (const w of day.workouts) {
    const s = day.hrSamples.filter((x) => x.t >= w.start && x.t <= w.end).sort((a, b) => a.t - b.t);
    const minutes = Math.max(0, round((w.end - w.start) / MIN, 0));
    if (s.length < 3) {
      out.push({ type: w.type, start: w.start, end: w.end, minutes, strain: 0, load: 0, zoneMinutes: [0, 0, 0, 0, 0, 0] });
      continue;
    }
    const zm = [0, 0, 0, 0, 0, 0];
    let load = 0;
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < s.length; i++) {
      const next = i + 1 < s.length ? s[i + 1].t : Math.min(w.end, s[i].t + MAX_HOLD);
      const m = Math.max(0, Math.min(next - s[i].t, MAX_HOLD)) / MIN;
      const z = zoneOf(s[i].bpm, hrRest, reserve);
      zm[z] += m;
      load += ZONE_WEIGHTS[z] * m;
      sum += s[i].bpm;
      peak = Math.max(peak, s[i].bpm);
    }
    out.push({ type: w.type, start: w.start, end: w.end, minutes, strain: round(clamp(loadToStrain(load), 0, 21), 1), load: round(load, 1), zoneMinutes: zm.map((m) => round(m, 1)), avgHr: round(sum / s.length), peakHr: peak });
  }
  return out.sort((a, b) => a.start - b.start);
}

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
    const movementLoad = movementCredit(day, load);
    load += movementLoad;
    return {
      strain: round(clamp(loadToStrain(load), 0, 21), 1),
      load: round(load, 1),
      movementLoad,
      workouts: computeWorkoutStrains(day, hrMax, hrRest),
      zoneMinutes: zoneMinutes.map((m) => round(m, 1)),
      avgHr: round(sum / samples.length),
      peakHr: peak,
      source: 'heart-rate',
      hasData: true,
    };
  }

  // No usable heart-rate stream: rough estimate from workouts and steps.
  const workoutMin = day.workouts.reduce((s, w) => s + (w.end - w.start) / MIN, 0);
  const load = workoutMin * 2.2 + (day.steps ?? 0) / 2500;
  return {
    strain: round(clamp(loadToStrain(load), 0, 21), 1),
    load: round(load, 1),
    movementLoad: 0,
    workouts: computeWorkoutStrains(day, hrMax, hrRest),
    zoneMinutes,
    source: 'estimated',
    hasData: day.workouts.length > 0 || (day.steps ?? 0) > 0,
  };
}
