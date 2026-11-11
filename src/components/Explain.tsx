import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { EXPLAIN, ExplainKey } from '../explain';
import { colors, radius } from '../theme';
import { BigButton } from './ui';

/** Wrap anything so tapping it explains what it means. */
export function Explain({ topic, children }: { topic: ExplainKey; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const e = EXPLAIN[topic];
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Explain ${e.title}`} accessibilityHint="Opens a short explanation">
        {children}
      </Pressable>
      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(7,5,20,0.7)', justifyContent: 'center', padding: 24 }}>
          <Pressable style={{ backgroundColor: colors.card, borderRadius: radius.card, padding: 22, borderWidth: 2, borderColor: colors.border }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{e.title}</Text>
            <Text style={{ color: colors.sub, fontSize: 15, lineHeight: 23, marginTop: 10 }}>{e.body}</Text>
            <View style={{ marginTop: 8 }}>
              <BigButton label="Got it" onPress={() => setOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Small ⓘ next to a card title. */
export const Info = ({ topic }: { topic: ExplainKey }) => (
  <Explain topic={topic}>
    <Text style={{ color: colors.sky, fontSize: 16, fontWeight: '800', paddingHorizontal: 6 }}>ⓘ</Text>
  </Explain>
);
