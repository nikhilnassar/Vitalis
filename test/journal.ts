import { demoRaw } from '../src/health/demo';
import { assemble } from '../src/health/assemble';
import { analyze, JournalEntry, summarizeLabs } from '../src/metrics';
const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const now = new Date('2026-11-09T14:00:00').getTime();
const prof = { age: 35, sex: 'male', heightCm: 178, weightKg: 79 } as any;
const days = assemble(demoRaw(now, 90, 7), prof, 90, now);
const base = analyze(days, prof, now);
// Plant a real effect: on "alcohol" days, drop the NEXT morning's HRV by 15 ms; random 25% of days.
let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const entries: JournalEntry[] = [];
const planted = days.map((d) => ({ ...d }));
for (let i = 0; i < planted.length - 1; i++) {
  const drink = rnd() < 0.3;
  entries.push({ date: planted[i].date, habits: drink ? ['alcohol'] : [], feel: 3 });
  if (drink && planted[i + 1].hrv) planted[i + 1].hrv = planted[i + 1].hrv! - 15;
}
const a = analyze(planted, prof, now, { journal: entries });
console.log(a.journal.effects.map((e) => e.sentence));
ok(a.journal.ready, 'journal ready with 89 logged days');
ok(a.journal.effects.some((e) => e.id === 'alcohol' && e.marker.includes('HRV') && !e.good), 'finds planted alcohol -> lower HRV effect');
// Null case: random habits with no effect should yield (almost) no claims.
let fp = 0;
for (let s = 1; s <= 20; s++) {
  seed = s * 7919;
  const es: JournalEntry[] = days.slice(0, -1).map((d) => ({ date: d.date, habits: rnd() < 0.3 ? ['caffeine-late'] : [] }));
  fp += analyze(days, prof, now, { journal: es }).journal.effects.length;
}
console.log('false claims over 20 null runs x 3 markers:', fp);
ok(fp <= 6, 'null journals rarely claim an effect');
ok(base.journal.ready === false, 'no journal -> nothing claimed');
const labs = summarizeLabs([{ id: '1', t: 1, key: 'ldl', value: 150 }, { id: '2', t: 2, key: 'ldl', value: 120 }, { id: '3', t: 2, key: 'vitd', value: 18 }], 'male');
ok(labs.find((l) => l.def.key === 'ldl')!.status === 'in-range' && labs.find((l) => l.def.key === 'ldl')!.change === -30, 'lab latest/change');
ok(labs.find((l) => l.def.key === 'vitd')!.status === 'low', 'low vitamin D flagged');
