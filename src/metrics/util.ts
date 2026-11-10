export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export const mean = (a: number[]): number =>
  a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN;

export function sd(a: number[]): number {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

/** Standard normal CDF (Abramowitz & Stegun 26.2.17). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export const defined = <T>(x: T | undefined | null): x is T =>
  x !== undefined && x !== null && !(typeof x === 'number' && Number.isNaN(x));

/** Weighted mean over only the parts that exist; weights are renormalised. */
export function weightedAvg(parts: { value: number | undefined; weight: number }[]): number | undefined {
  let w = 0;
  let s = 0;
  for (const p of parts) {
    if (!defined(p.value)) continue;
    w += p.weight;
    s += p.value * p.weight;
  }
  return w > 0 ? s / w : undefined;
}

export interface Baseline {
  mean: number;
  sd: number;
  n: number;
}

/** Personal baseline from the most recent `window` non-missing values (caller excludes today). */
export function baseline(
  values: (number | undefined)[],
  minSd: number,
  window = 30,
  minN = 4,
): Baseline | undefined {
  const v = values.filter(defined).slice(-window);
  if (v.length < minN) return undefined;
  return { mean: mean(v), sd: Math.max(sd(v), minSd), n: v.length };
}

export const round = (x: number, digits = 0) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

export function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

export function dayKey(t: number | Date): string {
  const d = typeof t === 'number' ? new Date(t) : t;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function dayStart(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

export const HOUR = 3600_000;
export const MIN = 60_000;

/** Least-squares slope of ys against xs (units of y per unit of x). */
export function slope(xs: number[], ys: number[]): number | undefined {
  const n = xs.length;
  if (n < 2) return undefined;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? undefined : num / den;
}

export const daysBetween = (a: string, b: string) => Math.round((dayStart(b) - dayStart(a)) / (24 * HOUR));
