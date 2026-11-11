import type { Sex } from '../types';
import { round } from './util';

export interface LabDef {
  key: string;
  label: string;
  emoji: string;
  unit: string;
  low?: number; // below this is flagged low
  high?: number; // above this is flagged high
  note: string;
  step?: number;
}

/** Generic adult reference ranges (mg/dL, US units). Labs differ, so always defer to the range printed on your report. */
export function labDefs(sex: Sex): LabDef[] {
  return [
    { key: 'ldl', label: 'LDL cholesterol', emoji: '🧈', unit: 'mg/dL', high: 129, note: 'Under 100 is ideal for most people; 130+ is above the usual target.' },
    { key: 'hdl', label: 'HDL cholesterol', emoji: '🛡️', unit: 'mg/dL', low: sex === 'male' ? 40 : 50, note: 'Higher is generally better.' },
    { key: 'tg', label: 'Triglycerides', emoji: '🥓', unit: 'mg/dL', high: 149, note: 'Fasting value; under 150 is typical.' },
    { key: 'tc', label: 'Total cholesterol', emoji: '🧪', unit: 'mg/dL', high: 199, note: 'Under 200 is typical.' },
    { key: 'a1c', label: 'HbA1c', emoji: '🍬', unit: '%', high: 5.6, step: 0.1, note: '5.7 to 6.4 is the prediabetes range; 6.5+ is the diabetes range. Only a clinician diagnoses.' },
    { key: 'glucose', label: 'Fasting glucose', emoji: '🩸', unit: 'mg/dL', low: 70, high: 99, note: '70 to 99 is typical when fasting.' },
    { key: 'vitd', label: 'Vitamin D', emoji: '☀️', unit: 'ng/mL', low: 30, high: 100, note: 'Many labs treat under 20 as deficient and 20 to 30 as low.' },
    { key: 'ferritin', label: 'Ferritin', emoji: '🔩', unit: 'ng/mL', low: sex === 'male' ? 30 : 15, high: sex === 'male' ? 400 : 200, note: 'Iron stores; ranges vary by lab.' },
    { key: 'crp', label: 'hs-CRP', emoji: '🔥', unit: 'mg/L', high: 3, step: 0.1, note: 'Under 1 is low risk, 1 to 3 average, over 3 higher. Illness raises it temporarily.' },
    { key: 'tsh', label: 'TSH', emoji: '🦋', unit: 'mIU/L', low: 0.4, high: 4.0, step: 0.1, note: 'Thyroid screening value.' },
  ];
}

export interface LabResult {
  id: string;
  t: number;
  key: string;
  value: number;
}

export interface LabSummary {
  def: LabDef;
  latest: LabResult;
  previous?: LabResult;
  change?: number;
  status: 'in-range' | 'high' | 'low';
  history: LabResult[]; // oldest first
}

export function summarizeLabs(results: LabResult[], sex: Sex): LabSummary[] {
  const out: LabSummary[] = [];
  for (const def of labDefs(sex)) {
    const history = results.filter((r) => r.key === def.key).sort((a, b) => a.t - b.t);
    if (!history.length) continue;
    const latest = history[history.length - 1];
    const previous = history.length > 1 ? history[history.length - 2] : undefined;
    const status = def.high !== undefined && latest.value > def.high ? 'high' : def.low !== undefined && latest.value < def.low ? 'low' : 'in-range';
    out.push({ def, latest, previous, change: previous ? round(latest.value - previous.value, 2) : undefined, status, history });
  }
  return out;
}

export const labValid = (v: number) => Number.isFinite(v) && v > 0 && v < 100000;
