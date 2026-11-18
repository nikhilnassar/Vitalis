import { DailyData } from '../types';
import { defined, mean, round } from './util';

export interface VitalsResult {
  spo2?: { avg: number; min: number; nights: number; low: boolean };
  temp?: { recent: number; baseline?: number; deviation?: number; nights: number; raised: boolean };
  notes: string[];
}

/** Overnight blood oxygen and body temperature. Consumer sensors are noisy, so this only reports clear shifts. */
export function computeVitals(days: DailyData[]): VitalsResult {
  const notes: string[] = [];
  const last7 = days.slice(-7);
  const o = last7.map((d) => d.spo2).filter(defined);
  const omin = last7.map((d) => d.spo2Min).filter(defined);
  let spo2: VitalsResult['spo2'];
  if (o.length >= 3) {
    const avg = round(mean(o), 1);
    const min = Math.min(...omin);
    spo2 = { avg, min, nights: o.length, low: avg < 94 };
    if (spo2.low) notes.push(`Your overnight blood oxygen averaged ${avg}% this week, a little lower than typical. Wrist sensors are imprecise, but if this persists or you feel unwell, mention it to a clinician.`);
  }

  const t3 = days.slice(-3).map((d) => d.tempC).filter(defined);
  const base = days.slice(-33, -3).map((d) => d.tempC).filter(defined);
  let temp: VitalsResult['temp'];
  const nights = days.slice(-7).filter((d) => d.tempC !== undefined).length;
  if (t3.length >= 2) {
    const recent = round(mean(t3), 2);
    const baseline = base.length >= 10 ? round(mean(base), 2) : undefined;
    const deviation = baseline !== undefined ? round(recent - baseline, 2) : undefined;
    temp = { recent, baseline, deviation, nights, raised: deviation !== undefined && deviation >= 0.5 };
    if (temp.raised) notes.push(`Your body temperature has run about ${deviation} °C above your usual for the last few nights. Combined with a higher resting heart rate, this can be an early sign of illness.`);
  }
  return { spo2, temp, notes };
}
