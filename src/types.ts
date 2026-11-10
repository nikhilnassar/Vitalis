// Shared types. All timestamps are epoch milliseconds. Dates are local "YYYY-MM-DD".

export type Sex = 'male' | 'female';

export interface UserProfile {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number;
  maxHr?: number; // measured max HR; otherwise Tanaka estimate (208 - 0.7 * age)
  sleepNeedHours?: number; // baseline need, default 8
}

export type SleepStageName = 'awake' | 'light' | 'deep' | 'rem' | 'asleep' | 'inbed';

export interface SleepSegment {
  start: number;
  end: number;
  stage: SleepStageName;
}

export interface HrSample {
  t: number;
  bpm: number;
}

export interface Workout {
  start: number;
  end: number;
  type: string;
  kcal?: number;
}

export interface SleepSession {
  start: number;
  end: number;
  segments: SleepSegment[];
}

export interface BpReading {
  t: number;
  sys: number; // mmHg
  dia: number; // mmHg
  pulse?: number;
  source?: 'device' | 'manual';
}

/** Everything known about one local calendar day (sleep = the main session ending that day). */
export interface DailyData {
  date: string;
  sleep?: SleepSession;
  hrv?: number; // overnight mean, ms
  rhr?: number; // resting heart rate, bpm
  respRate?: number; // breaths per minute, overnight
  hrSamples: HrSample[];
  steps?: number;
  activeKcal?: number;
  workouts: Workout[];
  vo2max?: number; // latest known (carried forward)
  // Body measurements are only set on days when something was actually measured (not carried forward).
  weightKg?: number;
  bodyFatPct?: number;
  leanMassKg?: number;
  bodyWaterPct?: number;
  boneMassKg?: number;
  bp: BpReading[]; // cuff readings taken that day
}

/** Raw platform samples, before grouping into days. Both adapters (and the demo) produce this. */
export interface RawHealthData {
  profile: Partial<UserProfile>;
  heartRate: HrSample[];
  hrv: { t: number; ms: number }[];
  restingHr: { t: number; bpm: number }[];
  respRate: { t: number; rpm: number }[];
  sleep: SleepSegment[];
  steps: { start: number; end: number; count: number }[];
  activeEnergy: { start: number; end: number; kcal: number }[];
  workouts: Workout[];
  vo2max: { t: number; value: number }[];
  weight: { t: number; kg: number }[];
  bodyFat: { t: number; pct: number }[];
  leanMass: { t: number; kg: number }[];
  bodyWater: { t: number; kg: number }[];
  boneMass: { t: number; kg: number }[];
  bp: BpReading[];
}

export const emptyRaw = (): RawHealthData => ({
  profile: {},
  heartRate: [],
  hrv: [],
  restingHr: [],
  respRate: [],
  sleep: [],
  steps: [],
  activeEnergy: [],
  workouts: [],
  vo2max: [],
  weight: [],
  bodyFat: [],
  leanMass: [],
  bodyWater: [],
  boneMass: [],
  bp: [],
});
