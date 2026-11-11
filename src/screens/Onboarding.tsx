import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { BigButton, Pop } from '../components/ui';
import { colors } from '../theme';

const STEPS = [
  { emoji: '💚', title: 'Recovery', text: 'Every morning, a 0-100 score for how ready your body is. It compares last night with your own normal, not an average person.' },
  { emoji: '⚡', title: 'Strain and sleep', text: 'See how hard you worked, how well you slept against what you needed, and how many hours to aim for tonight.' },
  { emoji: '📝', title: 'Habits and blood tests', text: 'Log a quick daily check-in and your lab results. Vitalis shows which habits go with better mornings in your own data.' },
  { emoji: '🔒', title: 'Private by design', text: 'No account. Everything is calculated on your phone. Vitalis is not a medical device, so use it for insight, and see a clinician for health decisions.' },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const s = STEPS[i];
  const last = i === STEPS.length - 1;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 28 }}>
      <Pop key={i}>
        <Text style={{ fontSize: 84, textAlign: 'center' }}>{s.emoji}</Text>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: 14 }}>{s.title}</Text>
        <Text style={{ color: colors.sub, fontSize: 16, lineHeight: 25, textAlign: 'center', marginTop: 12 }}>{s.text}</Text>
      </Pop>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 26 }}>
        {STEPS.map((_, k) => (
          <View key={k} style={{ width: k === i ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? colors.lime : colors.border }} />
        ))}
      </View>
      <View style={{ marginTop: 18 }}>
        <BigButton label={last ? "Let's go" : 'Next'} emoji={last ? '🚀' : undefined} onPress={() => (last ? onDone() : setI(i + 1))} />
        {!last ? <BigButton label="Skip" color={colors.cardAlt} textColor={colors.text} onPress={onDone} /> : null}
      </View>
    </View>
  );
}
