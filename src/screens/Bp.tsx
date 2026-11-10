import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Banner, BigButton, Bounce, Card, Field, Lines, Note, Pill, ProgressBar, Row, Stat } from '../components/ui';
import { Analysis, BpCategory, categoryLabel } from '../metrics';
import { colors } from '../theme';
import { MIN_PAIRS } from '../metrics/bpmodel';

const CAT_COLOR: Record<BpCategory, string> = { low: colors.sky, normal: colors.mint, elevated: colors.sun, high1: colors.coral, high2: colors.pink, urgent: colors.pink };
const CAT_EMOJI: Record<BpCategory, string> = { low: '💙', normal: '💚', elevated: '💛', high1: '🧡', high2: '❤️', urgent: '🚨' };

const when = (t: number) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export function Bp({ a, onAdd, onDelete }: { a: Analysis; onAdd: (sys: number, dia: number, pulse?: number) => Promise<void>; onDelete: (t: number) => Promise<void> }) {
  const { summary: s, prompt, model } = a.bp;
  const [open, setOpen] = useState(false);
  const [sys, setSys] = useState('');
  const [dia, setDia] = useState('');
  const [pulse, setPulse] = useState('');
  const ok = Number(sys) >= 70 && Number(sys) <= 260 && Number(dia) >= 40 && Number(dia) <= 160 && Number(sys) > Number(dia);

  const save = async () => {
    await onAdd(Math.round(Number(sys)), Math.round(Number(dia)), pulse ? Math.round(Number(pulse)) : undefined);
    setSys('');
    setDia('');
    setPulse('');
    setOpen(false);
  };

  return (
    <View>
      <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: 12, marginTop: 4 }}>Blood pressure 🩺</Text>

      {prompt.show ? <Banner emoji="👉" tone={prompt.tone === 'warn' ? 'warn' : 'info'} title={prompt.title} text={prompt.reason} /> : null}

      {s.last ? (
        <Card accent={CAT_COLOR[s.last.category]}>
          <Text style={{ color: colors.sub, fontSize: 12, fontWeight: '700' }}>LAST READING · {when(s.last.t)}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
            <Text style={{ fontSize: 40 }}>{CAT_EMOJI[s.last.category]}</Text>
            <Text style={{ color: colors.text, fontSize: 46, fontWeight: '900' }}>
              {s.last.sys}/{s.last.dia}
            </Text>
            <Text style={{ color: colors.sub, paddingTop: 16 }}>mmHg</Text>
          </View>
          <View style={{ marginTop: 8 }}>
            <Pill text={categoryLabel[s.last.category]} color={CAT_COLOR[s.last.category]} />
          </View>
          <Note>One reading can be off for lots of reasons (stress, caffeine, a talking session). Averages tell you more.</Note>
        </Card>
      ) : null}

      <Card title="Log a reading" emoji="✍️" delay={60}>
        {open ? (
          <View>
            <Text style={{ color: colors.sub, fontSize: 13, lineHeight: 19 }}>🪑 Sit for 5 minutes, back supported, feet flat, arm resting at heart level, no talking.</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Field flex={1} label="Systolic (top)" value={sys} onChangeText={setSys} placeholder="120" keyboardType="number-pad" />
              <Field flex={1} label="Diastolic (bottom)" value={dia} onChangeText={setDia} placeholder="80" keyboardType="number-pad" />
              <Field flex={1} label="Pulse" value={pulse} onChangeText={setPulse} placeholder="64" keyboardType="number-pad" />
            </View>
            <BigButton label="Save reading" emoji="✅" onPress={save} disabled={!ok} />
          </View>
        ) : (
          <>
            <Text style={{ color: colors.sub, lineHeight: 20 }}>Cuff readings that sync to Apple Health / Health Connect show up here automatically. No synced cuff? Type it in.</Text>
            <BigButton label="Add a reading" emoji="➕" color={colors.pink} onPress={() => setOpen(true)} />
          </>
        )}
      </Card>

      {s.avg30 ? (
        <Card title="Your averages" emoji="📊" delay={100}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {s.avg7 ? <Stat label="Last 7 days" value={`${s.avg7.sys}/${s.avg7.dia}`} sub={`${s.avg7.n} readings`} /> : null}
            <Stat label="Last 30 days" value={`${s.avg30.sys}/${s.avg30.dia}`} sub={`${s.avg30.n} readings`} color={s.category30 ? CAT_COLOR[s.category30] : undefined} />
          </View>
          {s.morning || s.evening ? (
            <View style={{ marginTop: 10 }}>
              {s.morning ? <Row left="🌅 Mornings" right={`${s.morning.sys}/${s.morning.dia}  (${s.morning.n})`} /> : null}
              {s.evening ? <Row left="🌆 Evenings" right={`${s.evening.sys}/${s.evening.dia}  (${s.evening.n})`} /> : null}
            </View>
          ) : null}
          {s.slopePerWeek ? (
            <Row left="📐 Trend" right={`${s.slopePerWeek.sys > 0 ? '+' : ''}${s.slopePerWeek.sys} / ${s.slopePerWeek.dia > 0 ? '+' : ''}${s.slopePerWeek.dia} per week`} />
          ) : null}
        </Card>
      ) : null}

      {s.series.length >= 3 ? (
        <Card title="Daily averages, 60 days" emoji="📈" delay={140}>
          <Lines lines={[{ values: s.series.map((x) => x.sys), color: colors.pink }, { values: s.series.map((x) => x.dia), color: colors.sky }]} height={110} />
          <Text style={{ color: colors.sub, fontSize: 12, marginTop: 6 }}>
            <Text style={{ color: colors.pink }}>● </Text>top number   <Text style={{ color: colors.sky }}>● </Text>bottom number
          </Text>
        </Card>
      ) : null}

      <Card title="Your personal estimate" emoji="🧪" delay={180}>
        {model.sys.status === 'insufficient' ? (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>Unlocking after {MIN_PAIRS} days with a cuff reading</Text>
            <View style={{ marginVertical: 12 }}>
              <ProgressBar value={Math.min(model.sys.n, MIN_PAIRS)} max={MIN_PAIRS} color={colors.pink} />
            </View>
            <Text style={{ color: colors.sub, lineHeight: 20 }}>
              {model.sys.n} of {MIN_PAIRS} so far. Vitalis learns how YOUR overnight HRV, resting heart rate and sleep relate to YOUR cuff readings, then tests itself on readings it hasn't seen. It only shows an estimate if it truly beats guessing your average.
            </Text>
          </>
        ) : model.sys.status === 'unreliable' ? (
          <>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>We tested it. It isn't useful for you yet 🙅</Text>
            <Text style={{ color: colors.sub, lineHeight: 20, marginTop: 8 }}>
              {model.sys.reason}.{' '}
              {model.sys.modelMae !== undefined ? `On readings it hadn't seen, the model was off by ${model.sys.modelMae} mmHg on average; just using your average was off by ${model.sys.baselineMae}.` : ''}
            </Text>
            <Note>That is a normal, honest result. The estimate stays hidden until it clearly beats your average, and gets re-tested as you add readings.</Note>
          </>
        ) : (
          <>
            <Pill text="Estimate, not a reading" color={colors.pink} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 10 }}>
              <Text style={{ color: colors.text, fontSize: 44, fontWeight: '900' }}>
                {model.sys.estimate ?? '--'}
                {model.dia.status === 'reliable' && model.dia.estimate ? `/${model.dia.estimate}` : ''}
              </Text>
              <Text style={{ color: colors.sub, paddingBottom: 8 }}>mmHg</Text>
            </View>
            {model.sys.estimate !== undefined ? (
              <Text style={{ color: colors.sub, marginTop: 2 }}>
                likely between {model.sys.low} and {model.sys.high} (top number)
              </Text>
            ) : (
              <Text style={{ color: colors.sub }}>{model.sys.reason}</Text>
            )}
            <View style={{ marginTop: 10 }}>
              {model.sys.drivers?.map((d) => (
                <Row key={d.name} left={d.name} right={`${d.effect > 0 ? '+' : ''}${d.effect} mmHg when higher than usual`} />
              ))}
            </View>
            <Note>
              Passed testing: off by {model.sys.modelMae} mmHg on unseen readings vs {model.sys.baselineMae} for your plain average. Still an estimate. Confirm with a cuff before acting on it.
            </Note>
          </>
        )}
      </Card>

      {s.recent.length ? (
        <Card title="Recent readings" emoji="🗒️" delay={220}>
          {s.recent.map((r) => (
            <View key={r.t} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 10 }}>
              <Text style={{ fontSize: 18 }}>{CAT_EMOJI[r.sys >= 180 || r.dia >= 120 ? 'urgent' : r.sys >= 140 || r.dia >= 90 ? 'high2' : r.sys >= 130 || r.dia >= 80 ? 'high1' : r.sys >= 120 ? 'elevated' : r.sys < 90 || r.dia < 60 ? 'low' : 'normal']}</Text>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
                {r.sys}/{r.dia}
              </Text>
              <Text style={{ color: colors.sub, flex: 1, fontSize: 12 }}>
                {when(r.t)}
                {r.source === 'manual' ? ' · typed in' : ''}
              </Text>
              {r.source === 'manual' ? (
                <Bounce onPress={() => onDelete(r.t)} style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: colors.coral, fontWeight: '800' }}>✕</Text>
                </Bounce>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Note>
        Vitalis is not a medical device and cannot diagnose or treat anything. Fitness bands cannot measure blood pressure from the wrist reliably. Use a validated upper-arm cuff, and talk to a doctor about readings that worry you.
      </Note>
    </View>
  );
}
