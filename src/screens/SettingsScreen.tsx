import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Share, Text, TextInput, View } from 'react-native';
import { createBackup, restoreBackup } from '../backup';
import Constants from 'expo-constants';
import { BigButton, Card, Chip, Note } from '../components/ui';
import { clearErrorLog, initErrorReporting, LoggedError, readErrorLog } from '../errors';
import { cancelAllNotifications, ensurePermission } from '../notify';
import { setBackgroundEnabled } from '../background';
import { requestBackgroundRead } from '../health';
import { PRIVACY_SUMMARY } from '../privacy';
import { DEFAULT_SETTINGS, Settings, loadSettings, saveSettings } from '../settings';
import { colors } from '../theme';

function Toggle({ label, sub, on, onChange }: { label: string; sub: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!on)} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.sub, fontSize: 12, lineHeight: 17, marginTop: 2 }}>{sub}</Text>
      </View>
      <View style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: on ? colors.lime : colors.cardAlt, borderWidth: 1.5, borderColor: on ? colors.lime : colors.border, justifyContent: 'center', paddingHorizontal: 3, alignItems: on ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: on ? colors.ink : colors.sub }} />
      </View>
    </Pressable>
  );
}

export function SettingsScreen({ onChanged, onDeleteAll, onRestored }: { onChanged: (s: Settings) => void; onDeleteAll: () => void; onRestored: () => void }) {
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [backupMsg, setBackupMsg] = useState('');
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [log, setLog] = useState<LoggedError[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [denied, setDenied] = useState(false);
  const [bgNote, setBgNote] = useState(false);

  useEffect(() => {
    loadSettings().then(setS);
    readErrorLog().then(setLog);
  }, []);

  const update = async (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    // Notifications need the OS permission; if it is refused, leave the switch off and say why.
    if ((patch.morningSummary || patch.bedtimeReminder || patch.bpReminder || patch.weighInReminder) && !(await ensurePermission())) {
      setDenied(true);
      return;
    }
    if ((patch.morningSummary || patch.bedtimeReminder) && !(await requestBackgroundRead())) {
      // Reminders still work while the app is open; only the closed-app refresh needs this permission.
      setBgNote(true);
    } else setBgNote(false);
    setDenied(false);
    setS(next);
    await saveSettings(next);
    const any = next.morningSummary || next.bedtimeReminder || next.bpReminder || next.weighInReminder;
    await setBackgroundEnabled(any);
    if (!any) await cancelAllNotifications();
    if (patch.crashReports !== undefined) initErrorReporting(next.crashReports);
    onChanged(next);
  };

  const confirmDelete = () =>
    Alert.alert('Delete all data?', 'This removes your profile, check-ins, blood tests, manual readings and settings from this phone. Data in Apple Health / Health Connect is not touched.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await cancelAllNotifications(); await setBackgroundEnabled(false); onDeleteAll(); } },
    ]);

  return (
    <View>
      <Card title="Appearance" emoji="🎨" delay={0}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['dark', 'light', 'auto'] as const).map((m) => (
            <Chip key={m} label={m === 'auto' ? 'Match phone' : m === 'dark' ? 'Dark' : 'Light'} selected={s.theme === m} onPress={() => update({ theme: m })} />
          ))}
        </View>
      </Card>

      <Card title="Notifications" emoji="🔔" delay={0}>
        <Toggle label="Morning summary" sub="Your recovery and strain target once the day starts. Delivered when the phone next syncs in the background." on={s.morningSummary} onChange={(v) => update({ morningSummary: v })} />
        <Toggle label="Bedtime reminder" sub="A nudge 45 minutes before the bedtime that fits tonight's sleep need and your usual wake time." on={s.bedtimeReminder} onChange={(v) => update({ bedtimeReminder: v })} />
        <Toggle label="Weigh-in reminder" sub="Monday and Thursday 7:30, after waking." on={s.weighInReminder} onChange={(v) => update({ weighInReminder: v })} />
        <Toggle label="Weekly blood pressure reminder" sub="Sunday 9:00 prompt to take a cuff reading." on={s.bpReminder} onChange={(v) => update({ bpReminder: v })} />
        {denied ? <Text style={{ color: colors.coral, marginTop: 6, lineHeight: 19 }}>Notifications are blocked for Vitalis. Allow them in your phone's settings, then try again.</Text> : null}
        {bgNote ? <Text style={{ color: colors.sun, marginTop: 6, lineHeight: 19 }}>Health Connect background access was not granted, so summaries refresh only when you open Vitalis. You can allow it in Health Connect settings.</Text> : null}
        <Note>Background updates are run by the operating system and are not guaranteed to be on time, especially in battery saver mode.</Note>
      </Card>

      <Card title="Privacy and crash reports" emoji="🔒" delay={40}>
        {PRIVACY_SUMMARY.map((t, i) => (
          <Text key={i} style={{ color: colors.sub, fontSize: 13, lineHeight: 19, marginBottom: 6 }}>• {t}</Text>
        ))}
        <Toggle label="Share anonymous crash reports" sub="Off by default. Sends the error type and app version only, never health data." on={s.crashReports} onChange={(v) => update({ crashReports: v })} />
        <Pressable onPress={() => setShowLog((v) => !v)}>
          <Text style={{ color: colors.sky, fontWeight: '700', marginTop: 4 }}>{showLog ? 'Hide' : 'Show'} error log ({log.length})</Text>
        </Pressable>
        {showLog ? (
          <View style={{ marginTop: 8 }}>
            {log.length === 0 ? <Text style={{ color: colors.sub }}>No errors recorded 🎉</Text> : null}
            {log.slice(-8).reverse().map((e) => (
              <Text key={e.t} style={{ color: colors.sub, fontSize: 11, lineHeight: 16, marginBottom: 6 }}>{new Date(e.t).toLocaleString()} [{e.where}] {e.message}</Text>
            ))}
            {log.length ? <BigButton label="Clear log" color={colors.sky} onPress={async () => { await clearErrorLog(); setLog([]); }} /> : null}
          </View>
        ) : null}
      </Card>

      <Card title="Backup and restore" emoji="💾" delay={60}>
        <Text style={{ color: colors.sub, lineHeight: 20 }}>Save your profile, check-ins, blood tests, manual readings, experiments and settings as text. Keep it in notes or email it to yourself, and paste it back on a new phone.</Text>
        <BigButton label="Save a backup" emoji="📤" color={colors.sky} onPress={async () => { try { await Share.share({ message: await createBackup(), title: 'Vitalis backup' }); } catch {} }} />
        <BigButton label={pasting ? 'Cancel restore' : 'Restore from a backup'} emoji="📥" color={colors.cardAlt} textColor={colors.text} onPress={() => { setPasting((v) => !v); setBackupMsg(''); }} />
        {pasting ? (
          <View style={{ marginTop: 10 }}>
            <TextInput value={pasted} onChangeText={setPasted} multiline placeholder="Paste your backup text here" placeholderTextColor={colors.sub} style={{ color: colors.text, backgroundColor: colors.cardAlt, borderRadius: 12, padding: 12, minHeight: 90, maxHeight: 160 }} />
            <BigButton
              label="Restore"
              onPress={async () => {
                const r = await restoreBackup(pasted);
                if (r.ok) { setBackupMsg(`Restored: ${r.restored.join(', ')}.`); setPasted(''); setPasting(false); onRestored(); }
                else setBackupMsg(r.error ?? 'Could not restore.');
              }}
            />
          </View>
        ) : null}
        {backupMsg ? <Text style={{ color: colors.sun, marginTop: 8 }}>{backupMsg}</Text> : null}
        <Note>Restoring replaces what is on this phone for each section in the backup. Health data itself is not included; it is read again from your phone.</Note>
      </Card>

      <Card title="Your data" emoji="🗑️" delay={80}>
        <Text style={{ color: colors.sub, lineHeight: 20 }}>Everything Vitalis stores lives on this phone only.</Text>
        <BigButton label="Delete all my data" emoji="🗑️" color={colors.coral} onPress={confirmDelete} />
        <Note>Version {Constants.expoConfig?.version ?? '0.1.0'}. Not a medical device.</Note>
      </Card>
    </View>
  );
}
