import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, ScrollViewInstance, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Banner, BigButton } from './src/components/ui';
import { URGENT_TEXT } from './src/metrics';
import { TABS, Tab } from './src/nav';
import { Body } from './src/screens/Body';
import { Bp } from './src/screens/Bp';
import { SleepScreen } from './src/screens/Sleep';
import { Connect, ProfileForm } from './src/screens/Setup';
import { DataCheck } from './src/screens/DataCheck';
import { Today } from './src/screens/Today';
import { Trends } from './src/screens/Trends';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { Skeleton } from './src/components/Skeleton';
import { initErrorReporting } from './src/errors';
import { setupNotifications, syncNotifications } from './src/notify';
import { setBackgroundEnabled } from './src/background';
import { Onboarding } from './src/screens/Onboarding';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { loadSettings } from './src/settings';
import { KEYS } from './src/storage';
import { colors } from './src/theme';
import { todayKey, useVitalis } from './src/useVitalis';

export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
  const { state, load, saveProfile, addBp, addWeight, deleteBp, toggleHabit, setFeel, addLab, deleteLab, deleteAll, disconnect, refresh } = useVitalis();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEYS.onboarded).then((v) => setOnboarded(v === '1')).catch(() => setOnboarded(true));
    setupNotifications();
    loadSettings().then((s) => initErrorReporting(s.crashReports));
  }, []);

  // Whenever fresh results arrive, apply the person's notification choices (best effort).
  useEffect(() => {
    if (!state.analysis || state.stale || state.source !== 'platform') return;
    loadSettings().then(async (s) => {
      const any = s.morningSummary || s.bedtimeReminder || s.bpReminder;
      await setBackgroundEnabled(any);
      if (any) await syncNotifications(state.analysis!, s, { allowMorning: true });
    }).catch(() => {});
  }, [state.analysis, state.stale, state.source]);

  const finishOnboarding = () => {
    setOnboarded(true);
    AsyncStorage.setItem(KEYS.onboarded, '1').catch(() => {});
  };
  const [tab, setTab] = useState<Tab>('Today');
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  // Every tab starts at the top instead of inheriting the previous tab's scroll position.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [tab]);

  let content: React.ReactNode;
  if (state.phase === 'booting' || state.phase === 'loading') {
    content = state.phase === 'loading' ? (
      <View style={{ flex: 1 }}>
        <Skeleton />
        <Text style={{ color: colors.sub, textAlign: 'center' }}>Reading your health data...</Text>
      </View>
    ) : (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.lime} size="large" />
      </View>
    );
  } else if (onboarded === false && (state.phase === 'needs-profile' || state.phase === 'ready')) {
    content = <Onboarding onDone={finishOnboarding} />;
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
          {tab === 'Today' && <Today a={a} go={setTab} todayEntry={state.journal?.find((e) => e.date === todayKey())} onFeel={(v) => setFeel(todayKey(), v)} onHabit={(id) => toggleHabit(todayKey(), id)} updatedAt={state.updatedAt} stale={state.stale} />}
          {tab === 'Sleep' && <SleepScreen a={a} />}
          {tab === 'Trends' && <Trends a={a} />}
          {tab === 'Body' && <Body a={a} profile={state.profile} onAddWeight={addWeight} onAddLab={addLab} onDeleteLab={deleteLab} />}
          {tab === 'BP' && <Bp a={a} onAdd={addBp} onDelete={deleteBp} />}
          {tab === 'You' && (
            <View>
              {state.coverage ? <DataCheck items={state.coverage} errors={state.readErrors} limited={state.limitedHistory} /> : null}
              <ProfileForm title="Your profile" initial={state.profile} onSave={saveProfile} />
              <SettingsScreen onChanged={() => {}} onDeleteAll={deleteAll} />
              <View style={{ paddingHorizontal: 8 }}>
                <Text style={{ color: colors.sub, marginTop: 20, fontSize: 13 }}>
                  Data source: {state.source === 'demo' ? '🎮 demo data' : '📱 phone health data'}
                </Text>
                <BigButton label="Change data source" emoji="🔁" color={colors.sky} onPress={disconnect} />
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
