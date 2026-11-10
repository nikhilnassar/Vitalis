import { strict as assert } from 'node:assert';
import { assemble } from '../src/health/assemble';
import { demoRaw } from '../src/health/demo';
import { analyze, classify, evaluateBpModel, ModelDay, MIN_PAIRS, summarizeBp, bpPrompt } from '../src/metrics';
import { loadToStrain } from '../src/metrics/strain';
import { normCdf } from '../src/metrics/util';
import { UserProfile } from '../src/types';

const profile = { age: 34, sex: 'male', heightCm: 178, weightKg: 79 } as UserProfile;
const now = new Date(2026, 10, 9, 14, 0).getTime(); // fixed "now": 9 Nov 2026, 14:00 local
const days = assemble(demoRaw(now), profile, 90, now);
const a = analyze(days, profile, now);
const avg = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;

// ---------- primitives ----------
assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-6);
assert.ok(loadToStrain(0) === 0 && loadToStrain(1e6) <= 21 && loadToStrain(1e6) > 20.9);

// ---------- data assembly ----------
assert.equal(days.length, 90);
assert.equal(days[days.length - 1].date, '2026-11-09');
assert.ok(days.filter((d) => d.sleep).length >= 85, 'most days have a main sleep');

// ---------- recovery / strain / sleep ----------
for (const d of a.days) {
  assert.ok(d.strain.strain >= 0 && d.strain.strain <= 21, `strain ${d.strain.strain}`);
  if (d.recovery.score !== null) assert.ok(d.recovery.score >= 1 && d.recovery.score <= 99);
  if (d.sleep) assert.ok(d.sleep.performance >= 0 && d.sleep.performance <= 100);
}
assert.ok(['calibrating', 'no-data'].includes(a.days[0].recovery.status), 'day 1 has no baseline');
assert.equal(a.today.recovery.status, 'ok');
const n = a.days.length;
const stressed = a.days.slice(n - 6, n - 2).map((d) => d.recovery.score!);
const normal = a.days.slice(n - 25, n - 8).map((d) => d.recovery.score!);
assert.ok(avg(stressed) < avg(normal) - 10, `stressed ${avg(stressed)} vs normal ${avg(normal)}`);
const workoutDays = a.days.filter((_, i) => days[i].workouts.length);
const restDays = a.days.filter((_, i) => !days[i].workouts.length && days[i].hrSamples.length > 100);
assert.ok(avg(workoutDays.map((d) => d.strain.strain)) > avg(restDays.map((d) => d.strain.strain)) + 3);
assert.ok(a.bioAge.bioAge !== null && Math.abs(a.bioAge.offsetYears!) <= 15);
assert.equal(a.metabolic.bmrMethod, 'katch-mcardle');
assert.ok(a.tonightNeedHours >= 8 && a.tonightNeedHours <= 10);

// ---------- BP classification and summary ----------
assert.equal(classify(115, 75), 'normal');
assert.equal(classify(124, 78), 'elevated');
assert.equal(classify(132, 78), 'high1');
assert.equal(classify(126, 85), 'high1');
assert.equal(classify(145, 85), 'high2');
assert.equal(classify(185, 100), 'urgent');
assert.equal(classify(125, 125), 'urgent');
assert.equal(classify(85, 55), 'low');

const bps = a.bp.summary;
assert.ok(bps.count > 20, `bp count ${bps.count}`);
assert.ok(bps.avg30 && bps.avg30.sys > 105 && bps.avg30.sys < 135);
assert.ok(bps.series.length > 20);
assert.equal(bps.urgentRecent, undefined);

// urgent detection: a 190/125 reading an hour ago
const urgentDays = days.map((d, i) => (i === days.length - 1 ? { ...d, bp: [...d.bp, { t: now - 3600_000, sys: 190, dia: 125 }] } : d));
assert.ok(summarizeBp(urgentDays, now).urgentRecent, 'urgent reading is flagged');
assert.equal(bpPrompt(summarizeBp(urgentDays, now), a.days).show, false, 'urgent case is handled by the banner, not the nudge');

// no readings at all -> onboarding prompt; old high reading -> recheck prompt
const noBp = days.map((d) => ({ ...d, bp: [] }));
assert.equal(bpPrompt(summarizeBp(noBp, now), a.days).show, true);
const oldHigh = noBp.map((d, i) => (i === days.length - 6 ? { ...d, bp: [{ t: new Date(d.date).getTime() + 8 * 3600_000, sys: 146, dia: 92 }] } : d));
const pHigh = bpPrompt(summarizeBp(oldHigh, now), a.days);
assert.ok(pHigh.show && pHigh.tone === 'warn', 'high reading not rechecked triggers a warning nudge');

// ---------- Personal BP model: the reliability gate ----------
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Mode = 'dependent' | 'independent';
function synth(seed: number, len: number, mode: Mode, readingRate = 0.7, noise = 2.2): ModelDay[] {
  const r = rng(seed);
  const g = () => (r() + r() + r() + r() - 2) * 1.73;
  let lat = 0;
  const out: ModelDay[] = [];
  for (let i = 0; i < len; i++) {
    lat = 0.6 * lat + 0.8 * g();
    const d: ModelDay = {
      hrv: 62 * (1 - 0.08 * lat) + (r() - 0.5) * 8,
      rhr: 53 + 1.3 * lat + (r() - 0.5) * 2,
      resp: 14.2 + 0.2 * lat + (r() - 0.5) * 0.5,
      sleepHours: 7.3 - 0.25 * lat + (r() - 0.5),
      strain: 6 + r() * 8,
      stepsK: 6 + r() * 5,
    };
    if (r() < readingRate) {
      d.sys = mode === 'dependent' ? 118 + 2.4 * lat + g() * noise : 118 + g() * 4;
      d.dia = mode === 'dependent' ? 76 + 1.5 * lat + g() * 1.8 : 76 + g() * 3;
    }
    out.push(d);
  }
  return out;
}
const rate = (mode: Mode, seeds: number, len: number, noise = 2.2) => {
  let pass = 0;
  for (let s = 1; s <= seeds; s++) if (evaluateBpModel(synth(s, len, mode, 0.7, noise)).sys.status === 'reliable') pass++;
  return pass / seeds;
};

// Strong link between overnight data and BP, ~45 readings: should usually pass.
const strong = rate('dependent', 60, 70, 1.5);
// Moderate link (about half the BP variance is explained), ~45 readings, then ~100 readings.
const moderate = rate('dependent', 60, 70, 2.2);
const moderateLong = rate('dependent', 60, 150, 2.2);
// No link at all: must almost never pass.
const falsePos = rate('independent', 200, 70);
// Readings so noisy that any estimate would be useless: must almost never pass.
const useless = rate('dependent', 60, 70, 9);
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
console.log(`Model gate passes: strong link ${pct(strong)} | moderate link, ~45 readings ${pct(moderate)} | moderate link, ~100 readings ${pct(moderateLong)}`);
console.log(`Model gate false-passes: no link ${pct(falsePos)} | useless-noise readings ${pct(useless)}`);
assert.ok(strong >= 0.85, `gate should usually pass on a strong link (got ${strong})`);
assert.ok(moderateLong >= moderate, 'more data should not hurt power');
assert.ok(falsePos <= 0.05, `gate should rarely pass on noise (got ${falsePos})`);
assert.ok(useless <= 0.1, `gate should reject readings too noisy to be useful (got ${useless})`);

const few = evaluateBpModel(synth(3, 30, 'dependent', 0.6));
assert.equal(few.sys.status, 'insufficient');
assert.ok(few.sys.n < MIN_PAIRS && few.sys.needed === MIN_PAIRS);
const ok = evaluateBpModel(synth(5, 80, 'dependent'));
if (ok.sys.status === 'reliable' && ok.sys.estimate !== undefined) {
  assert.ok(ok.sys.low! < ok.sys.estimate && ok.sys.estimate < ok.sys.high!);
  assert.ok(ok.sys.modelMae! < ok.sys.baselineMae!);
}

// ---------- Body composition ----------
const bc = a.bodyComp;
assert.ok(bc.hasData && bc.latest);
assert.ok(bc.latest!.weightKg > 76 && bc.latest!.weightKg < 82);
assert.ok(bc.kgPerWeek! < 0 && bc.kgPerWeek! > -0.6, `weight trend ${bc.kgPerWeek}`);
assert.ok(bc.bodyFatChange! < 0.5);
assert.ok(bc.latest!.bmi! > 22 && bc.latest!.bmi! < 27);
assert.ok(a.badges.length >= 1);

console.log('\nAll checks passed.\n');
console.log('Today:', { recovery: a.today.recovery.score, strain: a.today.strain.strain, sleepPerf: a.today.sleep?.performance });
console.log('BP:', { count30: bps.count, avg30: bps.avg30, last: bps.last && `${bps.last.sys}/${bps.last.dia}`, prompt: a.bp.prompt.show ? a.bp.prompt.title : 'none' });
console.log('BP model on demo data:', { sys: a.bp.model.sys.status, n: a.bp.model.sys.n, mae: a.bp.model.sys.modelMae, base: a.bp.model.sys.baselineMae, est: a.bp.model.sys.estimate, range: [a.bp.model.sys.low, a.bp.model.sys.high] });
console.log('Body:', { latest: bc.latest, avg7: bc.avg7Kg, perWeek: bc.kgPerWeek, bfChange: bc.bodyFatChange });
console.log('Badges:', a.badges.map((b) => b.emoji + ' ' + b.title).join(' | '));
