import React from 'react';
import { Text, View } from 'react-native';
import { Bars, Card, Note, Spark } from '../components/ui';
import { Analysis, bandFor } from '../metrics';
import { bandColor, colors } from '../theme';

export function Trends({ a }: { a: Analysis }) {
  const last30 = a.days.slice(-30);
  return (
    <View>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: 12, marginTop: 4 }}>Trends 📈</Text>
      <Card title="Recovery, 30 days" emoji="💚">
        <Bars values={last30.map((d) => d.recovery.score)} max={100} colorFor={(v) => bandColor(bandFor(v))} />
      </Card>
      <Card title="HRV (ms)" emoji="💓" delay={60}>
        <Spark values={last30.map((d) => d.recovery.components.hrv?.value)} color={colors.mint} />
      </Card>
      <Card title="Resting heart rate (bpm)" emoji="🫀" delay={100}>
        <Spark values={last30.map((d) => d.recovery.components.rhr?.value)} color={colors.pink} />
      </Card>
      <Card title="Strain" emoji="⚡" delay={140}>
        <Bars values={last30.map((d) => d.strain.strain)} max={21} colorFor={() => colors.sky} />
      </Card>
      <Card title="This week vs the 2 weeks before" emoji="🔁" delay={180}>
        {a.coaching.trends.map((t) => {
          const delta = t.last7 != null && t.prior != null ? Math.round((t.last7 - t.prior) * 10) / 10 : null;
          const good = delta == null ? null : t.betterWhen === 'higher' ? delta >= 0 : delta <= 0;
          return (
            <View key={t.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 }}>
              <Text style={{ color: colors.text }}>{t.label}</Text>
              <Text style={{ color: colors.sub, fontWeight: '700' }}>
                {t.last7 ?? '--'}
                {t.unit}
                {delta != null ? <Text style={{ color: good ? colors.mint : colors.coral }}>{`   ${good ? '▲' : '▼'} ${delta > 0 ? '+' : ''}${delta}`}</Text> : null}
              </Text>
            </View>
          );
        })}
        <Note>Rising strain with falling recovery is a sign to ease off.</Note>
      </Card>
    </View>
  );
}
