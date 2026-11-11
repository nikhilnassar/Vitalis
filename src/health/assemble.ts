import { DailyData, RawHealthData, SleepSegment, SleepSession, UserProfile } from '../types';
import { HOUR, MIN, addDays, dayKey, dayStart, defined, mean, round } from '../metrics/util';

const SESSION_GAP = 90 * MIN; // segments closer than this belong to one night
const MIN_MAIN_SLEEP = 3 * HOUR;

/** Group stage segments into sleep sessions. */
export function groupSleep(segments: SleepSegment[]): SleepSession[] {
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const sessions: SleepSession[] = [];
  for (const seg of sorted) {
    const last = sessions[sessions.length - 1];
    if (last && seg.start - last.end <= SESSION_GAP) {
      last.segments.push(seg);
      last.end = Math.max(last.end, seg.end);
    } else {
      sessions.push({ start: seg.start, end: seg.end, segments: [seg] });
    }
  }
  return sessions.map(dropRedundantInBed);
}

/** Apple Health often writes an INBED block overlapping ASLEEP blocks; keep INBED only as the bounds. */
function dropRedundantInBed(s: SleepSession): SleepSession {
  const hasAsleep = s.segments.some((g) => g.stage !== 'inbed');
  if (!hasAsleep) return s;
  return { ...s, segments: s.segments.filter((g) => g.stage !== 'inbed') };
}

function inRange<T>(items: T[], get: (x: T) => number, from: number, to: number): T[] {
  return items.filter((x) => get(x) >= from && get(x) < to);
}

/** Overnight resting HR: the platform's own value, else the average of the lowest 5% of sleep HR. */
function restingFromSleep(hr: { t: number; bpm: number }[], s: SleepSession): number | undefined {
  const v = inRange(hr, (x) => x.t, s.start, s.end).map((x) => x.bpm).sort((a, b) => a - b);
  if (v.length < 20) return undefined;
  const k = Math.max(3, Math.floor(v.length * 0.05));
  return round(mean(v.slice(0, k)));
}

export function assemble(raw: RawHealthData, profile: UserProfile, lastDays = 90, now = Date.now()): DailyData[] {
  const today = dayKey(now);
  const keys: string[] = [];
  for (let i = lastDays - 1; i >= 0; i--) keys.push(addDays(today, -i));

  const sessions = groupSleep(raw.sleep).filter((s) => s.end - s.start >= MIN_MAIN_SLEEP);
  // One main (longest) session per wake-up date.
  const mainByDate = new Map<string, SleepSession>();
  for (const s of sessions) {
    const k = dayKey(s.end);
    const cur = mainByDate.get(k);
    if (!cur || s.end - s.start > cur.end - cur.start) mainByDate.set(k, s);
  }

  const latestOn = <T extends { t: number }>(items: T[], to: number): T | undefined => {
    let best: T | undefined;
    for (const x of items) if (x.t < to && (!best || x.t > best.t)) best = x;
    return best;
  };

  return keys.map((date) => {
    const from = dayStart(date);
    const to = from + 24 * HOUR;
    const sleep = mainByDate.get(date);

    const window = sleep ? [sleep.start, sleep.end] : [from, from + 10 * HOUR];
    const hrvVals = inRange(raw.hrv, (x) => x.t, window[0], window[1]).map((x) => x.ms);
    const respVals = inRange(raw.respRate, (x) => x.t, window[0], window[1]).map((x) => x.rpm);
    const platformRhr = inRange(raw.restingHr, (x) => x.t, from, to).map((x) => x.bpm);
    const hrDay = inRange(raw.heartRate, (x) => x.t, from - 12 * HOUR, to);

    const steps = inRange(raw.steps, (x) => x.start, from, to);
    const energy = inRange(raw.activeEnergy, (x) => x.start, from, to);
    // Body measurements are kept only on the days they were actually taken, so trends are not
    // padded with repeated carried-forward values. VO2max is a slow-moving estimate, so it carries forward.
    const measured = (items: { t: number; v: number }[], digits = 1): number | undefined => {
      const v = inRange(items, (x) => x.t, from, to).map((x) => x.v);
      return v.length ? round(mean(v), digits) : undefined;
    };
    const weightKg = measured(raw.weight.map((w) => ({ t: w.t, v: w.kg })), 2);
    const waterKg = measured(raw.bodyWater.map((w) => ({ t: w.t, v: w.kg })), 2);
    const vo2 = latestOn(raw.vo2max.map((x) => ({ t: x.t, v: x.value })), to);
    const bp = inRange(raw.bp, (x) => x.t, from, to).sort((a, b) => a.t - b.t);

    return {
      date,
      sleep,
      hrv: hrvVals.length ? round(mean(hrvVals), 1) : undefined,
      rhr: platformRhr.length ? round(mean(platformRhr)) : sleep ? restingFromSleep(hrDay, sleep) : undefined,
      respRate: respVals.length ? round(mean(respVals), 1) : undefined,
      hrSamples: hrDay.filter((x) => x.t >= from),
      steps: steps.length ? steps.reduce((s, x) => s + x.count, 0) : undefined,
      activeKcal: energy.length ? round(energy.reduce((s, x) => s + x.kcal, 0)) : undefined,
      workouts: inRange(raw.workouts, (x) => x.start, from, to),
      vo2max: vo2?.v,
      weightKg,
      bodyFatPct: measured(raw.bodyFat.map((b) => ({ t: b.t, v: b.pct }))),
      leanMassKg: measured(raw.leanMass.map((b) => ({ t: b.t, v: b.kg })), 2),
      boneMassKg: measured(raw.boneMass.map((b) => ({ t: b.t, v: b.kg })), 2),
      bodyWaterPct: waterKg !== undefined && weightKg ? round((waterKg / weightKg) * 100, 1) : undefined,
      bp,
    } satisfies DailyData;
  });
}

/** Build a complete profile from what the platform knows plus user-entered values. */
export function resolveProfile(entered: Partial<UserProfile>, fromPlatform: Partial<UserProfile>): UserProfile | undefined {
  const p = { ...fromPlatform, ...entered };
  if (!defined(p.age) || !defined(p.sex) || !defined(p.heightCm) || !defined(p.weightKg)) return undefined;
  return p as UserProfile;
}

export interface CoverageItem {
  key: string;
  label: string;
  emoji: string;
  days: number; // distinct days with data in the window
  window: number;
  tip: string;
  latest?: number; // timestamp of the newest record, so late tracker syncs are visible
}

/** What the phone's health store is actually giving us, so missing data is visible instead of silent. */
export function coverage(raw: RawHealthData, platform: string, now = Date.now(), window = 7): CoverageItem[] {
  const from = dayKey(now - (window - 1) * 24 * HOUR);
  const daysOf = (ts: number[]) => new Set(ts.map((t) => dayKey(t)).filter((k) => k >= from)).size;
  const item = (key: string, label: string, emoji: string, ts: number[], tip: string): CoverageItem => ({ key, label, emoji, days: daysOf(ts), window, tip, latest: ts.length ? Math.max(...ts) : undefined });
  return [
    item('sleep', 'Sleep', '🌙', raw.sleep.map((x) => x.end), `Wear your tracker overnight and make sure it shares sleep with ${platform}.`),
    item('rhr', 'Resting heart rate', '🫀', [...raw.restingHr.map((x) => x.t), ...raw.heartRate.map((x) => x.t)], `Needed for recovery. Allow heart rate in ${platform}.`),
    item('hr', 'Heart-rate stream', '💓', raw.heartRate.map((x) => x.t), `Needed for strain. Turn on continuous heart rate sharing to ${platform} in your tracker's app.`),
    item('hrv', 'Overnight HRV', '📉', raw.hrv.map((x) => x.t), 'Many trackers do not share HRV. Recovery still works from resting heart rate and sleep, just with less precision.'),
    item('steps', 'Steps', '👟', raw.steps.map((x) => x.start), `Allow steps in ${platform}, and check your tracker's app is set to share them.`),
    item('energy', 'Active calories', '🔥', raw.activeEnergy.map((x) => x.start), 'Without these, calorie burn is estimated from steps and workouts.'),
    item('weight', 'Weight', '⚖️', raw.weight.map((x) => x.t), 'Turn on sharing in your scale app, or add weigh-ins by hand.'),
    item('bp', 'Blood pressure', '🩺', raw.bp.map((x) => x.t), 'Turn on sharing in your cuff app, or log readings by hand.'),
  ];
}
