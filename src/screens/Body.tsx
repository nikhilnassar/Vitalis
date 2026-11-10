import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { BigButton, Card, Field, Note, Pill, Row, Spark, Stat } from '../components/ui';
import { Analysis } from '../metrics';
import { colors } from '../theme';
import { UserProfile } from '../types';

export function Body({ a, profile, onAddWeight }: { a: Analysis; profile: UserProfile; onAddWeight: (kg: number, bf?: number) => Promise<void> }) {
  const { bioAge, metabolic: m, bodyComp: bc } = a;
  const off = bioAge.offsetYears;
  const [open, setOpen] = useState(false);
  const [kg, setKg] = useState('');
  const [bf, setBf] = useState('');
  const kgOk = Number(kg) >= 30 && Number(kg) <= 300;
  const trendEmoji = bc.kgPerWeek == null ? '➡️' : bc.kgPerWeek < -0.05 ? '📉' : bc.kgPerWeek > 0.05 ? '📈' : '➡️';

  const save = async () => {
    await onAddWeight(Number(kg), bf ? Number(bf) : undefined);
    setKg('');
    setBf('');
    setOpen(false);
  };

  return (
    <View>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: 12, marginTop: 4 }}>Body 💪</Text>

      <Card title="Weight and composition" emoji="⚖️" accent={colors.sky}>
        {bc.hasData && bc.latest ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
              <Text style={{ color: colors.text, fontSize: 44, fontWeight: '900' }}>{bc.latest.weightKg}</Text>
              <Text style={{ color: colors.sub, fontSize: 16, paddingBottom: 8 }}>kg</Text>
              <View style={{ paddingBottom: 8 }}>
                <Pill text={`${trendEmoji} ${bc.kgPerWeek == null ? 'need more weigh-ins' : `${bc.kgPerWeek > 0 ? '+' : ''}${bc.kgPerWeek} kg / week`}`} color={colors.sky} />
              </View>
            </View>
            <Spark values={bc.series.map((s) => s.kg)} color={colors.sky} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Stat label="7-day average" value={bc.avg7Kg ?? '--'} unit="kg" />
              {bc.latest.bmi ? <Stat label="BMI" value={bc.latest.bmi} /> : null}
            </View>
            {bc.latest.bodyFatPct !== undefined ? (
              <View style={{ marginTop: 10 }}>
                <Row left="🧈 Body fat" right={`${bc.latest.bodyFatPct}%${bc.bodyFatChange != null ? `  (${bc.bodyFatChange > 0 ? '+' : ''}${bc.bodyFatChange} pts / 30d)` : ''}`} />
                {bc.latest.fatKg ? <Row left="Fat mass" right={`${bc.latest.fatKg} kg`} /> : null}
                {bc.latest.leanKg ? <Row left="🥩 Lean mass" right={`${bc.latest.leanKg} kg${bc.leanChangeKg != null ? `  (${bc.leanChangeKg > 0 ? '+' : ''}${bc.leanChangeKg} kg / 30d)` : ''}`} /> : null}
                {bc.latest.waterPct ? <Row left="💧 Body water" right={`${bc.latest.waterPct}%`} /> : null}
                {bc.latest.boneKg ? <Row left="🦴 Bone mass" right={`${bc.latest.boneKg} kg`} /> : null}
              </View>
            ) : null}
            <Note>Daily weight bounces 1-2 kg with water and food. Watch the 7-day average and the weekly trend, not a single morning.</Note>
          </>
        ) : (
          <Text style={{ color: colors.sub, lineHeight: 21 }}>No weigh-ins yet ⚖️. Turn on sharing to Apple Health / Health Connect in your scale's app (Eufy, Withings, Renpho and others all do this), or add one below.</Text>
        )}

        {open ? (
          <View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Field flex={1} label="Weight (kg)" value={kg} onChangeText={setKg} placeholder="78.4" />
              <Field flex={1} label="Body fat % (optional)" value={bf} onChangeText={setBf} placeholder="17.5" />
            </View>
            <BigButton label="Save weigh-in" emoji="✅" onPress={save} disabled={!kgOk} />
          </View>
        ) : (
          <BigButton label="Add a weigh-in" emoji="➕" color={colors.sky} onPress={() => setOpen(true)} />
        )}
      </Card>

      <Card title="Biological age (estimate)" emoji="🧬" delay={60}>
        {bioAge.bioAge == null ? (
          <Text style={{ color: colors.sub, lineHeight: 21 }}>Needs a VO2max reading or a few days of resting heart rate. Missing: {bioAge.missing.join(', ') || 'data'}.</Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
              <Text style={{ color: colors.text, fontSize: 52, fontWeight: '900' }}>{bioAge.bioAge}</Text>
              <View style={{ paddingBottom: 12, gap: 6 }}>
                <Pill text={`${off! <= 0 ? Math.abs(off!) + ' yrs younger 🎉' : off + ' yrs older'} than ${profile.age}`} color={off! <= 0 ? colors.mint : colors.sun} />
                <Text style={{ color: colors.sub, fontSize: 12 }}>confidence: {bioAge.confidence}</Text>
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              {bioAge.factors.map((f) => (
                <Row key={f.name} left={`${f.name}: ${f.detail}`} right={`${f.years > 0 ? '+' : ''}${f.years} y`} rightColor={f.years > 0.5 ? colors.coral : f.years < -0.5 ? colors.mint : colors.sub} />
              ))}
            </View>
            <Note>A friendly heuristic from fitness, resting HR, HRV, sleep, steps and body make-up. Use it to watch your own direction, not as a medical measurement.</Note>
          </>
        )}
      </Card>

      <Card title="Energy" emoji="🔋" delay={100}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Stat label="Resting (BMR)" value={m.bmr} unit="kcal" sub={m.bmrMethod === 'katch-mcardle' ? 'from lean mass' : 'from height/weight'} />
          <Stat label="Active today" value={m.activeKcal} unit="kcal" sub={m.activeSource === 'estimated' ? 'estimated' : 'from tracker'} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
          <Stat label="Burned so far" value={m.tdee} unit="kcal" color={colors.lime} />
          {m.avgTdee7d ? <Stat label="7-day average" value={m.avgTdee7d} unit="kcal" /> : null}
        </View>
      </Card>

      <Card title="Metabolic age" emoji="🔥" delay={140}>
        {m.metabolicAge ? <Row left="Metabolic age" right={`${m.metabolicAge}`} rightColor={m.metabolicAge <= profile.age ? colors.mint : colors.sun} /> : <Row left="Metabolic age" right="Add body fat % to unlock" />}
        {m.leanMassKg ? <Row left="Lean mass used" right={`${m.leanMassKg} kg`} /> : null}
        <Note>A wrist band cannot measure fat or muscle. These come from your scale via Apple Health / Health Connect, or what you type in.</Note>
      </Card>

      <Card title="Heart-rate zones today" emoji="🎢" delay={180}>
        <Row left={`🍃 Fat-burn ${m.fatBurnZone.low}-${m.fatBurnZone.high} bpm`} right={`${m.zoneMinutes.fatBurn} min`} />
        <Row left={`🏃 Cardio ${m.cardioZone.low}-${m.cardioZone.high} bpm`} right={`${m.zoneMinutes.cardio} min`} />
        <Row left="🚀 Peak (85%+ max HR)" right={`${m.zoneMinutes.peak} min`} />
      </Card>

      <Card title={`Metabolic fitness  ${m.fitnessScore}/100`} emoji="🏅" delay={220}>
        {m.fitnessParts.map((p) => (
          <Row key={p.name} left={p.name} right={`${p.score}`} />
        ))}
        <Note>An average of resting heart rate, daily movement, cardio fitness and body make-up. Higher is better.</Note>
      </Card>
    </View>
  );
}
