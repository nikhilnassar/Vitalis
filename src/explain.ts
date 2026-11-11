export const EXPLAIN = {
  recovery: {
    title: 'Recovery 💚',
    body: 'How ready your body is today, 0 to 100. It compares last night\'s HRV, resting heart rate, breathing and sleep with your own 30-day normal, not an average person. Green is 67+, yellow 34 to 66, red below 34. It is an estimate built from your tracker\'s data, not a medical measurement.',
  },
  strain: {
    title: 'Strain ⚡',
    body: 'How hard your body has worked today, 0 to 21, from time spent at higher heart rates (a heart-rate load model). It climbs fast at first and slowly near the top, so 18 is much harder than 14. Without a heart-rate stream it is estimated from workouts and steps.',
  },
  sleep: {
    title: 'Sleep 🌙',
    body: 'How well you slept against what your body needed: enough hours (60%), time actually asleep while in bed (15%), deep plus REM sleep (15%, only if your tracker reports stages) and regular bed and wake times (10%).',
  },
  hrv: { title: 'HRV 💓', body: 'Beat-to-beat variation in your heartbeat. Higher than your normal usually means you are recovered; a sustained drop often follows stress, illness, alcohol or heavy training. Compare with yourself only: Apple reports a different kind of HRV than Android trackers.' },
  rhr: { title: 'Resting heart rate 🫀', body: 'Your heart rate at rest, usually overnight. Lower than your normal is a good sign; a rise of several beats can signal fatigue or illness.' },
  bioAge: { title: 'Biological age 🧬', body: 'A friendly estimate from fitness, resting heart rate, HRV, sleep, steps and body make-up compared with people your age. It is a heuristic to watch your own direction, not a clinical biological-age test.' },
  labs: { title: 'Blood tests 🩸', body: 'Type in results from your own lab reports to follow them over time. Ranges shown are generic adult ranges; your lab\'s printed range and your clinician\'s advice win. Vitalis does not diagnose anything.' },
  journal: { title: 'Daily check-in 📝', body: 'Tell Vitalis how you feel and what happened today. After a couple of weeks it can show which habits go with better or worse next mornings in your own data. That is a pattern, not proof of cause.' },
} as const;

export type ExplainKey = keyof typeof EXPLAIN;
