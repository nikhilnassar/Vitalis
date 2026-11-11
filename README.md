# Vitalis

Recovery, strain, sleep, blood-pressure, body-composition and biological-age insights from the tracker you already own.
React Native (Expo) app for iOS and Android. No account, no subscription, no server: all scoring runs on the phone.

Data comes from **Apple Health** (iOS) and **Health Connect** (Android). Garmin, Fitbit, Samsung, Oura, Apple Watch, Polar, Withings, smart scales (Eufy, Withings, Renpho...) and BP cuffs (Omron, Withings, Qardio...) sync into one of those. You can also type in BP readings and weigh-ins.

## Run it

```bash
npm install
npm test            # scoring-engine checks, including the BP model reliability gate
npm run typecheck
npm run web         # browser preview, demo data only (health stores don't exist in a browser)

# Real health data needs a development build (native modules; Expo Go cannot load them)
npx expo prebuild
npx expo run:ios        # Mac + Xcode + a real iPhone (HealthKit is limited on simulators)
npx expo run:android    # Android Studio + a phone with Health Connect installed
```

"Try with demo data" on the first screen runs everything on 90 days of synthetic data, no permissions needed.

## What it computes

| Metric | How |
|---|---|
| **Recovery 0-100** | Weighted z-scores vs *your own* 30-day baseline: overnight HRV (log, 45%), resting HR (25%), sleep performance (20%), respiratory rate (10%). Green 67+, yellow 34-66, red below. |
| **Strain 0-21** | Time in heart-rate-reserve zones, weighted 1-5 (Edwards TRIMP), through a saturating curve. Falls back to workouts + steps if no HR stream. |
| **Sleep performance** | Hours asleep vs need (baseline + strain) 60%, efficiency 15%, deep+REM share 15%, bed/wake regularity 10%. Tonight's recommendation also adds partial repayment of recent debt. |
| **Coaching + wins** | Target strain from recovery band, sleep to aim for, overreaching flag, trends, friendly badges (sleep streak, green days, steps, HRV up, BP check-in, weigh-in). |
| **Blood pressure log** | Cuff readings from the health store or typed in: category (AHA/ACC bands), 7/30-day averages, morning vs evening, weekly trend, 60-day chart. A reading at 180/120 or above shows an urgent banner on every screen. |
| **"Take a reading" prompt** | A nudge only, never a number. Fires when HRV/resting HR or sleep look off for most of 4 days and your last reading is over a week old, or when a high reading has not been rechecked. |
| **Personal BP estimate** | See below. Hidden unless it proves itself. |
| **Weight and composition** | Weigh-ins from your scale or typed in: 7-day average, weekly trend, body fat, lean/fat mass, body water, bone mass, BMI. Latest weight and body fat feed the calorie and metabolic-age maths. |
| **Biological age** | Heuristic: VO2max (or resting-HR estimate), resting HR, HRV, sleep, steps, body composition → years older/younger, shrunk 30% for overlap, capped at ±15. |
| **Metabolic** | BMR (Katch-McArdle with body fat, else Mifflin-St Jeor), active + total burn, HR zones, metabolic age (needs body fat), metabolic-fitness score. |

All formulas are plain TypeScript in `src/metrics/`.

### How the personal BP estimate stays honest

Fitness bands cannot measure BP from the wrist reliably, and Apple Health / Health Connect never give apps the raw pulse waveform that cuffless systems analyse. So Vitalis does **not** pretend to measure BP. Instead:

1. It needs **30 days with a cuff reading** (plus overnight data) before it will even try.
2. It fits a small ridge regression of *your* readings on *your* overnight HRV, resting HR, respiratory rate, sleep and the previous day's strain and steps.
3. It tests itself on readings it has not seen, using time-blocked folds with a 2-day buffer so neighbouring days cannot leak.
4. The estimate is shown only if its error is at most 85% of "just guess your average", the improvement is statistically clear (t ≥ 2 with a halved effective sample), and the error is under 8 mmHg (systolic) / 6 mmHg (diastolic).
5. When shown, it carries a ~90% range, is labelled "Estimate, not a reading", and says to confirm with a cuff.

Measured on synthetic data (`npm test`): passes ~93% of the time when overnight data strongly predicts BP; ~43% at a moderate link with ~45 readings, rising to ~93% with ~100 readings; **0 of 200** false passes on data with no link; 0% on readings too noisy to be useful. Real physiology may behave differently, and for many people the honest result will simply be "not useful yet".

## Honest limits

- **These are approximations, not Whoop's, Hume's or Google's algorithms.** They are consistent for you over time but will not match any vendor's numbers.
- **Fitbit Edge-style cuffless BP trends are not reproduced.** Google's Edge feature outputs a monthly "High / Not high" category and, as far as Google's help page says, is not exposed to other apps. Vitalis does not read it.
- **Biological and metabolic age are heuristics**, not clinical measurements.
- **Body composition (fat, muscle, water, bone)** comes from your scale or what you type. A wrist band cannot measure it. Apple Health has no body-water or bone-mass types, so those only appear on Android.
- **HRV differs by source**: Apple stores SDNN, Health Connect stores RMSSD. Scores compare you against yourself, so don't switch trackers mid-baseline.
- **Data quality is the ceiling**: continuous HR and overnight HRV matter most.
- **Not a medical device.** Nothing here diagnoses or treats anything.

## Verify on device (not done in the build sandbox)

The scoring engine, data assembly, TypeScript types, config plugins, the browser preview and both native JS bundles were checked in the sandbox. The two native adapters were checked against the installed library type definitions, but **could not be run against a real HealthKit or Health Connect store**. Before trusting results, on a device check:

1. HRV values look like milliseconds (20-120), not 0.05 (seconds).
2. Weight, height and lean-mass units are right.
3. Sleep stages appear (Apple needs iOS 16+ and a compatible tracker).
4. BP cuff readings written by your cuff app appear on the BP tab.
5. `react-native-health` method names match your installed version (the adapter silently skips missing ones).
6. Android: the history permission prompt appears and you get more than 30 days of data (the BP model needs a long window).

## Before publishing

- Change the bundle id / package name in `app.json` (`com.example.vitalis`).
- Add a privacy policy: Apple and Google require one for health apps. Health Connect also requires a permissions rationale screen for Play Store approval, and `READ_HEALTH_DATA_HISTORY` gets extra review.
- Keep the "not a medical device" notices.

## Layout

```
App.tsx                  tab shell (scroll bars hidden, tabs reset to top)
src/metrics/             recovery, strain, sleep, bodyage, metabolic, coach, bp, bpmodel, bodycomp, badges, analyze
src/health/              assemble.ts (raw samples -> daily data), appleHealth.ts, healthConnect.ts, demo.ts
src/screens/             Today, Sleep, Trends, Body, Bp, Setup
src/components/ui.tsx    animated rings, bouncy buttons, charts
src/useVitalis.ts        loading, profile, manual BP / weight storage
test/run.ts              engine checks incl. BP model gate
```

## App icon
`assets/icon.png` (iOS, full-bleed) and `assets/adaptive-icon.png` (Android foreground, scaled to sit inside the 66% safe circle on `#07163D`) come from the supplied VITALIS logo. The logo also appears on the Connect screen.

## Data check (You tab)
Shows how many of the last 7 days your tracker actually shared sleep, resting HR, heart-rate stream, HRV, steps, calories, weight and BP, with a tip for anything missing, plus any failed Health Connect reads. If a metric looks empty, look here first: it is usually a tracker or permission setting, not the app.

## Sparse-data behaviour
Strain shows "--" until heart rate, workouts or steps exist. Charts skip leading empty days and explain themselves when empty. Recovery shows a "still learning you" notice until the baseline has ~14 nights. Health Connect reads that exceed the 30-day limit fall back to 29 days.

## Previewing a sparse phone
`EXPO_PUBLIC_DEMO=sparse npx expo export --platform web` loads data that mimics a tracker sharing only sleep and resting HR. `TZ=Asia/Dubai npx tsx test/sparse.ts` checks it.

## Long-term biomarkers and habit insights (Trends tab)
Biomarker card: last 30 days vs the 30 before for HRV, resting HR, sleep, VO2max, weight and systolic BP, marked better/worse/steady only past a minimum change. Habit card: yesterday's strain, steps, sleep and bedtime against this morning's HRV, resting HR and recovery. A pattern shows only with 21+ paired days, |r| >= 0.3 and t >= 2 (half the days counted, since neighbouring days are correlated). These are associations, not proof of cause.

## Sync
The app re-reads Health Connect whenever it returns to the foreground. Data still only appears once your tracker's own app has synced into Health Connect; Data check shows how old the newest record is.

## v0.2 additions
- **Daily check-in + habit journal** (Today tab): how you feel plus 10 habit toggles. After 14 logged days, Trends shows which habits go with higher/lower next-morning HRV, resting HR and recovery (difference of means, discounted t-test; null data produced 0 false claims in 20 runs). It also tells you whether recovery matches how you feel.
- **Blood tests** (Body tab): LDL, HDL, triglycerides, total cholesterol, HbA1c, fasting glucose, vitamin D, ferritin, hs-CRP, TSH with generic ranges, change since last, and a "mention to your clinician" note. Not diagnostic.
- **Illness watch:** resting HR up and HRV (or breathing) worse two mornings running.
- **Notifications + background sync:** morning summary, bedtime reminder (from your usual wake time and tonight's need), weekly BP reminder. Android needs the Health Connect background-read permission for refresh while closed; the OS schedules the task, so timing is best-effort.
- **Error reporting:** error boundary, on-phone error log, optional opt-in Sentry (`EXPO_PUBLIC_SENTRY_DSN`), scrubbed of health data.
- **Polish:** onboarding, tap-to-explain on rings, settings, delete-all-data, cached last result with "updated X ago", skeleton loading.
- **Play Store:** see `docs/PLAY_STORE.md`, `docs/PRIVACY_POLICY.md`, `eas.json`, `scripts/make-upload-key.sh`. Package id is `app.vitalis.tracker`; change it before first publish.

Not done: SpO2 / skin temperature (would add permissions to justify), menstrual-cycle awareness, per-sport strain, light theme, translations.
Tests: `npm test`, plus `npx tsx test/sparse.ts`, `test/journal.ts`, `test/notify.ts` (set `TZ=Asia/Dubai`).
