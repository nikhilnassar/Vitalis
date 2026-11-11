import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { colors, radius } from '../theme';

/** Pulsing placeholder cards shown while the first read is under way, instead of a bare spinner. */
export function Skeleton() {
  const o = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(o, { toValue: 0.9, duration: 700, useNativeDriver: true }), Animated.timing(o, { toValue: 0.45, duration: 700, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [o]);
  const block = (h: number, w: string | number = '100%') => <Animated.View style={{ height: h, width: w as any, borderRadius: radius.card, backgroundColor: colors.card, opacity: o, marginBottom: 14 }} />;
  return (
    <View style={{ padding: 16 }} accessibilityLabel="Loading your health data">
      {block(34, '55%')}
      {block(120)}
      {block(150)}
      {block(90)}
      {block(90)}
    </View>
  );
}
