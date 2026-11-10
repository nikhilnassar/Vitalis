import { DailyData, UserProfile } from '../types';
import { computeRecovery, RecoveryResult } from './recovery';
import { computeSleep, SleepResult, sleepNeed, summarizeSession } from './sleep';
import { computeStrain, StrainResult } from './strain';
import { estimateBioAge, BioAgeResult } from './bodyage';
import { computeMetabolic, MetabolicResult } from './metabolic';
import { buildCoaching, Coaching } from './coach';
import { bpPrompt, BpPrompt, BpSummary, summarizeBp } from './bp';
import { BpModelResult, evaluateBpModel, toModelDays } from './bpmodel';
import { BodyCompResult, computeBodyComp } from './bodycomp';
import { Badge, computeBadges } from './badges';
import { defined } from './util';

export interface DayMetrics {
  date: string;
  strain: StrainResult;
  sleep?: SleepResult;
  recovery: RecoveryResult;
}

export interface Analysis {
  days: DayMetrics[]; // oldest first
  today: DayMetrics;
  bioAge: BioAgeResult;
  metabolic: MetabolicResult;
  coaching: Coaching;
  tonightNeedHours: number;
  bp: { summary: BpSummary; prompt: BpPrompt; model: BpModelResult };
  bodyComp: BodyCompResult;
  badges: Badge[];
}

/** Run the whole pipeline over a chronological list of days. The last day is "today". */
export function analyze(days: DailyData[], profile: UserProfile, now = Date.now()): Analysis {
  if (!days.length) throw new Error('analyze() needs at least one day');

  // Latest measured weight and body fat win over what was typed in at setup.
  const bodyComp = computeBodyComp(days, profile.heightCm, now);
  const latestBf = bodyComp.latest?.bodyFatPct;
  const effective: UserProfile = {
    ...profile,
    weightKg: bodyComp.avg7Kg ?? profile.weightKg,
    bodyFatPct: latestBf ?? profile.bodyFatPct,
  };

  const metrics: DayMetrics[] = [];
  let prevStrain = 8; // neutral assumption for the very first night

  for (let i = 0; i < days.length; i++) {
    const history = days.slice(0, i);
    const day = days[i];
    const rhrHist = history.map((h) => h.rhr).filter(defined);
    const strain = computeStrain(day, effective, rhrHist.length ? rhrHist[rhrHist.length - 1] : undefined);
    const sleep = computeSleep(day, history, effective, prevStrain);
    const recovery = computeRecovery(day, history, sleep?.performance);
    metrics.push({ date: day.date, strain, sleep, recovery });
    prevStrain = strain.strain;
  }

  const today = metrics[metrics.length - 1];
  const recentHours = days.filter((d) => d.sleep).map((d) => summarizeSession(d.sleep!).asleepMin / 60);
  const tonightNeedHours = sleepNeed(effective, recentHours, today.strain.strain);

  const bpSummary = summarizeBp(days, now);

  return {
    days: metrics,
    today,
    bioAge: estimateBioAge(effective, days),
    metabolic: computeMetabolic(effective, days, today.strain, latestBf),
    coaching: buildCoaching(metrics, tonightNeedHours),
    tonightNeedHours,
    bp: {
      summary: bpSummary,
      prompt: bpPrompt(bpSummary, metrics),
      model: evaluateBpModel(toModelDays(days, metrics)),
    },
    bodyComp,
    badges: computeBadges(days, metrics, now),
  };
}
