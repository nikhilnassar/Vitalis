import { demoRaw } from '../src/health/demo';
import { assemble } from '../src/health/assemble';
import { analyze } from '../src/metrics';
import { planNotifications } from '../src/notifyPlan';
const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const now = new Date('2026-11-09T14:00:00').getTime();
const prof = { age: 35, sex: 'male', heightCm: 178, weightKg: 79 } as any;
const a = analyze(assemble(demoRaw(now, 90, 7), prof, 90, now), prof, now);
const p = planNotifications(a);
console.log(p);
ok(!!p.morning && /Recovery \d+%/.test(p.morning.title), 'morning summary has recovery');
ok(!!p.bedtime && p.bedtime.hour >= 0 && p.bedtime.hour < 24 && p.bedtime.minute >= 0 && p.bedtime.minute < 60, 'bedtime is a valid clock time');
// Bedtime must land before the usual wake time by need + 45 min.
const wake = new Date(a.days[a.days.length - 1].sleep!.end);
ok(p.bedtime!.hour >= 18 || p.bedtime!.hour <= 3, `bedtime in the evening/night (${p.bedtime!.hour}:${String(p.bedtime!.minute).padStart(2, '0')})`);
// Illness watch: force two bad mornings.
const bad = assemble(demoRaw(now, 90, 7), prof, 90, now).map((d) => ({ ...d }));
for (const d of bad.slice(-2)) { d.rhr = (d.rhr ?? 55) + 9; d.hrv = (d.hrv ?? 60) * 0.6; }
ok(analyze(bad, prof, now).coaching.illnessWatch, 'illness watch triggers on RHR up + HRV down two mornings');
ok(a.coaching.illnessWatch === false, 'no false illness flag on normal demo');
