import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, ScrollViewInstance, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Banner, BigButton } from './src/components/ui';
import { URGENT_TEXT } from './src/metrics';
import { TABS, Tab } from './src/nav';
import { Body } from './src/screens/Body';
import { Bp } from './src/screens/Bp';
import { SleepScreen } from './src/screens/Sleep';
import { Connect, ProfileForm } from './src/screens/Setup';
import { Today } from './src/screens/Today';
import { Trends } from './src/screens/Trends';
import { colors } from './src/theme';
import { useVitalis } from './src/useVitalis';

export default function App() {
  const { state, load, saveProfile, addBp, addWeight, deleteBp, disconnect, refresh } = useVitalis();
  const [tab, setTab] = useState<Tab>('Today');
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // Every tab starts at the top instead of inheriting the previous tab's scroll position.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [tab]);

  let content: React.ReactNode;
  if (state.phase === 'booting' || state.phase === 'loading') {
    content = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 56 }}>{state.phase === 'loading' ? '🫀' : '✨'}</Text>
        <ActivityIndicator color={colors.lime} size="large" style={{ marginTop: 14 }} />
        <Text style={{ color: colors.sub, marginTop: 14 }}>{state.phase === 'loading' ? 'Reading your health data...' : ''}</Text>
      </View>
    );
  } else if (state.phase === 'connect' || state.phase === 'error') {
    content = <Connect onPlatform={() => load('platform')} onDemo={() => load('demo')} error={state.error} />;
  } else if (state.phase === 'needs-profile') {
    content = (
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false} overScrollMode="never" contentContainerStyle={{ padding: 16 }}>
        <ProfileForm initial={state.platformProfile ?? {}} onSave={saveProfile} />
      </ScrollView>
    );
  } else if (state.analysis && state.profile) {
    const a = state.analysis;
    content = (
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          refreshControl={
            <RefreshControl
              tintColor={colors.lime}
              colors={[colors.lime]}
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await refresh();
                setRefreshing(false);
              }}
            />
          }
        >
          {a.bp.summary.urgentRecent ? (
            <Banner
              emoji="🚨"
              tone="danger"
              title={`Very high reading: ${a.bp.summary.urgentRecent.sys}/${a.bp.summary.urgentRecent.dia}`}
              text={URGENT_TEXT}
              onPress={() => setTab('BP')}
            />
          ) : null}
          {tab === 'Today' && <Today a={a} go={setTab} />}
          {tab === 'Sleep' && <SleepScreen a={a} />}
          {tab === 'Trends' && <Trends a={a} />}
          {tab === 'Body' && <Body a={a} profile={state.profile} onAddWeight={addWeight} />}
          {tab === 'BP' && <Bp a={a} onAdd={addBp} onDelete={deleteBp} />}
          {tab === 'You' && (
            <View>
              <ProfileForm title="Your profile" initial={state.profile} onSave={saveProfile} />
              <View style={{ paddingHorizontal: 8 }}>
                <Text style={{ color: colors.sub, marginTop: 20, fontSize: 13 }}>
                  Data source: {state.source === 'demo' ? '🎮 demo data' : '📱 phone health data'}
                </Text>
                <BigButton label="Change data source" emoji="🔁" color={colors.cardAlt} onPress={disconnect} />
              </View>
            </View>
          )}
        </ScrollView>
        <View style={{ flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1.5, borderColor: colors.border, paddingBottom: 4 }}>
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, paddingVertical: 10, alignItems: 'center' }}>
                <View style={{ backgroundColor: on ? colors.cardAlt : 'transparent', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <Text style={{ fontSize: on ? 24 : 20, opacity: on ? 1 : 0.6 }}>{t.emoji}</Text>
                </View>
                <Text style={{ color: on ? colors.lime : colors.sub, fontWeight: '800', fontSize: 10, marginTop: 2 }}>{t.key}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="light" />
        {content}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
