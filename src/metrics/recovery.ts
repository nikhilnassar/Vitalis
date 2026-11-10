import { DailyData } from '../types';
import { baseline, clamp, defined, normCdf, round } from './util';

export type RecoveryBand = 'red' | 'yellow' | 'green';

export interface Component {
  value: number;
  baselineMean: number;
  z: number; // positive = better than your normal
  deltaPct: number; // raw change vs baseline mean
}

export interface RecoveryResult {
  score: number | null; // 0-100, null while calibrating
  band: RecoveryBand | null;
  status: 'ok' | 'calibrating' | 'no-data';
  components: { hrv?: Component; rhr?: Component; resp?: Component; sleep?: number };
  notes: string[];
}

export const bandFor = (score: number): RecoveryBand => (score >= 67 ? 'green' : score >= 34 ? 'yellow' : 'red');

// Minimum SDs keep a very stable baseline from turning small wobbles into huge z-scores.
const MIN_SD = { lnHrv: 0.08, rhr: 1.5, resp: 0.3 };

const WEIGHTS = { hrv: 0.45, rhr: 0.25, sleep: 0.2, resp: 0.1 };

function comp(value: number, b: { mean: number; sd: number }, invert: boolean, log = false): Component {
  const v = log ? Math.log(value) : value;
  let z = (v - b.mean) / b.sd;
  if (invert) z = -z;
  const baseRaw = log ? Math.exp(b.mean) : b.mean;
  return { value, baselineMean: round(baseRaw, 1), z, deltaPct: round(((value - baseRaw) / baseRaw) * 100, 1) };
}

/**
 * Recovery = how ready your body is relative to YOUR 30-day normal.
 * Weighted z-score of overnight HRV (log), resting HR, respiratory rate and sleep performance,
 * mapped through the normal CDF so ~50 is a typical day. Needs >= 4 prior days of HRV or RHR.
 */
export function computeRecovery(
  today: DailyData,
  history: DailyData[], // prior days, oldest first
  sleepPerformance?: number,
): RecoveryResult {
  const notes: string[] = [];
  if (!defined(today.hrv) && !defined(today.rhr)) {
    return { score: null, band: null, status: 'no-data', components: {}, notes: ['No overnight HRV or resting heart rate yet.'] };
  }

  const hrvB = baseline(history.map((h) => (defined(h.hrv) ? Math.log(h.hrv) : undefined)), MIN_SD.lnHrv);
  const rhrB = baseline(history.map((h) => h.rhr), MIN_SD.rhr);
  const respB = baseline(history.map((h) => h.respRate), MIN_SD.resp);

  const hrv = defined(today.hrv) && hrvB ? comp(today.hrv, hrvB, false, true) : undefined;
  const rhr = defined(today.rhr) && rhrB ? comp(today.rhr, rhrB, true) : undefined;
  let resp: Component | undefined;
  if (defined(today.respRate) && respB) {
    // Only unusual breathing hurts you, in either direction.
    const c = comp(today.respRate, respB, false);
    resp = { ...c, z: -Math.abs(c.z) };
  }

  if (!hrv && !rhr) {
    return {
      score: null,
      band: null,
      status: 'calibrating',
      components: { sleep: sleepPerformance },
      notes: ['Still learning your baseline. Wear your tracker overnight for a few more nights.'],
    };
  }

  let wSum = 0;
  let zSum = 0;
  const add = (z: number | undefined, w: number) => {
    if (!defined(z)) return;
    wSum += w;
    zSum += z * w;
  };
  add(hrv?.z, WEIGHTS.hrv);
  add(rhr?.z, WEIGHTS.rhr);
  add(resp?.z, WEIGHTS.resp);
  // Sleep performance of ~80 is neutral; 100 is +1 sd-ish, 50 is -1.5.
  add(defined(sleepPerformance) ? (sleepPerformance - 80) / 20 : undefined, WEIGHTS.sleep);

  const composite = zSum / wSum;
  const score = round(clamp(100 * normCdf(composite + 0.25), 1, 99));

  if (hrv && hrv.deltaPct <= -15) notes.push(`HRV is ${Math.abs(hrv.deltaPct)}% below your baseline.`);
  if (hrv && hrv.deltaPct >= 15) notes.push(`HRV is ${hrv.deltaPct}% above your baseline.`);
  if (rhr && rhr.deltaPct >= 5) notes.push(`Resting heart rate is ${rhr.deltaPct}% above your baseline.`);
  if (defined(sleepPerformance) && sleepPerformance < 60) notes.push('Short or poor sleep is dragging this score down.');
  if (!hrv) notes.push('No HRV data: score leans on resting heart rate and sleep.');

  return {
    score,
    band: bandFor(score),
    status: 'ok',
    components: { hrv, rhr, resp, sleep: sleepPerformance },
    notes,
  };
}
