import React from 'react';
import { Text, View } from 'react-native';
import { Info } from '../components/Explain';
import { Bounce, Card, Note } from '../components/ui';
import { FEEL, HABITS, JournalEntry } from '../metrics';
import { colors } from '../theme';

/** Daily check-in: how you feel this morning, and what today held. Saves on every tap. */
export function CheckIn({ entry, onFeel, onHabit, loggedDays }: { entry?: JournalEntry; onFeel: (v: 1 | 2 | 3 | 4 | 5) => void; onHabit: (id: string) => void; loggedDays: number }) {
  return (
    <Card title="Daily check-in" emoji="📝" delay={110}>
      <View style={{ position: 'absolute', right: 14, top: 12 }}>
        <Info topic="journal" />
      </View>
      <Text style={{ color: colors.sub, fontWeight: '700', marginBottom: 8 }}>How do you feel this morning?</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {FEEL.map((f) => {
          const on = entry?.feel === f.v;
          return (
            <Bounce key={f.v} onPress={() => onFeel(f.v)} outerStyle={{ flex: 1 }} style={{ alignItems: 'center', paddingVertical: 10, borderRadius: 16, backgroundColor: on ? colors.lime : colors.cardAlt, borderWidth: 1.5, borderColor: on ? colors.lime : colors.border }}>
              <Text style={{ fontSize: 24 }} accessibilityLabel={f.label}>{f.emoji}</Text>
              <Text style={{ color: on ? colors.ink : colors.sub, fontSize: 10, fontWeight: '800', marginTop: 2 }}>{f.label}</Text>
            </Bounce>
          );
        })}
      </View>
      <Text style={{ color: colors.sub, fontWeight: '700', marginTop: 16, marginBottom: 8 }}>What happened today? (tap any)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {HABITS.map((h) => {
          const on = entry?.habits.includes(h.id);
          return (
            <Bounce key={h.id} onPress={() => onHabit(h.id)} style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: on ? colors.grape : colors.cardAlt, borderWidth: 1.5, borderColor: on ? colors.grape : colors.border }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{h.emoji} {h.label}</Text>
            </Bounce>
          );
        })}
      </View>
      <Note>{loggedDays < 14 ? `${loggedDays} of 14 days logged. Habit patterns unlock at 14.` : `${loggedDays} days logged. Patterns appear on the Trends tab.`}</Note>
    </Card>
  );
}
