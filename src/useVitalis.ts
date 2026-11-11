import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { CoverageItem } from './health/assemble';
import { loadDemo, loadFromPlatform, Source } from './health';
import { Analysis, JournalEntry, LabResult } from './metrics';
import { Manual, build } from './pipeline';
import { reportError } from './errors';
import { KEYS, readJson, wipeAll, writeJson } from './storage';
import { BpReading, RawHealthData, UserProfile } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type { ManualWeight } from './pipeline';
export type Phase = 'booting' | 'connect' | 'loading' | 'needs-profile' | 'ready' | 'error';

export interface State {
  phase: Phase;
  analysis?: Analysis;
  profile?: UserProfile;
  platformProfile?: Partial<UserProfile>;
  source?: Source;
  manual?: Manual;
  journal?: JournalEntry[];
  labs?: LabResult[];
  coverage?: CoverageItem[];
  readErrors?: string[];
  limitedHistory?: boolean;
  error?: string;
  /** Showing the last saved result while a fresh read is under way (or failed). */
  stale?: boolean;
  updatedAt?: number;
}

interface Cache {
  analysis: Analysis;
  profile: UserProfile;
  coverage?: CoverageItem[];
  savedAt: number;
}

export const todayKey = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export function useVitalis() {
  const [state, setState] = useState<State>({ phase: 'booting' });
  const [raw, setRaw] = useState<RawHealthData | undefined>();

  const compute = useCallback(async (data: RawHealthData, source: Source) => {
    const b = await build(data, source);
    if (b.needsProfile || !b.analysis || !b.profile) {
      setState({ phase: 'needs-profile', source, manual: b.manual, platformProfile: b.platformProfile });
      return;
    }
    const now = Date.now();
    setState({
      phase: 'ready',
      analysis: b.analysis,
      profile: b.profile,
      source,
      manual: b.manual,
      journal: b.journal,
      labs: b.labs,
      coverage: b.coverage,
      readErrors: data.meta?.errors,
      limitedHistory: data.meta?.limitedHistory,
      stale: false,
      updatedAt: now,
    });
    writeJson(KEYS.cache, { analysis: b.analysis, profile: b.profile, coverage: b.coverage, savedAt: now } satisfies Cache);
  }, []);

  const load = useCallback(
    async (source: Source, quiet = false) => {
      if (!quiet) setState((s) => ({ ...s, phase: 'loading', source }));
      try {
        const data = source === 'demo' ? loadDemo() : await loadFromPlatform();
        setRaw(data);
        await AsyncStorage.setItem(KEYS.source, source);
        await compute(data, source);
      } catch (e: any) {
        reportError(e, 'load');
        // Keep showing the last good result if there is one.
        setState((s) => (s.analysis && quiet ? { ...s, stale: true } : { phase: 'error', error: e?.message ?? String(e), source }));
      }
    },
    [compute],
  );

  // On launch, show the last saved result straight away, then refresh behind it.
  useEffect(() => {
    (async () => {
      try {
        const source = await AsyncStorage.getItem(KEYS.source);
        if (source !== 'platform' && source !== 'demo') return setState({ phase: 'connect' });
        const cache = source === 'platform' ? await readJson<Cache | null>(KEYS.cache, null) : null;
        const [manual, journal, labs] = await Promise.all([
          readJson<Manual>(KEYS.manual, { bp: [], weight: [] }),
          readJson<JournalEntry[]>(KEYS.journal, []),
          readJson<LabResult[]>(KEYS.labs, []),
        ]);
        if (cache?.analysis) {
          setState({ phase: 'ready', analysis: cache.analysis, profile: cache.profile, source, manual, journal, labs, coverage: cache.coverage, stale: true, updatedAt: cache.savedAt });
          load(source, true);
        } else {
          load(source);
        }
      } catch {
        setState({ phase: 'connect' });
      }
    })();
  }, [load]);

  const saveProfile = useCallback(
    async (p: Partial<UserProfile>) => {
      const stored = await readJson<Partial<UserProfile>>(KEYS.profile, {});
      await writeJson(KEYS.profile, { ...stored, ...p });
      if (raw && state.source) await compute(raw, state.source);
    },
    [raw, state.source, compute],
  );

  const recompute = useCallback(async () => {
    if (raw && state.source) await compute(raw, state.source);
  }, [raw, state.source, compute]);

  const updateManual = useCallback(
    async (fn: (m: Manual) => Manual) => {
      await writeJson(KEYS.manual, fn(await readJson<Manual>(KEYS.manual, { bp: [], weight: [] })));
      await recompute();
    },
    [recompute],
  );

  const addBp = useCallback(
    (sys: number, dia: number, pulse?: number) => updateManual((m) => ({ ...m, bp: [...m.bp, { t: Date.now(), sys, dia, pulse, source: 'manual' as const } as BpReading] })),
    [updateManual],
  );
  const addWeight = useCallback(
    (kg: number, bodyFatPct?: number) => updateManual((m) => ({ ...m, weight: [...m.weight, { t: Date.now(), kg, bodyFatPct }] })),
    [updateManual],
  );
  const deleteBp = useCallback((t: number) => updateManual((m) => ({ ...m, bp: m.bp.filter((r) => r.t !== t) })), [updateManual]);

  const updateJournal = useCallback(
    async (date: string, fn: (e: JournalEntry) => JournalEntry) => {
      const all = await readJson<JournalEntry[]>(KEYS.journal, []);
      const cur = all.find((e) => e.date === date) ?? { date, habits: [] };
      await writeJson(KEYS.journal, [...all.filter((e) => e.date !== date), fn(cur)].sort((a, b) => a.date.localeCompare(b.date)));
      await recompute();
    },
    [recompute],
  );
  const toggleHabit = useCallback(
    (date: string, id: string) => updateJournal(date, (e) => ({ ...e, habits: e.habits.includes(id) ? e.habits.filter((h) => h !== id) : [...e.habits, id] })),
    [updateJournal],
  );
  const setFeel = useCallback((date: string, v: 1 | 2 | 3 | 4 | 5) => updateJournal(date, (e) => ({ ...e, feel: e.feel === v ? undefined : v })), [updateJournal]);

  const addLab = useCallback(
    async (key: string, value: number, t = Date.now()) => {
      const all = await readJson<LabResult[]>(KEYS.labs, []);
      await writeJson(KEYS.labs, [...all, { id: `${t}-${key}-${all.length}`, t, key, value }]);
      await recompute();
    },
    [recompute],
  );
  const deleteLab = useCallback(
    async (id: string) => {
      const all = await readJson<LabResult[]>(KEYS.labs, []);
      await writeJson(KEYS.labs, all.filter((l) => l.id !== id));
      await recompute();
    },
    [recompute],
  );

  // Re-read quietly whenever the app comes back to the foreground, so a tracker sync that happened meanwhile shows up.
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      const cur = stateRef.current;
      if (s === 'active' && cur.phase === 'ready' && cur.source === 'platform') load('platform', true);
    });
    return () => sub.remove();
  }, [load]);

  const disconnect = useCallback(async () => {
    await AsyncStorage.multiRemove([KEYS.source, KEYS.cache]);
    setRaw(undefined);
    setState({ phase: 'connect' });
  }, []);

  /** Delete everything Vitalis stores on this phone: profile, journal, labs, settings, cache. */
  const deleteAll = useCallback(async () => {
    await wipeAll();
    setRaw(undefined);
    setState({ phase: 'connect' });
  }, []);

  return {
    state,
    load,
    saveProfile,
    addBp,
    addWeight,
    deleteBp,
    toggleHabit,
    setFeel,
    addLab,
    deleteLab,
    disconnect,
    deleteAll,
    refresh: () => state.source && load(state.source, true),
  };
}
