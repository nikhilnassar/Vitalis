import { RawHealthData, SleepSegment, emptyRaw } from '../types';
import { HOUR, MIN, addDays, dayKey, dayStart } from '../metrics/util';

// Deterministic PRNG so demo data and tests are repeatable.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ~3 months of plausible tracker data for a 34-year-old male, ending on `now`.
 * A hidden "life load" signal drifts day to day and nudges HRV, resting HR, sleep and BP together,
 * so the demo has real structure for the personal BP model to find. A stressed stretch sits a few days ago.
 */
export function demoRaw(now = Date.now(), days = 90, seed = 7): RawHealthData {
  const r = rng(seed);
  const gauss = () => (r() + r() + r() + r() - 2) * 1.73; // ~N(0,1)
  const raw = emptyRaw();
  raw.profile = { age: 34, sex: 'male', heightCm: 178, weightKg: 79 };
  const today = dayKey(now);
  let lat = 0;

  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const d0 = dayStart(date);
    lat = 0.6 * lat + 0.8 * gauss();
    const stress = i >= 3 && i <= 5 ? 1 : 0;
    const dayIsToday = i === 0;

    // Night ending this morning.
    const bed = d0 - (1.2 + r() * 0.8) * HOUR;
    const hours = 7.3 - stress * 1.4 - 0.25 * lat + (r() - 0.5) * 1.0;
    const wake = bed + hours * HOUR;
    const segs: SleepSegment[] = [];
    let t = bed;
    const cycle = [
      ['light', 25],
      ['deep', 40],
      ['light', 20],
      ['rem', 15],
      ['awake', 3],
      ['light', 30],
      ['deep', 20],
      ['rem', 25],
      ['light', 35],
      ['rem', 30],
      ['light', 40],
    ] as const;
    let ci = 0;
    while (t < wake) {
      const [stage, mins] = cycle[ci % cycle.length];
      const end = Math.min(wake, t + mins * MIN);
      segs.push({ start: t, end, stage });
      t = end;
      ci++;
    }
    raw.sleep.push(...segs);

    // Overnight physiology.
    const hrv = 62 * (1 - 0.22 * stress) * (1 - 0.08 * lat) + (r() - 0.5) * 8;
    const rhr = 53 + stress * 4 + 1.3 * lat + (r() - 0.5) * 2;
    for (let k = 0; k < 6; k++) raw.hrv.push({ t: bed + (k + 1) * hours * 0.15 * HOUR, ms: hrv + (r() - 0.5) * 6 });
    raw.respRate.push({ t: bed + 3 * HOUR, rpm: 14.2 + stress * 0.8 + 0.2 * lat + (r() - 0.5) * 0.5 });
    raw.restingHr.push({ t: wake + 2 * HOUR, bpm: Math.round(rhr) });
    for (let m = bed; m < wake; m += 10 * MIN) raw.heartRate.push({ t: m, bpm: Math.round(rhr + 2 + r() * 6) });

    // Daytime HR and an optional workout.
    const dayEnd = dayIsToday ? Math.min(now, d0 + 18 * HOUR) : d0 + 23 * HOUR;
    const hasWorkout = !dayIsToday && i % 2 === 0 && !stress;
    const wStart = d0 + 17.5 * HOUR;
    for (let m = wake; m < dayEnd; m += 5 * MIN) {
      const inWorkout = hasWorkout && m >= wStart && m < wStart + 50 * MIN;
      raw.heartRate.push({ t: m, bpm: Math.round(inWorkout ? 140 + r() * 35 : 64 + r() * 22) });
    }
    if (hasWorkout) {
      raw.workouts.push({ start: wStart, end: wStart + 50 * MIN, type: 'run', kcal: 520 });
      for (let m = wStart; m < wStart + 50 * MIN; m += MIN / 2) raw.heartRate.push({ t: m, bpm: Math.round(142 + r() * 30) });
    }

    // Today: a morning run already done, so the demo's strain ring has something to show.
    if (dayIsToday) {
      const rs = wake + 1.5 * HOUR;
      if (rs + 40 * MIN <= now) {
        raw.workouts.push({ start: rs, end: rs + 40 * MIN, type: 'run', kcal: 430 });
        for (let m = rs; m < rs + 40 * MIN; m += MIN / 2) raw.heartRate.push({ t: m, bpm: Math.round(140 + r() * 28) });
      }
    }

    const steps = Math.round(6500 + r() * 4500 + (hasWorkout ? 3500 : 0));
    raw.steps.push({ start: wake + HOUR, end: wake + 2 * HOUR, count: steps });
    raw.activeEnergy.push({ start: wake + HOUR, end: wake + 2 * HOUR, kcal: Math.round(steps * 0.045 + (hasWorkout ? 520 : 0)) });

    // Cuff readings on roughly two days in three (seated, morning; sometimes an evening one too).
    if (r() < 0.68) {
      const tm = wake + 1 * HOUR;
      if (tm <= now) {
        raw.bp.push({
          t: tm,
          sys: Math.round(118 + 2.4 * lat + 3 * stress + gauss() * 2.2),
          dia: Math.round(76 + 1.5 * lat + 1.5 * stress + gauss() * 1.8),
          pulse: Math.round(rhr + 10),
          source: 'device',
        });
      }
      if (r() < 0.3 && d0 + 19 * HOUR <= now) {
        raw.bp.push({
          t: d0 + 19 * HOUR,
          sys: Math.round(121 + 2.4 * lat + gauss() * 2.4),
          dia: Math.round(78 + 1.5 * lat + gauss() * 1.9),
          source: 'device',
        });
      }
    }

    // Smart-scale weigh-in every other morning.
    if (i % 2 === 0) {
      const tw = wake + 0.5 * HOUR;
      if (tw <= now) {
        const kg = 80.5 - 0.03 * (days - 1 - i) + (r() - 0.5) * 0.8;
        const bf = 18.5 - 0.02 * (days - 1 - i) + (r() - 0.5) * 0.6;
        raw.weight.push({ t: tw, kg });
        raw.bodyFat.push({ t: tw, pct: bf });
        raw.leanMass.push({ t: tw, kg: kg * (1 - bf / 100) });
        raw.bodyWater.push({ t: tw, kg: kg * (0.57 + (r() - 0.5) * 0.02) });
        raw.boneMass.push({ t: tw, kg: 3.2 });
      }
    }
  }

  raw.vo2max.push({ t: now - 20 * 24 * HOUR, value: 46.5 });
  return raw;
}
