import { DailyData, SleepSession, UserProfile } from '../types';
import { HOUR, MIN, clamp, defined, round, sd, weightedAvg } from './util';

export interface SleepResult {
  start: number;
  end: number;
  hoursAsleep: number;
  hoursInBed: number;
  needHours: number;
  debtHours: number; // shortfall vs need for this night (0 if met)
  efficiency: number; // 0-100
  restorativePct?: number; // (deep + REM) / asleep, 0-100, only with stage data
  stageMinutes: { awake: number; light: number; deep: number; rem: number };
  hasStages: boolean;
  consistency?: number; // 0-100, regularity of bed/wake times over the last week
  performance: number; // 0-100
}

const ASLEEP = new Set(['asleep', 'light', 'deep', 'rem']);

export function summarizeSession(s: SleepSession) {
  const m = { awake: 0, light: 0, deep: 0, rem: 0, asleepGeneric: 0 };
  let hasStages = false;
  for (const seg of s.segments) {
    const mins = (seg.end - seg.start) / MIN;
    if (seg.stage === 'awake') m.awake += mins;
    else if (seg.stage === 'light') m.light += mins;
    else if (seg.stage === 'deep') {
      m.deep += mins;
      hasStages = true;
    } else if (seg.stage === 'rem') {
      m.rem += mins;
      hasStages = true;
    } else if (seg.stage === 'asleep') m.asleepGeneric += mins;
  }
  const asleepMin = m.light + m.deep + m.rem + m.asleepGeneric;
  return { ...m, asleepMin, hasStages };
}

/** Minutes after 18:00 local, so bedtimes either side of midnight sit on one axis. */
function minutesFromEvening(t: number): number {
  const d = new Date(t);
  const m = d.getHours() * 60 + d.getMinutes();
  return (m - 18 * 60 + 1440) % 1440;
}

function consistencyScore(sessions: SleepSession[]): number | undefined {
  const recent = sessions.slice(-7);
  if (recent.length < 3) return undefined;
  const bed = sd(recent.map((s) => minutesFromEvening(s.start)));
  const wake = sd(recent.map((s) => minutesFromEvening(s.end)));
  const avgSd = (bed + wake) / 2;
  return round(100 * clamp(1 - avgSd / 120, 0, 1));
}

/**
 * Sleep need: baseline + extra for the day's strain. For the recommendation about TONIGHT, also add a
 * partial repayment of recent debt. Scoring a past night leaves that repayment out, so a short night
 * is not penalised twice.
 */
export function sleepNeed(
  profile: UserProfile,
  recentAsleepHours: number[], // last nights, oldest first
  strain: number,
  includeDebt = true,
): number {
  const base = profile.sleepNeedHours ?? 8;
  const strainExtra = 0.8 * (strain / 21);
  const debt = recentAsleepHours.slice(-4).reduce((s, h) => s + Math.max(0, base - h), 0);
  const debtExtra = includeDebt ? clamp(0.2 * debt, 0, 0.75) : 0;
  return round(base + strainExtra + debtExtra, 2);
}

export function computeSleep(
  day: DailyData,
  history: DailyData[], // prior days, oldest first
  profile: UserProfile,
  prevStrain: number,
): SleepResult | undefined {
  if (!day.sleep) return undefined;
  const sum = summarizeSession(day.sleep);
  if (sum.asleepMin < 30) return undefined;

  const hoursAsleep = sum.asleepMin / 60;
  const hoursInBed = (day.sleep.end - day.sleep.start) / HOUR;
  const priorHours = history.filter((h) => h.sleep).map((h) => summarizeSession(h.sleep!).asleepMin / 60);
  const need = sleepNeed(profile, priorHours, prevStrain, false);

  const efficiency = clamp((sum.asleepMin / (hoursInBed * 60)) * 100, 0, 100);
  const restorativePct = sum.hasStages ? ((sum.deep + sum.rem) / sum.asleepMin) * 100 : undefined;
  const sessions = [...history.map((h) => h.sleep), day.sleep].filter(defined);
  const consistency = consistencyScore(sessions);

  const sufficiency = clamp(hoursAsleep / need, 0, 1) * 100;
  const effScore = clamp((efficiency - 75) / (92 - 75), 0, 1) * 100;
  const restScore = defined(restorativePct) ? clamp(restorativePct / 40, 0, 1) * 100 : undefined;

  const performance = weightedAvg([
    { value: sufficiency, weight: 0.6 },
    { value: effScore, weight: 0.15 },
    { value: restScore, weight: 0.15 },
    { value: consistency, weight: 0.1 },
  ])!;

  return {
    start: day.sleep.start,
    end: day.sleep.end,
    hoursAsleep: round(hoursAsleep, 2),
    hoursInBed: round(hoursInBed, 2),
    needHours: need,
    debtHours: round(Math.max(0, need - hoursAsleep), 2),
    efficiency: round(efficiency),
    restorativePct: defined(restorativePct) ? round(restorativePct) : undefined,
    stageMinutes: {
      awake: round(sum.awake),
      light: round(sum.light + sum.asleepGeneric),
      deep: round(sum.deep),
      rem: round(sum.rem),
    },
    hasStages: sum.hasStages,
    consistency,
    performance: round(performance),
  };
}

export const isAsleepStage = (stage: string) => ASLEEP.has(stage);
