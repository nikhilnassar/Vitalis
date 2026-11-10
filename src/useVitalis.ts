import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { assemble, resolveProfile } from './health/assemble';
import { loadDemo, loadFromPlatform, Source } from './health';
import { Analysis, analyze } from './metrics';
import { BpReading, RawHealthData, UserProfile } from './types';

const KEY_PROFILE = 'vitalis.profile.v1';
const KEY_SOURCE = 'vitalis.source.v1';
const KEY_MANUAL = 'vitalis.manual.v1';

export type Phase = 'booting' | 'connect' | 'loading' | 'needs-profile' | 'ready' | 'error';

export interface ManualWeight {
  t: number;
  kg: number;
  bodyFatPct?: number;
}

interface Manual {
  bp: BpReading[];
  weight: ManualWeight[];
}

export interface State {
  phase: Phase;
  analysis?: Analysis;
  profile?: UserProfile;
  platformProfile?: Partial<UserProfile>;
  source?: Source;
  manual?: Manual;
  error?: string;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Layer the user's hand-entered readings over whatever the phone's health store gave us. */
function mergeManual(raw: RawHealthData, m: Manual): RawHealthData {
  return {
    ...raw,
    bp: [...raw.bp, ...m.bp],
    weight: [...raw.weight, ...m.weight.map((w) => ({ t: w.t, kg: w.kg }))],
    bodyFat: [...raw.bodyFat, ...m.weight.filter((w) => w.bodyFatPct !== undefined).map((w) => ({ t: w.t, pct: w.bodyFatPct as number }))],
  };
}

export function useVitalis() {
  const [state, setState] = useState<State>({ phase: 'booting' });
  const [raw, setRaw] = useState<RawHealthData | undefined>();

  const compute = useCallback(async (data: RawHealthData, source: Source) => {
    const stored = await readJson<Partial<UserProfile>>(KEY_PROFILE, {});
    const manual = await readJson<Manual>(KEY_MANUAL, { bp: [], weight: [] });
    const profile = resolveProfile(stored, data.profile);
    if (!profile) {
      setState({ phase: 'needs-profile', source, manual, platformProfile: { ...data.profile, ...stored } });
      return;
    }
    const merged = mergeManual(data, manual);
    const days = assemble(merged, profile);
    setState({ phase: 'ready', analysis: analyze(days, profile), profile, source, manual });
  }, []);

  const load = useCallback(
    async (source: Source) => {
      setState((s) => ({ ...s, phase: 'loading', source }));
      try {
        const data = source === 'demo' ? loadDemo() : await loadFromPlatform();
        setRaw(data);
        await AsyncStorage.setItem(KEY_SOURCE, source);
        await compute(data, source);
      } catch (e: any) {
        setState({ phase: 'error', error: e?.message ?? String(e), source });
      }
    },
    [compute],
  );

  useEffect(() => {
    AsyncStorage.getItem(KEY_SOURCE)
      .then((s) => (s === 'platform' || s === 'demo' ? load(s) : setState({ phase: 'connect' })))
      .catch(() => setState({ phase: 'connect' }));
  }, [load]);

  const saveProfile = useCallback(
    async (p: Partial<UserProfile>) => {
      const stored = await readJson<Partial<UserProfile>>(KEY_PROFILE, {});
      await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify({ ...stored, ...p }));
      if (raw && state.source) await compute(raw, state.source);
    },
    [raw, state.source, compute],
  );

  const updateManual = useCallback(
    async (fn: (m: Manual) => Manual) => {
      const m = fn(await readJson<Manual>(KEY_MANUAL, { bp: [], weight: [] }));
      await AsyncStorage.setItem(KEY_MANUAL, JSON.stringify(m));
      if (raw && state.source) await compute(raw, state.source);
    },
    [raw, state.source, compute],
  );

  const addBp = useCallback(
    (sys: number, dia: number, pulse?: number) => updateManual((m) => ({ ...m, bp: [...m.bp, { t: Date.now(), sys, dia, pulse, source: 'manual' as const }] })),
    [updateManual],
  );
  const addWeight = useCallback(
    (kg: number, bodyFatPct?: number) => updateManual((m) => ({ ...m, weight: [...m.weight, { t: Date.now(), kg, bodyFatPct }] })),
    [updateManual],
  );
  const deleteBp = useCallback((t: number) => updateManual((m) => ({ ...m, bp: m.bp.filter((r) => r.t !== t) })), [updateManual]);

  const disconnect = useCallback(async () => {
    await AsyncStorage.multiRemove([KEY_SOURCE]);
    setRaw(undefined);
    setState({ phase: 'connect' });
  }, []);

  return { state, load, saveProfile, addBp, addWeight, deleteBp, disconnect, refresh: () => state.source && load(state.source) };
}
