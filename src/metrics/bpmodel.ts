import { DailyData } from '../types';
import type { DayMetrics } from './analyze';
import { defined, mean, round, sd } from './util';

/**
 * Personal BP trend model.
 *
 * Fits a small ridge regression on YOUR cuff readings against that day's overnight physiology, then shows an
 * estimate only if it beats simply guessing your average on readings it has never seen. Validation uses
 * time-blocked folds with a 2-day buffer, so neighbouring days cannot leak into each other.
 * If it cannot clearly beat the average, it stays hidden. That is the expected outcome for many people.
 */

export interface ModelDay {
  hrv?: number;
  rhr?: number;
  resp?: number;
  sleepHours?: number;
  strain?: number;
  stepsK?: number;
  sys?: number;
  dia?: number;
}

export function toModelDays(days: DailyData[], metrics: DayMetrics[]): ModelDay[] {
  return days.map((d, i) => ({
    hrv: d.hrv,
    rhr: d.rhr,
    resp: d.respRate,
    sleepHours: metrics[i]?.sleep?.hoursAsleep,
    strain: metrics[i]?.strain.hasData ? metrics[i].strain.strain : undefined,
    stepsK: defined(d.steps) ? d.steps / 1000 : undefined,
    sys: d.bp.length ? mean(d.bp.map((b) => b.sys)) : undefined,
    dia: d.bp.length ? mean(d.bp.map((b) => b.dia)) : undefined,
  }));
}

const FEATURES: { name: string; get: (cur: ModelDay, prev?: ModelDay) => number | undefined }[] = [
  { name: 'Overnight HRV', get: (c) => (defined(c.hrv) ? Math.log(c.hrv) : undefined) },
  { name: 'Resting heart rate', get: (c) => c.rhr },
  { name: 'Respiratory rate', get: (c) => c.resp },
  { name: 'Sleep duration', get: (c) => c.sleepHours },
  { name: "Yesterday's strain", get: (_, p) => p?.strain },
  { name: "Yesterday's steps", get: (_, p) => p?.stepsK },
];

export const MIN_PAIRS = 30;
const FOLDS = 5;
const BUFFER_DAYS = 2;
const MIN_TRAIN = 15;
const MIN_EVAL = 20;
const RIDGE = 0.2; // penalty per training row, on standardised features
const IMPROVEMENT = 0.85; // model error must be at most 85% of the baseline's
const T_MIN = 2;
const MAX_MAE = { sys: 8, dia: 6 }; // mmHg: beyond this the estimate is too loose to show

export type ModelStatus = 'insufficient' | 'unreliable' | 'reliable';

export interface TargetResult {
  target: 'sys' | 'dia';
  status: ModelStatus;
  n: number; // paired days available
  needed: number;
  reason?: string;
  baselineMae?: number;
  modelMae?: number;
  improvementPct?: number;
  tStat?: number;
  estimate?: number;
  low?: number; // ~90% interval
  high?: number;
  drivers?: { name: string; effect: number }[]; // mmHg per +1 SD of that feature
}

export interface BpModelResult {
  sys: TargetResult;
  dia: TargetResult;
  ready: boolean; // true only when systolic passes the gate
}

// ---------- tiny ridge regression ----------

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12));
}

interface Fit {
  mu: number[];
  sg: number[];
  ym: number;
  beta: number[];
}

function fit(X: number[][], y: number[]): Fit {
  const n = X.length;
  const p = X[0].length;
  const mu = Array.from({ length: p }, (_, j) => mean(X.map((r) => r[j])));
  const sg = Array.from({ length: p }, (_, j) => {
    const s = sd(X.map((r) => r[j]));
    return Number.isFinite(s) && s > 1e-9 ? s : 1;
  });
  const ym = mean(y);
  const Z = X.map((r) => r.map((v, j) => (v - mu[j]) / sg[j]));
  const A = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? RIDGE * n : 0)),
  );
  const b = Array.from({ length: p }, (_, j) => Z.reduce((s, r, k) => s + r[j] * (y[k] - ym), 0));
  return { mu, sg, ym, beta: solve(A, b) };
}

const predict = (f: Fit, x: number[]) => f.ym + f.beta.reduce((s, b, j) => s + (b * (x[j] - f.mu[j])) / f.sg[j], 0);

// ---------- evaluation ----------

interface Row {
  idx: number;
  x: number[];
  y: number;
}

export function evaluateTarget(days: ModelDay[], target: 'sys' | 'dia'): TargetResult {
  const base: TargetResult = { target, status: 'insufficient', n: 0, needed: MIN_PAIRS };
  const cand: number[] = [];
  days.forEach((d, i) => defined(d[target]) && cand.push(i));

  // Keep features present on at least 80% of the days that have a reading.
  const keep = FEATURES.map((f, j) => ({ f, j, cov: cand.filter((i) => defined(f.get(days[i], days[i - 1]))).length / Math.max(cand.length, 1) }))
    .filter((k) => k.cov >= 0.8)
    .map((k) => k.f);
  if (!keep.length || cand.length < MIN_PAIRS) {
    return { ...base, n: cand.length, reason: cand.length < MIN_PAIRS ? `Needs ${MIN_PAIRS} days with a cuff reading` : 'No usable overnight data' };
  }

  const rows: Row[] = [];
  for (const i of cand) {
    const x = keep.map((f) => f.get(days[i], days[i - 1]));
    if (x.every(defined)) rows.push({ idx: i, x: x as number[], y: days[i][target] as number });
  }
  if (rows.length < MIN_PAIRS) return { ...base, n: rows.length, reason: `Needs ${MIN_PAIRS} days with a cuff reading and overnight data` };

  // Time-blocked cross-validation with a buffer around each held-out block.
  const bs = Math.ceil(rows.length / FOLDS);
  const eModel: number[] = [];
  const eBase: number[] = [];
  const signed: number[] = [];
  for (let f = 0; f < FOLDS; f++) {
    const test = rows.slice(f * bs, (f + 1) * bs);
    if (!test.length) continue;
    const lo = test[0].idx - BUFFER_DAYS;
    const hi = test[test.length - 1].idx + BUFFER_DAYS;
    const train = rows.filter((r) => r.idx < lo || r.idx > hi);
    if (train.length < MIN_TRAIN) continue;
    const m = fit(train.map((r) => r.x), train.map((r) => r.y));
    const bm = mean(train.map((r) => r.y));
    for (const r of test) {
      const pr = predict(m, r.x);
      eModel.push(Math.abs(pr - r.y));
      eBase.push(Math.abs(bm - r.y));
      signed.push(pr - r.y);
    }
  }
  if (eModel.length < MIN_EVAL) return { ...base, status: 'unreliable', n: rows.length, reason: 'Not enough held-out readings to test the model yet' };

  const modelMae = mean(eModel);
  const baselineMae = mean(eBase);
  const diffs = eBase.map((b, i) => b - eModel[i]);
  // Neighbouring days are correlated, so treat the effective sample as half its size.
  const nEff = Math.max(2, diffs.length / 2);
  const dsd = sd(diffs);
  const t = dsd > 1e-9 ? mean(diffs) / (dsd / Math.sqrt(nEff)) : 0;
  const improvement = 1 - modelMae / baselineMae;

  const result: TargetResult = {
    ...base,
    n: rows.length,
    modelMae: round(modelMae, 1),
    baselineMae: round(baselineMae, 1),
    improvementPct: round(improvement * 100),
    tStat: round(t, 1),
  };

  const pass = modelMae <= IMPROVEMENT * baselineMae && t >= T_MIN && modelMae <= MAX_MAE[target];
  if (!pass) {
    return {
      ...result,
      status: 'unreliable',
      reason:
        modelMae > MAX_MAE[target]
          ? 'Your readings vary too much day to day for a useful estimate'
          : 'Overnight data does not predict your readings better than your average does',
    };
  }

  const final = fit(rows.map((r) => r.x), rows.map((r) => r.y));
  const last = days.length - 1;
  const xToday = keep.map((f) => f.get(days[last], days[last - 1]));
  const half = 1.645 * sd(signed);
  const drivers = keep
    .map((f, j) => ({ name: f.name, effect: round(final.beta[j], 1) }))
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
    .slice(0, 3);

  if (!xToday.every(defined)) return { ...result, status: 'reliable', reason: 'Waiting for last night’s data', drivers };
  const est = predict(final, xToday as number[]);
  return { ...result, status: 'reliable', estimate: round(est), low: round(est - half), high: round(est + half), drivers };
}

export function evaluateBpModel(days: ModelDay[]): BpModelResult {
  const sys = evaluateTarget(days, 'sys');
  const dia = evaluateTarget(days, 'dia');
  return { sys, dia, ready: sys.status === 'reliable' };
}
