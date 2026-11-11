import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Explain } from '../components/Explain';
import { Banner, Card, Note, Pill, Ring, Row } from '../components/ui';
import { JournalEntry } from '../metrics';
import { CheckIn } from './Journal';
import { Analysis } from '../metrics';
import type { Tab } from '../nav';
import { bandColor, bandEmoji, colors } from '../theme';

const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);

const HERO: Record<string, string> = {
  green: 'Full battery!',
  yellow: 'Decent charge',
  red: 'Low battery',
};

const ago = (t?: number) => {
  if (!t) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

export function Today({
  a,
  go,
  todayEntry,
  onFeel,
  onHabit,
  updatedAt,
  stale,
}: {
  a: Analysis;
  go: (t: Tab) => void;
  todayEntry?: JournalEntry;
  onFeel: (v: 1 | 2 | 3 | 4 | 5) => void;
  onHabit: (id: string) => void;
  updatedAt?: number;
  stale?: boolean;
}) {
  const { today, coaching } = a;
  const rec = today.recovery;
  const sleep = today.sleep;
  const band = rec.band;
  const strainColor = today.strain.strain >= 14 ? colors.pink : today.strain.strain >= 10 ? colors.sun : colors.sky;
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, marginTop: 4 }}>
        <View>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>Hey there 👋</Text>
          <Text style={{ color: colors.sub, marginTop: 2 }}>{date}{updatedAt ? `  ·  ${stale ? 'showing saved data from' : 'updated'} ${ago(updatedAt)}` : ''}</Text>
        </View>
        <Text style={{ fontSize: 44 }}>{bandEmoji(band)}</Text>
      </View>

      <Card accent={bandColor(band)} delay={0}>
        <Text style={{ color: bandColor(band), fontSize: 24, fontWeight: '900' }}>{band ? HERO[band] : 'Charging up...'}</Text>
        <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 6 }}>{coaching.headline}</Text>
        {coaching.targetStrain ? (
          <View style={{ marginTop: 12 }}>
            <Pill text={`🎯 Aim for strain ${coaching.targetStrain.low}-${coaching.targetStrain.high}`} color={bandColor(band)} />
          </View>
        ) : null}
      </Card>

      <Card delay={80}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Explain topic="recovery"><Ring value={rec.score} max={100} color={bandColor(band)} label={`${rec.score}%`} caption="RECOVERY" emoji="💚" /></Explain>
          <Explain topic="strain"><Ring value={today.strain.hasData ? today.strain.strain : null} max={21} color={strainColor} label={today.strain.strain.toFixed(1)} caption="STRAIN" emoji="⚡" /></Explain>
          <Explain topic="sleep"><Ring value={sleep?.performance} max={100} color={colors.grape} label={`${sleep?.performance}%`} caption="SLEEP" emoji="🌙" /></Explain>
        </View>
      </Card>

      {coaching.illnessWatch ? <Banner emoji="🤒" tone="warn" title="Your body may be fighting something" text="Resting heart rate is up and HRV is down for two mornings in a row. Ease off, hydrate and sleep well. See a clinician if you feel unwell." /> : null}

      {rec.status === 'ok' && (rec.baselineDays ?? 99) < 14 ? (
        <Banner emoji="🌱" title="Still learning you" text={`Your baseline is built from just ${rec.baselineDays} nights so far, so recovery will shift as it sharpens over the next couple of weeks.`} />
      ) : null}

      {a.bp.prompt.show ? <Banner emoji="🩺" tone={a.bp.prompt.tone === 'warn' ? 'warn' : 'info'} title={a.bp.prompt.title} text={a.bp.prompt.reason} onPress={() => go('BP')} /> : null}

      {a.badges.length ? (
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.sub, fontSize: 13, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>🏆  YOUR WINS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {a.badges.map((b) => (
              <View key={b.title} style={{ width: 160, backgroundColor: colors.cardAlt, borderRadius: 20, padding: 14, borderWidth: 1.5, borderColor: colors.border }}>
                <Text style={{ fontSize: 30 }}>{b.emoji}</Text>
                <Text style={{ color: colors.text, fontWeight: '800', marginTop: 6 }}>{b.title}</Text>
                <Text style={{ color: colors.sub, fontSize: 12, marginTop: 2 }}>{b.detail}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <CheckIn entry={todayEntry} onFeel={onFeel} onHabit={onHabit} loggedDays={a.journal.loggedDays} />

      <Card title="Tonight" emoji="🛏️" delay={120}>
        <Row left="Sleep to aim for" right={`${coaching.tonightSleepHours.toFixed(1)} h`} rightColor={colors.grape} />
        {coaching.insights.map((t, i) => (
          <Text key={i} style={{ color: colors.sub, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            ✨ {t}
          </Text>
        ))}
      </Card>

      <Card title="What's driving recovery" emoji="🔍" delay={160}>
        {rec.components.hrv ? (
          <Row left="💓 HRV" right={`${rec.components.hrv.value} ms (${fmt(rec.components.hrv.deltaPct)}%)`} rightColor={rec.components.hrv.z < -0.5 ? colors.coral : colors.mint} />
        ) : null}
        {rec.components.rhr ? (
          <Row left="🫀 Resting HR" right={`${rec.components.rhr.value} bpm (${fmt(rec.components.rhr.deltaPct)}%)`} rightColor={rec.components.rhr.z < -0.5 ? colors.coral : colors.mint} />
        ) : null}
        {rec.components.resp ? <Row left="🌬️ Breathing" right={`${rec.components.resp.value} rpm (${fmt(rec.components.resp.deltaPct)}%)`} /> : null}
        {sleep ? <Row left="😴 Sleep score" right={`${sleep.performance}%`} /> : null}
        <Note>Everything is compared with your own 30-day normal, not an average person.</Note>
      </Card>

      <Card title="Today's effort" emoji="⚡" delay={200}>
        {today.strain.hasData ? (
          <>
            <Row left="Load" right={`${today.strain.load}`} />
            {today.strain.avgHr ? <Row left="Average / peak HR" right={`${today.strain.avgHr} / ${today.strain.peakHr} bpm`} /> : null}
            {today.strain.source === 'estimated' ? <Note>No continuous heart rate yet today, so this is estimated from workouts and steps.</Note> : null}
          </>
        ) : (
          <Text style={{ color: colors.sub, lineHeight: 20 }}>No heart-rate stream, workouts or steps are reaching Vitalis yet. Check the "Data check" on the You tab to see what your tracker is sharing 🔎</Text>
        )}
      </Card>
    </View>
  );
}
