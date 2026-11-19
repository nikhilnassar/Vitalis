import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Bounce, Card, Note, Pill } from '../components/ui';
import { Analysis, HABITS } from '../metrics';
import { colors } from '../theme';

const VERDICT = {
  helped: { text: '✅ Helped', color: colors.mint },
  hurt: { text: '⚠️ Hurt', color: colors.coral },
  'no-clear-effect': { text: '➡️ No clear effect', color: colors.sub },
  'not-enough-data': { text: '⏳ Collecting', color: colors.sky },
} as const;

/** Run a 14-day test on yourself: avoid or add one habit, and compare with the 14 mornings before. */
export function Experiments({ a, onStart, onStop }: { a: Analysis; onStart: (habit: string, mode: 'avoid' | 'do', days: number) => void; onStop: (id: string) => void }) {
  const [picking, setPicking] = useState(false);
  const [mode, setMode] = useState<'avoid' | 'do'>('avoid');
  const active = (a.experiments ?? []).filter((e) => e.status === 'running').length;
  const label = (id: string) => HABITS.find((h) => h.id === id);

  return (
    <Card title="Personal experiments" emoji="🧪" delay={200}>
      <Text style={{ color: colors.sub, lineHeight: 20 }}>Test one change for 14 days and see what it does to your HRV, resting heart rate, recovery and sleep.</Text>
      {(a.experiments ?? []).map((r) => {
        const h = label(r.exp.habit);
        const v = VERDICT[r.verdict];
        return (
          <View key={r.exp.id} style={{ marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: colors.cardAlt }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>{h?.emoji} {r.exp.mode === 'avoid' ? 'Avoid' : 'Do'}: {h?.label}</Text>
              <Pill text={v.text} color={v.color} />
            </View>
            <Text style={{ color: colors.sub, fontSize: 12, marginTop: 4 }}>
              {r.status === 'done' ? 'Finished' : `Day ${r.dayNumber} of ${r.exp.days}, ${r.daysLeft} left`}
              {r.adherence ? `  ·  followed ${r.adherence.followed} of ${r.adherence.logged} logged days` : ''}
            </Text>
            <Text style={{ color: colors.text, lineHeight: 20, marginTop: 8 }}>{r.summary}</Text>
            {r.effects.map((e) => (
              <Text key={e.marker} style={{ color: colors.sub, fontSize: 12, marginTop: 3 }}>
                {e.significant ? (e.good ? '▲' : '▼') : '•'} {e.marker}: {e.before} → {e.during} {e.unit}
              </Text>
            ))}
            <Bounce
              onPress={() => Alert.alert(r.status === 'done' ? 'Remove this result?' : 'Stop this experiment?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: r.status === 'done' ? 'Remove' : 'Stop', style: 'destructive', onPress: () => onStop(r.exp.id) }])}
              style={{ marginTop: 10, alignSelf: 'flex-start' }}
            >
              <Text style={{ color: colors.sky, fontWeight: '700' }}>{r.status === 'done' ? 'Remove' : 'Stop experiment'}</Text>
            </Bounce>
          </View>
        );
      })}
      {!picking ? (
        active < 2 ? (
          <Bounce onPress={() => setPicking(true)} style={{ marginTop: 14, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.lime, alignItems: 'center' }}>
            <Text style={{ color: colors.ink, fontWeight: '900' }}>Start an experiment</Text>
          </Bounce>
        ) : (
          <Note>Two at a time is the limit, so the effects do not tangle.</Note>
        )
      ) : (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            {(['avoid', 'do'] as const).map((m) => (
              <Bounce key={m} onPress={() => setMode(m)} outerStyle={{ flex: 1 }} style={{ paddingVertical: 10, borderRadius: 14, alignItems: 'center', backgroundColor: mode === m ? colors.lime : colors.cardAlt }}>
                <Text style={{ color: mode === m ? colors.ink : colors.text, fontWeight: '800' }}>{m === 'avoid' ? 'Avoid' : 'Do daily'}</Text>
              </Bounce>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {HABITS.filter((h) => h.id !== 'sick' && h.id !== 'travel').map((h) => (
              <Bounce key={h.id} onPress={() => { setPicking(false); onStart(h.id, mode, 14); }} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.cardAlt, borderWidth: 1.5, borderColor: colors.border }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{h.emoji} {h.label}</Text>
              </Bounce>
            ))}
          </View>
          <Note>Starts tomorrow and runs 14 days. Log the habit in your daily check-in so Vitalis can tell whether you stuck to it.</Note>
        </View>
      )}
      <Note>A before-and-after in one person. It cannot prove cause, but it is better evidence than a hunch.</Note>
    </Card>
  );
}
