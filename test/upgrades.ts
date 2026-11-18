import assert from 'node:assert';
import { demoRaw } from '../src/health/demo';
import { analyze } from '../src/metrics';
import { parseBackup } from '../src/backup';
import { buildWeeklyReport } from '../src/report';
import { assemble } from '../src/health/assemble';


const now = new Date('2026-11-09T14:00:00').getTime();
const prof = { age: 35, sex: 'male', heightCm: 178, weightKg: 79 } as any;
const days = assemble(demoRaw(now, 90, 7), prof, 90, now);
const last = days[days.length - 1].date;
const start = new Date(Date.parse(last) - 20 * 86400000).toISOString().slice(0, 10);
const a = analyze(days, prof, now, { journal: [], labs: [], experiments: [{ id: '1', habit: 'caffeine-late', mode: 'avoid', start, days: 14 }] });

assert(a.sleepBalance.nights >= 3, 'sleep balance nights');
assert(a.sleepBalance.debtHours >= 0);
assert(a.sleepBalance.suggestedBed, 'bedtime suggestion');
assert(a.vitals.spo2 && a.vitals.spo2.avg > 90 && a.vitals.spo2.avg <= 100, 'spo2');
assert(a.vitals.temp, 'temp');
assert.equal(a.experiments.length, 1);
assert.equal(a.experiments[0].status, 'done');
assert(a.experiments[0].effects.length > 0, 'effects computed');
assert(buildWeeklyReport(a).includes('Vitalis weekly report'));
assert(!parseBackup('nope').ok);
assert(!parseBackup('{"app":"vitalis","version":1,"data":{"labs":5}}').ok);
assert(parseBackup('{"app":"vitalis","version":1,"data":{"labs":[]}}').ok);
console.log('upgrades OK', a.sleepBalance.debtHours, a.vitals.spo2, a.experiments[0].verdict);
