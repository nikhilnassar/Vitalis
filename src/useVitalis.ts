import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { CoverageItem } from './health/assemble';
import { loadDemo, loadFromPlatform, Source } from './health';
import { Analysis, Experiment, JournalEntry, LabResult } from './metrics';
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
  found?: { name: string; count: number; newest: number; apps: string[] }[];
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
      found: data.meta?.found,
      stale: false,
      updatedAt: now,
    });
    writeJson(KEYS.cache, { analysis: b.analysis, profile: b.profile, coverage: b.coverage, savedAt: now } satisfies Cache);
  }, []);

  const busy = useRef(false);
  const lastLoad = useRef(0);
  const load = useCallback(
    async (source: Source, quiet = false) => {
      if (busy.current) return; // never run two reads at once
      busy.current = true;
      lastLoad.current = Date.now();
      if (!quiet) setState((s) => ({ ...s, phase: 'loading', source }));
      try {
        const data = source === 'demo' ? loadDemo() : await loadFromPlatform({ quiet });
        setRaw(data);
        await AsyncStorage.setItem(KEYS.source, source);
        await compute(data, source);
      } catch (e: any) {
        reportError(e, 'load');
        // Keep showing the last good result if there is one.
        setState((s) => (s.analysis && quiet ? { ...s, stale: true } : { phase: 'error', error: e?.message ?? String(e), source }));
      } finally {
        busy.current = false;
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
        const fresh = !!(cache?.analysis && cache.analysis.sleepBalance && cache.analysis.vitals && Array.isArray(cache.analysis.experiments) && Array.isArray(cache.analysis.today?.strain?.workouts));
        if (cache?.analysis && fresh) {
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

  const startExperiment = useCallback(
    async (habit: string, mode: 'avoid' | 'do', days: number) => {
      const all = await readJson<Experiment[]>(KEYS.experiments, []);
      // Starting tomorrow keeps today's journal entry out of the "before" period.
      const t = new Date();
      t.setDate(t.getDate() + 1);
      const p = (n: number) => String(n).padStart(2, '0');
      const start = `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
      await writeJson(KEYS.experiments, [...all, { id: `${Date.now()}`, habit, mode, start, days }]);
      await recompute();
    },
    [recompute],
  );
  const stopExperiment = useCallback(
    async (id: string) => {
      const all = await readJson<Experiment[]>(KEYS.experiments, []);
      await writeJson(KEYS.experiments, all.filter((e) => e.id !== id));
      await recompute();
    },
    [recompute],
  );
  /** After restoring a backup, reread everything stored on the phone. */
  const afterRestore = useCallback(async () => {
    if (raw && state.source) await compute(raw, state.source);
    else if (state.source) await load(state.source, true);
  }, [raw, state.source, compute, load]);

  const addBp = useCallback(
    (sys: number, dia: number, pulse?: number) =>
      updateManual((m) => {
        const now = Date.now();
        // Ignore an identical reading logged within the last 5 minutes (a double tap or repeat submit).
        if (m.bp.some((r) => r.sys === sys && r.dia === dia && Math.abs(now - r.t) < 5 * 60_000)) return m;
        return { ...m, bp: [...m.bp, { t: now, sys, dia, pulse, source: 'manual' as const } as BpReading] };
      }),
    [updateManual],
  );
  const addWeight = useCallback(
    (kg: number, bodyFatPct?: number) => updateManual((m) => ({ ...m, weight: [...m.weight, { t: Date.now(), kg, bodyFatPct }] })),
    [updateManual],
  );
  const addSpo2 = useCallback(
    (pct: number, date: string) =>
      updateManual((m) => ({ ...m, spo2: [...(m.spo2 ?? []).filter((x) => x.date !== date), { date, pct }].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-120) })),
    [updateManual],
  );
  const deleteSpo2 = useCallback((date: string) => updateManual((m) => ({ ...m, spo2: (m.spo2 ?? []).filter((x) => x.date !== date) })), [updateManual]);
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
      if (s === 'active' && cur.phase === 'ready' && cur.source === 'platform' && Date.now() - lastLoad.current > 60_000) load('platform', true);
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
    addSpo2,
    deleteSpo2,
    deleteBp,
    toggleHabit,
    setFeel,
    addLab,
    deleteLab,
    startExperiment,
    stopExperiment,
    afterRestore,
    disconnect,
    deleteAll,
    refresh: () => state.source && load(state.source, true),
  };
}
