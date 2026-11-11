import { assemble, coverage, CoverageItem, resolveProfile } from './health/assemble';
import { platformName, Source } from './health';
import { Analysis, JournalEntry, LabResult, analyze } from './metrics';
import { KEYS, readJson } from './storage';
import { BpReading, RawHealthData, UserProfile } from './types';

export interface ManualWeight {
  t: number;
  kg: number;
  bodyFatPct?: number;
}
export interface Manual {
  bp: BpReading[];
  weight: ManualWeight[];
}

/** Layer the user's hand-entered readings over whatever the phone's health store gave us. */
export function mergeManual(raw: RawHealthData, m: Manual): RawHealthData {
  return {
    ...raw,
    bp: [...raw.bp, ...m.bp],
    weight: [...raw.weight, ...m.weight.map((w) => ({ t: w.t, kg: w.kg }))],
    bodyFat: [...raw.bodyFat, ...m.weight.filter((w) => w.bodyFatPct !== undefined).map((w) => ({ t: w.t, pct: w.bodyFatPct as number }))],
  };
}

export interface Built {
  needsProfile: boolean;
  platformProfile: Partial<UserProfile>;
  manual: Manual;
  journal: JournalEntry[];
  labs: LabResult[];
  profile?: UserProfile;
  analysis?: Analysis;
  coverage?: CoverageItem[];
}

/** Everything the UI and the background task need, from raw health data plus what is stored on the phone. */
export async function build(data: RawHealthData, source: Source): Promise<Built> {
  const stored = await readJson<Partial<UserProfile>>(KEYS.profile, {});
  const manual = await readJson<Manual>(KEYS.manual, { bp: [], weight: [] });
  const journal = await readJson<JournalEntry[]>(KEYS.journal, []);
  const labs = await readJson<LabResult[]>(KEYS.labs, []);
  const profile = resolveProfile(stored, data.profile);
  if (!profile) return { needsProfile: true, platformProfile: { ...data.profile, ...stored }, manual, journal, labs };
  const merged = mergeManual(data, manual);
  const days = assemble(merged, profile);
  return {
    needsProfile: false,
    platformProfile: { ...data.profile, ...stored },
    manual,
    journal,
    labs,
    profile,
    analysis: analyze(days, profile, Date.now(), { journal, labs }),
    coverage: coverage(merged, source === 'demo' ? 'the demo' : platformName),
  };
}
