import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, ViewStyle, useWindowDimensions, KeyboardTypeOptions } from 'react-native';
import Svg, { Circle, Polyline, Rect, Circle as SvgDot } from 'react-native-svg';
import { colors, radius, space } from '../theme';

const AnimatedCircle: any = Animated.createAnimatedComponent(Circle as any);

/** Chart width that fits the screen: window minus page padding (16*2) and card padding (16*2). */
export function useChartWidth() {
  const { width } = useWindowDimensions();
  return Math.min(width - 64, 520);
}

/** Fades, slides and pops its children in. Screens remount on tab change, so the pop replays. */
export function Pop({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable that squishes when you touch it. */
export function Bounce({ onPress, children, style, disabled }: { onPress?: () => void; children: React.ReactNode; style?: ViewStyle | ViewStyle[]; disabled?: boolean }) {
  const s = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => Animated.spring(s, { toValue: 0.94, useNativeDriver: true, speed: 40 }).start()}
      onPressOut={() => Animated.spring(s, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }).start()}
    >
      <Animated.View style={[style as any, { transform: [{ scale: s }], opacity: disabled ? 0.45 : 1 }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function BigButton({ label, onPress, color = colors.lime, disabled, emoji }: { label: string; onPress?: () => void; color?: string; disabled?: boolean; emoji?: string }) {
  return (
    <Bounce onPress={onPress} disabled={disabled} style={{ backgroundColor: color, borderRadius: radius.button, paddingVertical: 15, alignItems: 'center', marginTop: space.md }}>
      <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 16 }}>
        {emoji ? `${emoji}  ` : ''}
        {label}
      </Text>
    </Bounce>
  );
}

export function Chip({ label, selected, onPress, color = colors.lime }: { label: string; selected: boolean; onPress: () => void; color?: string }) {
  return (
    <Bounce onPress={onPress} style={{ flex: 1, paddingVertical: 13, borderRadius: radius.button, alignItems: 'center', backgroundColor: selected ? color : colors.cardAlt, borderWidth: 1.5, borderColor: selected ? color : colors.border }}>
      <Text style={{ color: selected ? colors.ink : colors.text, fontWeight: '700' }}>{label}</Text>
    </Bounce>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'decimal-pad',
  flex,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  flex?: number;
}) {
  return (
    <View style={{ flex, marginTop: space.md }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.field}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.sub}
        selectionColor={colors.lime}
      />
    </View>
  );
}

export function Card({
  title,
  emoji,
  accent,
  children,
  style,
  delay = 0,
}: {
  title?: string;
  emoji?: string;
  accent?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
}) {
  return (
    <Pop delay={delay}>
      <View style={[s.card, accent ? { borderColor: accent } : null, style]}>
        {accent ? <View style={[s.accentBar, { backgroundColor: accent }]} /> : null}
        {title ? (
          <View style={s.cardHead}>
            {emoji ? <Text style={s.cardEmoji}>{emoji}</Text> : null}
            <Text style={[s.cardTitle, accent ? { color: accent } : null]}>{title}</Text>
          </View>
        ) : null}
        {children}
      </View>
    </Pop>
  );
}

export function Banner({ emoji, title, text, tone = 'info', onPress }: { emoji: string; title: string; text: string; tone?: 'info' | 'warn' | 'danger'; onPress?: () => void }) {
  const c = tone === 'danger' ? colors.coral : tone === 'warn' ? colors.sun : colors.sky;
  const body = (
    <View style={{ backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 2, borderColor: c, padding: space.lg, marginBottom: space.md, flexDirection: 'row', gap: 12 }}>
      <Text style={{ fontSize: 30 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c, fontWeight: '800', fontSize: 15 }}>{title}</Text>
        <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{text}</Text>
      </View>
    </View>
  );
  return (
    <Pop>
      {onPress ? (
        <Bounce onPress={onPress}>{body}</Bounce>
      ) : (
        body
      )}
    </Pop>
  );
}

export function Ring({
  value,
  max,
  color,
  label,
  caption,
  emoji,
  size = 104,
}: {
  value: number | null | undefined;
  max: number;
  color: string;
  label: string;
  caption: string;
  emoji?: string;
  size?: number;
}) {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.min(1, Math.max(0, value / max));
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, { toValue: pct, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [p, pct]);
  const offset = p.interpolate({ inputRange: [0, 1], outputRange: [c, 0] });
  return (
    <View style={{ alignItems: 'center', width: size }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.cardAlt} strokeWidth={stroke} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          {emoji ? <Text style={{ fontSize: size * 0.2 }}>{emoji}</Text> : null}
          <Text style={{ color: colors.text, fontSize: size * 0.24, fontWeight: '800' }}>{value == null ? '--' : label}</Text>
        </View>
      </View>
      <Text style={s.caption}>{caption}</Text>
    </View>
  );
}

export function Stat({ label, value, unit, sub, color }: { label: string; value: string | number; unit?: string; sub?: string; color?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 96 }}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, color ? { color } : null]}>
        {value}
        {unit ? <Text style={s.statUnit}> {unit}</Text> : null}
      </Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

export function Row({ left, right, rightColor }: { left: string; right: string; rightColor?: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLeft}>{left}</Text>
      <Text style={[s.rowRight, rightColor ? { color: rightColor } : null]}>{right}</Text>
    </View>
  );
}

export function ProgressBar({ value, max, color = colors.lime, height = 14 }: { value: number; max: number; color?: string; height?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const pct = Math.min(1, Math.max(0, value / max));
  useEffect(() => {
    Animated.timing(v, { toValue: pct, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [v, pct]);
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: color, width: v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

export function Bars({
  values,
  colorFor,
  max,
  height = 90,
}: {
  values: (number | null | undefined)[];
  colorFor: (v: number) => string;
  max: number;
  height?: number;
}) {
  const width = useChartWidth();
  const n = Math.max(values.length, 1);
  const gap = 3;
  const bw = Math.max(3, (width - gap * (n - 1)) / n);
  return (
    <Svg width={width} height={height}>
      {values.map((v, i) =>
        v == null ? null : (
          <Rect key={i} x={i * (bw + gap)} y={height - Math.max(3, (v / max) * height)} width={bw} height={Math.max(3, (v / max) * height)} rx={Math.min(5, bw / 2)} fill={colorFor(v)} />
        ),
      )}
    </Svg>
  );
}

export interface Line {
  values: (number | null | undefined)[];
  color: string;
}

/** One or more lines on a shared scale, with a dot on the latest point. */
export function Lines({ lines, height = 80 }: { lines: Line[]; height?: number }) {
  const width = useChartWidth();
  const all = lines.flatMap((l) => l.values).filter((v): v is number => v != null);
  if (all.length < 2) return <View style={{ height }} />;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const len = Math.max(...lines.map((l) => l.values.length));
  const step = width / Math.max(len - 1, 1);
  const y = (v: number) => height - 8 - ((v - lo) / span) * (height - 16);
  return (
    <Svg width={width} height={height}>
      {lines.map((l, li) => {
        const pts = l.values.map((v, i) => (v == null ? null : { x: i * step, y: y(v) })).filter((p): p is { x: number; y: number } => p !== null);
        if (pts.length < 2) return null;
        const last = pts[pts.length - 1];
        return (
          <React.Fragment key={li}>
            <Polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={l.color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            <SvgDot cx={Math.min(last.x, width - 5)} cy={last.y} r={5} fill={l.color} />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export const Spark = ({ values, color, height = 64 }: { values: (number | null | undefined)[]; color: string; height?: number }) => <Lines lines={[{ values, color }]} height={height} />;

export function Pill({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: color, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}>
      <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '800' }}>{text}</Text>
    </View>
  );
}

export const Note = ({ children }: { children: React.ReactNode }) => <Text style={s.note}>{children}</Text>;

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, marginBottom: space.md, borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden' },
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 5 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.md },
  cardEmoji: { fontSize: 20 },
  cardTitle: { color: colors.sub, fontSize: 13, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  caption: { color: colors.sub, fontSize: 11, marginTop: space.sm, fontWeight: '800', letterSpacing: 0.8 },
  statLabel: { color: colors.sub, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  statUnit: { color: colors.sub, fontSize: 13, fontWeight: '600' },
  statSub: { color: colors.sub, fontSize: 11, marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
  rowLeft: { color: colors.text, fontSize: 14, flex: 1 },
  rowRight: { color: colors.sub, fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  note: { color: colors.sub, fontSize: 12, lineHeight: 17, marginTop: space.sm },
  fieldLabel: { color: colors.sub, fontSize: 12, fontWeight: '600' },
  field: { backgroundColor: colors.cardAlt, color: colors.text, borderRadius: 14, padding: 14, fontSize: 17, borderWidth: 1.5, borderColor: colors.border, marginTop: 6, fontWeight: '600' },
});
