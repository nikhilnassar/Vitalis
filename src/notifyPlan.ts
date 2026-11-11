import type { Analysis } from './metrics';

export interface NotifyPlan {
  morning?: { title: string; body: string };
  bedtime?: { hour: number; minute: number; title: string; body: string };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : undefined;
};

/** Pure decision logic: what, if anything, to tell the person. Kept free of native modules so it can be tested. */
export function planNotifications(a: Analysis): NotifyPlan {
  const plan: NotifyPlan = {};
  const t = a.today;

  if (t.recovery.score != null) {
    const target = a.coaching.targetStrain;
    const emoji = t.recovery.band === 'green' ? '💚' : t.recovery.band === 'yellow' ? '💛' : '❤️';
    plan.morning = {
      title: `Recovery ${t.recovery.score}% ${emoji}`,
      body: [a.coaching.illnessWatch ? 'Your body may be fighting something, so take it easy.' : target ? `Aim for strain ${target.low}-${target.high} today.` : a.coaching.headline, t.sleep ? `Sleep score ${t.sleep.performance}%.` : ''].filter(Boolean).join(' '),
    };
  }

  // Typical wake time = median wake clock time over the last 14 nights with sleep data.
  const wakes = a.days
    .slice(-14)
    .map((d) => d.sleep?.end)
    .filter((x): x is number => x != null)
    .map((ms) => {
      const d = new Date(ms);
      return d.getHours() * 60 + d.getMinutes();
    });
  const wake = median(wakes);
  if (wake != null && wakes.length >= 4) {
    // Remind 45 minutes before the bedtime that meets tonight's sleep need.
    const mins = (((wake - Math.round(a.tonightNeedHours * 60) - 45) % 1440) + 1440) % 1440;
    plan.bedtime = {
      hour: Math.floor(mins / 60),
      minute: mins % 60,
      title: 'Wind down time 🌙',
      body: `Your body wants about ${a.tonightNeedHours.toFixed(1)} h tonight. Start easing off screens to hit your usual wake time.`,
    };
  }
  return plan;
}
