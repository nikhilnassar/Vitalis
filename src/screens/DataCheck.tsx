import React from 'react';
import { Text, View } from 'react-native';
import { Card, Note, ProgressBar } from '../components/ui';
import { CoverageItem } from '../health/assemble';
import { colors } from '../theme';

const ago = (t?: number) => {
  if (!t) return '';
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

export function DataCheck({ items, errors, limited }: { items: CoverageItem[]; errors?: string[]; limited?: boolean }) {
  return (
    <Card title="Data check" emoji="🔎" accent={colors.sky}>
      <Text style={{ color: colors.sub, lineHeight: 20, marginBottom: 8 }}>What your tracker shared with this phone over the last 7 days.</Text>
      {items.map((it) => {
        const color = it.days >= 5 ? colors.mint : it.days > 0 ? colors.sun : colors.coral;
        return (
          <View key={it.key} style={{ marginTop: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{it.emoji} {it.label}</Text>
              <Text style={{ color, fontWeight: '800' }}>{it.days}/{it.window} days{it.latest ? ` · newest ${ago(it.latest)}` : ''}</Text>
            </View>
            <ProgressBar value={it.days} max={it.window} color={color} height={8} />
            {it.days < 3 ? <Text style={{ color: colors.sub, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{it.tip}</Text> : null}
          </View>
        );
      })}
      <Note>Vitalis reads from {'your phone\'s health store'}, which only updates when your tracker's own app syncs to it. If "newest" looks old, open your tracker's app (Google Health, Fitbit, Samsung Health...), let it sync, then pull down to refresh here.</Note>
      {limited ? <Note>Health Connect only allowed the last 30 days, so baselines are shorter than ideal. They will improve as days accumulate.</Note> : null}
      {errors && errors.length ? <Note>Some reads failed: {errors.slice(0, 4).join('; ')}</Note> : null}
    </Card>
  );
}
