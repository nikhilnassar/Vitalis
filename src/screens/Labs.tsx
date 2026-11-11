import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Info } from '../components/Explain';
import { BigButton, Bounce, Card, Field, Note, Pill } from '../components/ui';
import { LabDef, LabResult, LabSummary, labDefs, labValid } from '../metrics';
import { colors } from '../theme';
import type { UserProfile } from '../types';

export function Labs({ summaries, sex, onAdd, onDelete }: { summaries: LabSummary[]; sex: UserProfile['sex']; onAdd: (key: string, value: number) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const defs = labDefs(sex);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<string>(defs[0].key);
  const [val, setVal] = useState('');
  const def: LabDef = defs.find((d) => d.key === key)!;
  const n = Number(val);
  const save = async () => {
    await onAdd(key, n);
    setVal('');
    setOpen(false);
  };
  const range = (d: LabDef) => (d.low !== undefined && d.high !== undefined ? `${d.low}-${d.high}` : d.high !== undefined ? `under ${d.high + (d.step ? 0.1 : 1)}` : `above ${d.low! - (d.step ? 0.1 : 1)}`);

  return (
    <Card title="Blood tests" emoji="🩸" accent={colors.coral} delay={40}>
      <View style={{ position: 'absolute', right: 14, top: 12 }}>
        <Info topic="labs" />
      </View>
      {summaries.length === 0 ? <Text style={{ color: colors.sub, lineHeight: 21 }}>Type in results from your lab reports to follow cholesterol, HbA1c, vitamin D and more over time 📈</Text> : null}
      {summaries.map((s) => {
        const col = s.status === 'in-range' ? colors.mint : colors.sun;
        return (
          <View key={s.def.key} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{s.def.emoji} {s.def.label}</Text>
                <Text style={{ color: colors.sub, fontSize: 12, marginTop: 2 }}>
                  {new Date(s.latest.t).toLocaleDateString()} · typical {range(s.def)} {s.def.unit}
                  {s.change != null ? `  (${s.change > 0 ? '+' : ''}${s.change} since last)` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>{s.latest.value} <Text style={{ fontSize: 11, color: colors.sub }}>{s.def.unit}</Text></Text>
                <Pill text={s.status === 'in-range' ? 'in range' : s.status === 'high' ? 'above range' : 'below range'} color={col} />
              </View>
            </View>
            {s.status !== 'in-range' ? <Text style={{ color: colors.sub, fontSize: 12, lineHeight: 17, marginTop: 6 }}>{s.def.note} Worth mentioning to your clinician.</Text> : null}
            <Bounce onPress={() => onDelete(s.latest.id)} style={{ alignSelf: 'flex-start', marginTop: 6 }}>
              <Text style={{ color: colors.coral, fontSize: 12, fontWeight: '700' }}>Delete latest entry</Text>
            </Bounce>
          </View>
        );
      })}
      {open ? (
        <View style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {defs.map((d) => (
              <Bounce key={d.key} onPress={() => setKey(d.key)} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18, backgroundColor: key === d.key ? colors.coral : colors.cardAlt, borderWidth: 1.5, borderColor: key === d.key ? colors.coral : colors.border }}>
                <Text style={{ color: key === d.key ? colors.ink : colors.text, fontWeight: '700', fontSize: 12 }}>{d.emoji} {d.label}</Text>
              </Bounce>
            ))}
          </View>
          <Field label={`${def.label} (${def.unit})`} value={val} onChangeText={setVal} placeholder="e.g. 95" />
          <BigButton label="Save result" emoji="✅" onPress={save} disabled={!labValid(n)} />
        </View>
      ) : (
        <BigButton label="Add a result" emoji="➕" color={colors.coral} onPress={() => setOpen(true)} />
      )}
      <Note>Units are US mg/dL, ng/mL and %. Ranges are generic adult ranges; your lab's own range and your clinician's advice come first. Vitalis does not diagnose.</Note>
    </Card>
  );
}
