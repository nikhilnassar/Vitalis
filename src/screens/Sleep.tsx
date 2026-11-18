import React from 'react';
import { Text, View } from 'react-native';
import { Bars, Card, Note, Pill, Row, Stat } from '../components/ui';
import { Analysis } from '../metrics';
import { colors } from '../theme';

const hm = (h: number) => `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`;
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Balance({ a }: { a: Analysis }) {
  const b = a.sleepBalance;
  const col = b.debtLevel === 'none' ? colors.mint : b.debtLevel === 'small' ? colors.sun : colors.coral;
  const bed = b.suggestedBed ? `${String(b.suggestedBed.hour).padStart(2, '0')}:${String(b.suggestedBed.minute).padStart(2, '0')}` : undefined;
  return (
    <Card title="Sleep debt, last 7 nights" emoji="🏦" delay={100}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Stat label="Debt" value={b.nights >= 3 ? b.debtHours : '--'} unit="h" color={col} />
        <Stat label="Avg sleep" value={b.avgHours ?? '--'} unit="h" sub={`need ${b.needHours} h`} />
        <Stat label="Regularity" value={b.consistency ?? '--'} unit={b.consistency !== undefined ? '%' : undefined} />
      </View>
      <Text style={{ color: colors.sub, lineHeight: 20, marginTop: 12 }}>{b.text}</Text>
      {bed ? <Row left="🛏️ Bedtime for tonight's need" right={bed} /> : null}
      {b.socialJetlagMin !== undefined ? (
        <Row left="Weekend vs weekday shift" right={`${b.socialJetlagMin > 0 ? '+' : ''}${Math.round(b.socialJetlagMin)} min`} rightColor={Math.abs(b.socialJetlagMin) > 60 ? colors.coral : colors.mint} />
      ) : null}
      <Note>Extra sleep on one night only offsets part of a short week. A weekend shift over an hour is like flying a time zone every Monday.</Note>
    </Card>
  );
}

export function SleepScreen({ a }: { a: Analysis }) {
  const sleep = a.today.sleep;
  if (!sleep) {
    return (
      <View>
      <Card title="Sleep" emoji="🌙">
        <Text style={{ color: colors.sub, lineHeight: 21 }}>No sleep found for last night 🦉. Wear your tracker to bed and let it sync with Apple Health or Health Connect.</Text>
      </Card>
      <Balance a={a} />
      </View>
    );
  }
  return <SleepBody a={a} sleep={sleep} />;
}

function SleepBody({ a, sleep }: { a: Analysis; sleep: NonNullable<Analysis['today']['sleep']> }) {
  const m = sleep.stageMinutes;
  const total = Math.max(1, m.awake + m.light + m.deep + m.rem);
  const stages: [string, number, string, string][] = [
    ['Awake', m.awake, colors.coral, '👀'],
    ['Light', m.light, colors.sky, '☁️'],
    ['Deep', m.deep, colors.grape, '🌊'],
    ['REM', m.rem, colors.mint, '💭'],
  ];
  const last14 = a.days.slice(-14).map((d) => d.sleep?.hoursAsleep ?? null);
  const mood = sleep.performance >= 85 ? '🥳 Nailed it' : sleep.performance >= 65 ? '🙂 Pretty good' : '🥱 Rough night';

  return (
    <View>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: 12, marginTop: 4 }}>Sleep 🌙</Text>
      <Card accent={colors.grape}>
        <Pill text={mood} color={colors.grape} />
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
          <Stat label="Asleep" value={hm(sleep.hoursAsleep)} sub={`need ${hm(sleep.needHours)}`} />
          <Stat label="Score" value={sleep.performance} unit="%" color={colors.grape} />
          <Stat label="Efficiency" value={sleep.efficiency} unit="%" />
        </View>
        <Text style={{ color: colors.sub, marginTop: 12, fontSize: 13 }}>
          🛏️ {clock(sleep.start)}  →  ☀️ {clock(sleep.end)}
        </Text>
      </Card>

      <Card title="Stages" emoji="🧩" delay={80}>
        {sleep.hasStages ? (
          <>
            <View style={{ flexDirection: 'row', height: 18, borderRadius: 9, overflow: 'hidden', marginBottom: 12, gap: 2 }}>
              {stages.map(([n, v, c]) => (
                <View key={n} style={{ flex: Math.max(v, 0.001) / total, backgroundColor: c }} />
              ))}
            </View>
            {stages.map(([n, v, c, e]) => (
              <Row key={n} left={`${e} ${n}`} right={`${Math.round(v)} min`} rightColor={c} />
            ))}
          </>
        ) : (
          <Note>Your tracker did not report sleep stages, so only duration and efficiency are scored.</Note>
        )}
      </Card>

      <Balance a={a} />

      <Card title="Debt and rhythm" emoji="⏰" delay={120}>
        <Row left="Short of your need" right={sleep.debtHours > 0 ? hm(sleep.debtHours) : 'None 🎉'} rightColor={sleep.debtHours > 1 ? colors.coral : colors.mint} />
        {sleep.consistency != null ? <Row left="Bed/wake regularity" right={`${sleep.consistency}%`} /> : null}
        {sleep.restorativePct != null ? <Row left="Deep + REM share" right={`${sleep.restorativePct}%`} /> : null}
      </Card>

      <Card title="Last 14 nights" emoji="📊" delay={160}>
        <Bars values={last14} max={10} colorFor={(v) => (v >= 7 ? colors.mint : v >= 6 ? colors.sun : colors.coral)} />
        <Note>Green: 7 hours or more. Yellow: 6 to 7. Red: under 6.</Note>
      </Card>
    </View>
  );
}
