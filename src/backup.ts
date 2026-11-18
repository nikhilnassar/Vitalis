import { KEYS, readJson, writeJson } from './storage';

/** Everything the person typed in, plus settings. Health Connect / Apple Health data is not copied; it re-reads from the phone. */
const BACKUP_KEYS = ['profile', 'manual', 'journal', 'labs', 'settings', 'experiments'] as const;
type BackupKey = (typeof BACKUP_KEYS)[number];

export interface Backup {
  app: 'vitalis';
  version: 1;
  createdAt: number;
  data: Partial<Record<BackupKey, unknown>>;
}

export async function createBackup(): Promise<string> {
  const data: Backup['data'] = {};
  for (const k of BACKUP_KEYS) {
    const v = await readJson<unknown>(KEYS[k], null);
    if (v != null) data[k] = v;
  }
  const b: Backup = { app: 'vitalis', version: 1, createdAt: Date.now(), data };
  return JSON.stringify(b);
}

const isArr = (v: unknown) => Array.isArray(v);
const isObj = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseBackup(text: string): { ok: true; backup: Backup } | { ok: false; error: string } {
  let j: any;
  try {
    j = JSON.parse(text.trim());
  } catch {
    return { ok: false, error: 'That does not look like a Vitalis backup. Paste the whole text you saved.' };
  }
  if (!isObj(j) || j.app !== 'vitalis' || !isObj(j.data)) return { ok: false, error: 'This is not a Vitalis backup.' };
  if (j.version !== 1) return { ok: false, error: 'This backup was made by a newer version of Vitalis.' };
  const d = j.data;
  const shape: Record<BackupKey, (v: unknown) => boolean> = {
    profile: isObj,
    manual: (v) => isObj(v) && isArr((v as any).bp) && isArr((v as any).weight),
    journal: isArr,
    labs: isArr,
    settings: isObj,
    experiments: isArr,
  };
  for (const k of BACKUP_KEYS) if (d[k] !== undefined && !shape[k](d[k])) return { ok: false, error: `The backup is damaged (${k}).` };
  return { ok: true, backup: j as Backup };
}

/** Replaces the stored data for every section the backup contains. */
export async function restoreBackup(text: string): Promise<{ ok: boolean; error?: string; restored: string[] }> {
  const p = parseBackup(text);
  if (!p.ok) return { ok: false, error: p.error, restored: [] };
  const restored: string[] = [];
  for (const k of BACKUP_KEYS) {
    if (p.backup.data[k] !== undefined) {
      await writeJson(KEYS[k], p.backup.data[k]);
      restored.push(k);
    }
  }
  return { ok: true, restored };
}
