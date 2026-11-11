// Android: reads Health Connect through react-native-health-connect.
// Garmin, Fitbit, Samsung, Oura, Polar, Withings, etc. all sync into Health Connect.
// NOTE: written against react-native-health-connect 4.x and not run on a device in the build sandbox.
import {
  initialize,
  getSdkStatus,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { RawHealthData, SleepSegment, emptyRaw } from '../types';

const TYPES = [
  'HeartRate',
  'HeartRateVariabilityRmssd',
  'RestingHeartRate',
  'RespiratoryRate',
  'SleepSession',
  'Steps',
  'ActiveCaloriesBurned',
  'Vo2Max',
  'Weight',
  'BodyFat',
  'Height',
  'ExerciseSession',
  'BloodPressure',
  'LeanBodyMass',
  'BodyWaterMass',
  'BoneMass',
] as const;

export async function requestAccess(): Promise<void> {
  const status = await getSdkStatus();
  if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
    throw new Error('Health Connect is not installed or needs an update (Play Store).');
  }
  if (!(await initialize())) throw new Error('Could not initialise Health Connect.');
  // The history permission lets us read beyond 30 days (BP readings are sparse, so the model needs a long window).
  await requestPermission([
    ...TYPES.map((recordType) => ({ accessType: 'read', recordType })),
    { accessType: 'read', recordType: 'ReadHealthDataHistory' },
  ] as any);
}

/** Background-safe: no permission dialogs (they cannot be shown headless), just make sure the client is ready. */
export async function initQuiet(): Promise<void> {
  if ((await getSdkStatus()) !== SdkAvailabilityStatus.SDK_AVAILABLE) throw new Error('Health Connect is not available.');
  if (!(await initialize())) throw new Error('Could not initialise Health Connect.');
}

/** Lets scheduled updates read while the app is closed. Asked only when the person turns on notifications. */
export async function requestBackgroundRead(): Promise<boolean> {
  try {
    await initQuiet();
    const granted: any[] = await requestPermission([{ accessType: 'read', recordType: 'BackgroundAccessPermission' }] as any);
    return granted.some((g) => g.recordType === 'BackgroundAccessPermission');
  } catch {
    return false;
  }
}

async function readAll(recordType: string, start: Date, end: Date): Promise<any[]> {
  const out: any[] = [];
  let pageToken: string | undefined;
  do {
    const res: any = await readRecords(recordType as any, {
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
      pageSize: 5000,
      pageToken,
    } as any);
    out.push(...(res.records ?? []));
    pageToken = res.pageToken;
  } while (pageToken);
  return out;
}

interface ReadResult {
  records: any[];
  error?: string; // set when the type could not be read at all (usually permission)
  limited?: boolean; // the long window was refused, so only the last ~30 days were read
}

/** Without the history permission a request reaching further back than 30 days is refused outright. */
async function read(recordType: string, start: Date, end: Date, fallbackStart: Date): Promise<ReadResult> {
  try {
    return { records: await readAll(recordType, start, end) };
  } catch {
    try {
      return { records: await readAll(recordType, fallbackStart, end), limited: true };
    } catch (e: any) {
      return { records: [], error: `${recordType}: ${String(e?.message ?? e).slice(0, 140)}` };
    }
  }
}

// Health Connect SleepStageRecord codes
const STAGE: Record<number, SleepSegment['stage'] | undefined> = {
  1: 'awake',
  2: 'asleep',
  4: 'light',
  5: 'deep',
  6: 'rem',
  7: 'awake',
};

const ts = (s: string) => new Date(s).getTime();

export async function readRaw(days = 90): Promise<RawHealthData> {
  // Without the history permission, Health Connect only exposes ~30 days before the first permission grant.
  const end = new Date();
  const start = new Date(end.getTime() - (days + 1) * 86400_000);
  const fallbackStart = new Date(end.getTime() - 29 * 86400_000);
  const raw = emptyRaw();

  const results = await Promise.all(
    [
      'HeartRate',
      'HeartRateVariabilityRmssd',
      'RestingHeartRate',
      'RespiratoryRate',
      'SleepSession',
      'Steps',
      'ActiveCaloriesBurned',
      'Vo2Max',
      'Weight',
      'BodyFat',
      'Height',
      'ExerciseSession',
      'BloodPressure',
      'LeanBodyMass',
      'BodyWaterMass',
      'BoneMass',
    ].map((t) => read(t, start, end, fallbackStart)),
  );
  const [hr, hrv, rhr, resp, sleep, steps, energy, vo2, weight, fat, height, ex, bp, lean, water, bone] = results.map((r) => r.records);
  raw.meta = {
    errors: results.map((r) => r.error).filter((e): e is string => !!e),
    limitedHistory: results.some((r) => r.limited),
  };

  for (const r of hr) for (const s of r.samples ?? []) raw.heartRate.push({ t: ts(s.time), bpm: s.beatsPerMinute });
  raw.hrv = hrv.map((r) => ({ t: ts(r.time), ms: r.heartRateVariabilityMillis }));
  raw.restingHr = rhr.map((r) => ({ t: ts(r.time), bpm: r.beatsPerMinute }));
  raw.respRate = resp.map((r) => ({ t: ts(r.time), rpm: r.rate }));

  for (const s of sleep) {
    const stages = s.stages ?? [];
    if (!stages.length) raw.sleep.push({ start: ts(s.startTime), end: ts(s.endTime), stage: 'asleep' });
    for (const g of stages) {
      const stage = STAGE[g.stage];
      if (stage) raw.sleep.push({ start: ts(g.startTime), end: ts(g.endTime), stage });
    }
  }

  raw.steps = steps.map((r) => ({ start: ts(r.startTime), end: ts(r.endTime), count: r.count }));
  raw.activeEnergy = energy.map((r) => ({ start: ts(r.startTime), end: ts(r.endTime), kcal: r.energy?.inKilocalories ?? 0 }));
  raw.vo2max = vo2.map((r) => ({ t: ts(r.time), value: r.vo2MillisecondsPerMinuteKilogram }));
  raw.weight = weight.map((r) => ({ t: ts(r.time), kg: r.weight?.inKilograms }));
  raw.bodyFat = fat.map((r) => ({ t: ts(r.time), pct: r.percentage }));
  raw.bp = bp
    .filter((r) => r.systolic?.inMillimetersOfMercury && r.diastolic?.inMillimetersOfMercury)
    .map((r) => ({ t: ts(r.time), sys: r.systolic.inMillimetersOfMercury, dia: r.diastolic.inMillimetersOfMercury, source: 'device' as const }));
  raw.leanMass = lean.map((r) => ({ t: ts(r.time), kg: r.mass?.inKilograms }));
  raw.bodyWater = water.map((r) => ({ t: ts(r.time), kg: r.mass?.inKilograms }));
  raw.boneMass = bone.map((r) => ({ t: ts(r.time), kg: r.mass?.inKilograms }));
  raw.workouts = ex.map((r) => ({ start: ts(r.startTime), end: ts(r.endTime), type: r.title ?? `type ${r.exerciseType}` }));

  const h = height[height.length - 1];
  if (h?.height?.inMeters) raw.profile.heightCm = h.height.inMeters * 100;
  const w = raw.weight[raw.weight.length - 1];
  if (w) raw.profile.weightKg = w.kg;
  const f = raw.bodyFat[raw.bodyFat.length - 1];
  if (f) raw.profile.bodyFatPct = f.pct;
  return raw;
}
