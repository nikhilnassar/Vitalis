import React, { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { BigButton, Chip, Field, Pop } from '../components/ui';
import { platformName } from '../health';
import { colors } from '../theme';
import { UserProfile } from '../types';

export function Connect({ onPlatform, onDemo, error, loading }: { onPlatform: () => void; onDemo: () => void; error?: string; loading?: boolean }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <Pop>
        <Text style={{ fontSize: 64 }}>🫀⚡🌙</Text>
        <Text style={{ color: colors.text, fontSize: 40, fontWeight: '900', marginTop: 8 }}>Vitalis</Text>
        <Text style={{ color: colors.sub, fontSize: 16, lineHeight: 24, marginTop: 10 }}>
          Recovery, strain, sleep and body insights from the tracker you already own. All crunched on your phone: no account, no subscription. 🎉
        </Text>
      </Pop>
      {error ? <Text style={{ color: colors.coral, marginTop: 16 }}>😬 {error}</Text> : null}
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.lime} /> : null}
      <View style={{ marginTop: 18 }}>
        <BigButton label={`Connect ${platformName}`} emoji="🔌" onPress={onPlatform} disabled={loading} />
        <BigButton label="Try with demo data" emoji="🎮" color={colors.sky} onPress={onDemo} disabled={loading} />
      </View>
      <Text style={{ color: colors.sub, fontSize: 12, marginTop: 18, lineHeight: 18 }}>
        Works with anything that syncs to {platformName}: Garmin, Fitbit, Samsung, Oura, Apple Watch, Polar, Withings, smart scales and BP cuffs.
      </Text>
    </View>
  );
}

export function ProfileForm({ initial, onSave, title = 'About you' }: { initial: Partial<UserProfile>; onSave: (p: Partial<UserProfile>) => void; title?: string }) {
  const [age, setAge] = useState(initial.age ? String(Math.round(initial.age)) : '');
  const [sex, setSex] = useState<UserProfile['sex'] | undefined>(initial.sex);
  const [h, setH] = useState(initial.heightCm ? String(Math.round(initial.heightCm)) : '');
  const [w, setW] = useState(initial.weightKg ? String(Math.round(initial.weightKg * 10) / 10) : '');
  const [bf, setBf] = useState(initial.bodyFatPct ? String(Math.round(initial.bodyFatPct * 10) / 10) : '');
  const [need, setNeed] = useState(initial.sleepNeedHours ? String(initial.sleepNeedHours) : '');

  const ok = Number(age) >= 14 && Number(age) < 100 && !!sex && Number(h) > 100 && Number(w) > 30;
  const save = () =>
    onSave({
      age: Number(age),
      sex,
      heightCm: Number(h),
      weightKg: Number(w),
      bodyFatPct: bf ? Number(bf) : undefined,
      sleepNeedHours: need ? Number(need) : undefined,
    });

  return (
    <View style={{ padding: 8 }}>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900' }}>{title} 😎</Text>
      <Text style={{ color: colors.sub, marginTop: 6, lineHeight: 20 }}>Used for heart-rate zones, calories and age comparisons. Stays on this phone.</Text>
      <Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="34" />
      <Text style={{ color: colors.sub, fontSize: 12, fontWeight: '600', marginTop: 14 }}>Sex (for physiological formulas)</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
        <Chip label="Male" selected={sex === 'male'} onPress={() => setSex('male')} />
        <Chip label="Female" selected={sex === 'female'} onPress={() => setSex('female')} color={colors.pink} />
      </View>
      <Field label="Height (cm)" value={h} onChangeText={setH} placeholder="178" />
      <Field label="Weight (kg)" value={w} onChangeText={setW} placeholder="79" />
      <Field label="Body fat % (optional)" value={bf} onChangeText={setBf} placeholder="18" />
      <Field label="Baseline sleep need in hours (optional, default 8)" value={need} onChangeText={setNeed} placeholder="8" />
      <BigButton label="Save" emoji="💾" onPress={save} disabled={!ok} />
    </View>
  );
}
