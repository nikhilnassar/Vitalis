// iOS: reads Apple Health through react-native-health.
// NOTE: written against react-native-health 1.x. Native module calls could not be run in the build sandbox;
// verify unit handling (HRV seconds vs ms, weight units) on a real device. See README "Verify on device".
import AppleHealthKit from 'react-native-health';
import { RawHealthData, SleepSegment, emptyRaw } from '../types';

const HK: any = AppleHealthKit;
const P = HK.Constants?.Permissions ?? {};

const READ = [
  P.HeartRate,
  P.HeartRateVariability,
  P.RestingHeartRate,
  P.RespiratoryRate,
  P.SleepAnalysis,
  P.StepCount,
  P.ActiveEnergyBurned,
  P.Vo2Max,
  P.Weight,
  P.BodyFatPercentage,
  P.LeanBodyMass,
  P.BloodPressureSystolic,
  P.BloodPressureDiastolic,
  P.Workout,
  P.DateOfBirth,
  P.BiologicalSex,
  P.Height,
].filter(Boolean);

const call = <T = any>(fn: string, opts: any): Promise<T[]> =>
  new Promise((resolve) => {
    if (typeof HK[fn] !== 'function') return resolve([]);
    HK[fn](opts, (err: any, res: any) => resolve(err ? [] : Array.isArray(res) ? res : (res?.data ?? [])));
  });

const callOne = <T = any>(fn: string, opts: any): Promise<T | undefined> =>
  new Promise((resolve) => {
    if (typeof HK[fn] !== 'function') return resolve(undefined);
    HK[fn](opts, (err: any, res: any) => resolve(err ? undefined : res));
  });

export const requestAccess = () =>
  new Promise<void>((resolve, reject) =>
    HK.initHealthKit({ permissions: { read: READ, write: [] } }, (err: any) => (err ? reject(new Error(String(err))) : resolve())),
  );

const ts = (s: string) => new Date(s).getTime();

const SLEEP_MAP: Record<string, SleepSegment['stage']> = {
  INBED: 'inbed',
  ASLEEP: 'asleep',
  AWAKE: 'awake',
  CORE: 'light',
  DEEP: 'deep',
  REM: 'rem',
};

export async function readRaw(days = 90): Promise<RawHealthData> {
  const end = new Date();
  const start = new Date(end.getTime() - (days + 1) * 86400_000);
  const opts = { startDate: start.toISOString(), endDate: end.toISOString(), ascending: true, limit: 100000 };
  const raw = emptyRaw();

  const [hr, hrv, rhr, resp, sleep, steps, energy, vo2, weight, fat, workouts, bp, lean] = await Promise.all([
    call('getHeartRateSamples', opts),
    call('getHeartRateVariabilitySamples', opts),
    call('getRestingHeartRateSamples', opts),
    call('getRespiratoryRateSamples', opts),
    call('getSleepSamples', opts),
    call('getDailyStepCountSamples', { ...opts, period: 60 }),
    call('getActiveEnergyBurned', opts),
    call('getVo2MaxSamples', opts),
    call('getWeightSamples', { ...opts, unit: 'gram' }),
    call('getBodyFatPercentageSamples', opts),
    call('getAnchoredWorkouts', { startDate: opts.startDate, endDate: opts.endDate }),
    call('getBloodPressureSamples', { ...opts, unit: 'mmHg' }),
    call('getLeanBodyMassSamples', { ...opts, unit: 'gram' }),
  ]);

  raw.heartRate = hr.map((s) => ({ t: ts(s.startDate), bpm: s.value }));
  // HRV from HealthKit is SDNN. Some lib versions return seconds; normalise to ms.
  raw.hrv = hrv.map((s) => ({ t: ts(s.startDate), ms: s.value < 2 ? s.value * 1000 : s.value }));
  raw.restingHr = rhr.map((s) => ({ t: ts(s.startDate), bpm: s.value }));
  raw.respRate = resp.map((s) => ({ t: ts(s.startDate), rpm: s.value }));
  raw.sleep = sleep
    .filter((s) => SLEEP_MAP[s.value])
    .map((s) => ({ start: ts(s.startDate), end: ts(s.endDate), stage: SLEEP_MAP[s.value] }));
  raw.steps = steps.map((s) => ({ start: ts(s.startDate), end: ts(s.endDate), count: s.value }));
  raw.activeEnergy = energy.map((s) => ({ start: ts(s.startDate), end: ts(s.endDate), kcal: s.value }));
  raw.vo2max = vo2.map((s) => ({ t: ts(s.startDate), value: s.value }));
  raw.weight = weight.map((s) => ({ t: ts(s.startDate), kg: s.value > 1000 ? s.value / 1000 : s.value * 0.45359237 }));
  raw.bodyFat = fat.map((s) => ({ t: ts(s.startDate), pct: s.value <= 1 ? s.value * 100 : s.value }));
  raw.bp = bp
    .filter((s) => s.bloodPressureSystolicValue > 0 && s.bloodPressureDiastolicValue > 0)
    .map((s) => ({ t: ts(s.startDate), sys: s.bloodPressureSystolicValue, dia: s.bloodPressureDiastolicValue, source: 'device' as const }));
  raw.leanMass = lean.map((s) => ({ t: ts(s.startDate), kg: s.value > 1000 ? s.value / 1000 : s.value * 0.45359237 }));
  raw.workouts = workouts.map((w: any) => ({
    start: ts(w.start ?? w.startDate),
    end: ts(w.end ?? w.endDate),
    type: String(w.activityName ?? 'workout'),
    kcal: w.calories,
  }));

  const [dob, sex, height] = await Promise.all([
    callOne<any>('getDateOfBirth', undefined),
    callOne<any>('getBiologicalSex', undefined),
    callOne<any>('getLatestHeight', { unit: 'meter' }),
  ]);
  if (dob?.age) raw.profile.age = dob.age;
  if (sex?.value === 'male' || sex?.value === 'female') raw.profile.sex = sex.value;
  if (height?.value) raw.profile.heightCm = height.value < 3 ? height.value * 100 : height.value < 100 ? height.value * 2.54 : height.value;
  const w = raw.weight[raw.weight.length - 1];
  if (w) raw.profile.weightKg = w.kg;
  const f = raw.bodyFat[raw.bodyFat.length - 1];
  if (f) raw.profile.bodyFatPct = f.pct;
  return raw;
}
