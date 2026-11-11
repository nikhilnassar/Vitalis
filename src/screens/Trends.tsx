import React from 'react';
import { Text, View } from 'react-native';
import { Bars, Card, Note, Pill, Spark } from '../components/ui';
import { MIN_LOGGED_DAYS } from '../metrics';
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
        <Spark values={last30.map((d) => d.recovery.components.hrv?.value)} color={colors.mint} empty="Your tracker isn't sharing overnight HRV. Recovery uses resting heart rate and sleep instead 💤" />
      </Card>
      <Card title="Resting heart rate (bpm)" emoji="🫀" delay={100}>
        <Spark values={last30.map((d) => d.recovery.components.rhr?.value)} color={colors.pink} />
      </Card>
      <Card title="Strain" emoji="⚡" delay={140}>
        <Bars values={last30.map((d) => (d.strain.hasData ? d.strain.strain : null))} max={21} colorFor={() => colors.sky} empty="No heart-rate, workout or step data to score effort yet 👟" />
      </Card>
      <Card title="Long-term biomarkers" emoji="🧬" delay={160}>
        <Text style={{ color: colors.sub, lineHeight: 20, marginBottom: 6 }}>The last 30 days against the 30 before. Slow shifts here matter more than any single day.</Text>
        {a.insights.trends.length === 0 ? <Text style={{ color: colors.sub }}>Needs a few weeks of data. Check back soon 🌱</Text> : null}
        {a.insights.trends.map((t) => {
          const col = t.verdict === 'better' ? colors.mint : t.verdict === 'worse' ? colors.coral : colors.sub;
          return (
            <View key={t.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{t.emoji} {t.label}</Text>
                <Text style={{ color: colors.sub, fontSize: 12, marginTop: 2 }}>{t.recent != null ? `${t.recent} ${t.unit} avg` : ''}{t.delta != null ? `  (${t.delta > 0 ? '+' : ''}${t.delta} vs before)` : '  (not enough history to compare)'}</Text>
              </View>
              {t.verdict !== 'unknown' ? <Pill text={t.verdict === 'better' ? '▲ better' : t.verdict === 'worse' ? '▼ worse' : '➡️ steady'} color={col} /> : null}
            </View>
          );
        })}
      </Card>
      <Card title="How your habits affect you" emoji="🔬" delay={180}>
        {a.insights.habitsReady ? (
          a.insights.habits.length ? (
            a.insights.habits.map((h) => (
              <Text key={h.habit + h.marker} style={{ color: colors.text, lineHeight: 21, marginTop: 8 }}>{h.good ? '✅' : '⚠️'} {h.sentence}</Text>
            ))
          ) : (
            <Text style={{ color: colors.sub, lineHeight: 21 }}>No clear pattern yet in {a.insights.habitDaysUsed} days of data. That's normal: the signal has to stand out from everyday noise.</Text>
          )
        ) : (
          <Text style={{ color: colors.sub, lineHeight: 21 }}>Needs about {21} days with both habits and biomarkers. You have {a.insights.habitDaysUsed} so far 🌱</Text>
        )}
        <Note>These are patterns in your own data, not proof of cause. Sleep, stress, illness and alcohol all play in. Treat them as hints to experiment with.</Note>
      </Card>
      <Card title="Your journal vs your body" emoji="📝" delay={190}>
        {a.journal.ready ? (
          a.journal.effects.length ? (
            a.journal.effects.map((e) => (
              <Text key={e.id + e.marker} style={{ color: colors.text, lineHeight: 21, marginTop: 8 }}>{e.good ? '✅' : '⚠️'} {e.emoji} {e.sentence}</Text>
            ))
          ) : (
            <Text style={{ color: colors.sub, lineHeight: 21 }}>No habit stands out yet in {a.journal.loggedDays} logged days. Keep logging; clear effects need enough days both with and without each habit.</Text>
          )
        ) : (
          <Text style={{ color: colors.sub, lineHeight: 21 }}>{a.journal.loggedDays} of {MIN_LOGGED_DAYS} check-in days logged. Log how you feel and what you did on the Today tab 📝</Text>
        )}
        <Text style={{ color: colors.sub, lineHeight: 20, marginTop: 12 }}>🎯 {a.journal.feel.text}</Text>
        <Note>Patterns in your own data, not proof of cause. A habit and a bad night can share a hidden cause such as a rough week.</Note>
      </Card>
      <Card title="This week vs the 2 weeks before" emoji="🔁" delay={220}>
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
