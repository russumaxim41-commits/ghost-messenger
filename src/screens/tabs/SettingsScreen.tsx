import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors, { Glass } from '../../../constants/colors';
import { useApp } from '../../../context/AppContext';
import { useLanguage } from '../../../context/LanguageContext';
import { Avatar } from '../../components/Avatar';
import { QRCodeDisplay } from '../../components/QRCodeDisplay';
import { formatRelativeTime } from '../../../utils/formatTime';
import { NetworkMode } from '../../mesh/GhostProtocol';

export default function SettingsScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const glass = isDark ? Glass.dark : Glass.light;
  const insets = useSafeAreaInsets();
  const {
    profile, chats, contacts, meshPeersCount, blePeersCount, packetCount,
    debugLogs, updateAvatar, updateName, networkSettings, updateNetworkSettings,
  } = useApp();
  const { t, lang, toggleLanguage } = useLanguage();

  const [debugOpen, setDebugOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(profile?.name ?? '');
  const [saving, setSaving] = useState(false);

  const onlineCount = contacts.filter(c => c.isOnline).length;

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (trimmed.length < 2) { Alert.alert(t.error, t.nameError); return; }
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await updateName(trimmed);
    setSaving(false);
    setEditingName(false);
  };

  const handleModePress = (mode: NetworkMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateNetworkSettings({ mode });
  };

  const Row = ({ icon, label, value, onPress, color }: {
    icon: string; label: string; value?: string; onPress?: () => void; color?: string;
  }) => (
    <Pressable
      style={({ pressed }) => [styles.row, { backgroundColor: pressed && onPress ? glass.cardStrong : 'transparent' }]}
      onPress={onPress} disabled={!onPress}>
      <View style={[styles.rowIcon, { backgroundColor: glass.inputBg }]}>
        <Feather name={icon as any} size={17} color={color ?? colors.tint} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      {value && <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>}
      {onPress && <Feather name="chevron-right" size={16} color={colors.textSecondary} />}
    </Pressable>
  );

  const ToggleRow = ({ icon, label, desc, value, onChange, color }: {
    icon: string; label: string; desc: string; value: boolean;
    onChange: (v: boolean) => void; color?: string;
  }) => (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: glass.inputBg }]}>
        <Feather name={icon as any} size={17} color={color ?? colors.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={v => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onChange(v); }}
        trackColor={{ false: glass.cardBorder, true: colors.tint }}
        thumbColor="#fff"
      />
    </View>
  );

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>GHOST</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>{t.profile}</Text>
        </View>

        {/* Профиль */}
        <Pressable style={styles.profileCard} onPress={updateAvatar}>
          <Avatar uri={profile?.avatar ?? null} name={profile?.name ?? 'G'} size={80} />
          <View style={styles.profileInfo}>
            {editingName ? (
              <View style={styles.nameRow}>
                <TextInput
                  style={[styles.nameInput, { color: colors.text, borderColor: glass.inputBorder, backgroundColor: glass.inputBg }]}
                  value={newName} onChangeText={setNewName}
                  autoFocus maxLength={30} returnKeyType="done" onSubmitEditing={handleSaveName}
                />
                <Pressable onPress={handleSaveName} disabled={saving}>
                  <Feather name="check" size={20} color={colors.tint} />
                </Pressable>
                <Pressable onPress={() => { setEditingName(false); setNewName(profile?.name ?? ''); }}>
                  <Feather name="x" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.nameRow} onPress={() => { setEditingName(true); setNewName(profile?.name ?? ''); }}>
                <Text style={[styles.profileName, { color: colors.text }]}>{profile?.name}</Text>
                <Feather name="edit-2" size={14} color={colors.textSecondary} />
              </Pressable>
            )}
            <View style={[styles.codePill, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
              <Feather name="hash" size={13} color={colors.tint} />
              <Text style={[styles.code, { color: colors.tint }]}>{profile?.userCode}</Text>
            </View>
          </View>
        </Pressable>

        {/* Статистика */}
        <View style={styles.statsRow}>
          {[
            { label: t.chatsLabel, value: chats.length },
            { label: t.contactsLabel, value: contacts.length },
            { label: t.onlineLabel, value: onlineCount },
          ].map(s => (
            <View key={s.label} style={[styles.stat, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
              <Text style={[styles.statValue, { color: colors.tint }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* QR */}
        {profile && (
          <View style={[styles.section, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
            <QRCodeDisplay value={profile.userCode} label={t.myQRCode} hint={t.showCodeHint} colors={colors} />
          </View>
        )}

        {/* ═══ НАСТРОЙКИ СЕТИ ═══ */}
        <View style={[styles.section, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {lang === 'ru' ? 'СЕТЬ И БЕЗОПАСНОСТЬ' : 'NETWORK & SECURITY'}
          </Text>

          {/* Статус */}
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: glass.inputBg }]}>
              <Feather name="radio" size={17} color={colors.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>
                {lang === 'ru' ? 'Статус mesh-сети' : 'Mesh network status'}
              </Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
                {lang === 'ru'
                  ? `WiFi: ${meshPeersCount} • BLE: ${blePeersCount} • Пакетов: ${packetCount}`
                  : `WiFi: ${meshPeersCount} • BLE: ${blePeersCount} • Packets: ${packetCount}`}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: meshPeersCount > 0 || blePeersCount > 0 ? colors.tint : colors.textSecondary }]}>
              <Text style={styles.badgeText}>{meshPeersCount + blePeersCount}</Text>
            </View>
          </View>

          <View style={[styles.sep, { backgroundColor: glass.cardBorder }]} />

          {/* Режим транспорта */}
          <View style={[styles.row, { paddingBottom: 8 }]}>
            <View style={[styles.rowIcon, { backgroundColor: glass.inputBg }]}>
              <Feather name="zap" size={17} color={colors.tint} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {lang === 'ru' ? 'Транспорт' : 'Transport mode'}
            </Text>
          </View>
          <View style={[styles.modeRow, { paddingHorizontal: 16, paddingBottom: 14 }]}>
            {(['wifi', 'ble', 'auto'] as NetworkMode[]).map(mode => {
              const labels: Record<NetworkMode, string> = lang === 'ru'
                ? { wifi: 'WiFi', ble: 'BLE', auto: 'Авто' }
                : { wifi: 'WiFi', ble: 'BLE', auto: 'Auto' };
              const icons: Record<NetworkMode, string> = { wifi: 'wifi', ble: 'bluetooth', auto: 'cpu' };
              const active = networkSettings.mode === mode;
              return (
                <Pressable
                  key={mode}
                  style={[styles.modeBtn, {
                    backgroundColor: active ? colors.tint : glass.inputBg,
                    borderColor: active ? colors.tint : glass.cardBorder,
                  }]}
                  onPress={() => handleModePress(mode)}>
                  <Feather name={icons[mode] as any} size={15} color={active ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.modeBtnText, { color: active ? '#fff' : colors.textSecondary }]}>
                    {labels[mode]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.sep, { backgroundColor: glass.cardBorder }]} />

          {/* Режим невидимки */}
          <ToggleRow
            icon="eye-off"
            label={lang === 'ru' ? 'Режим невидимки' : 'Stealth mode'}
            desc={lang === 'ru' ? 'Только приём, без трансляции вашего ID' : 'Receive only, do not broadcast your ID'}
            value={networkSettings.stealth}
            onChange={v => updateNetworkSettings({ stealth: v })}
            color="#FF6B6B"
          />

          <View style={[styles.sep, { backgroundColor: glass.cardBorder }]} />

          {/* Транзитный узел */}
          <ToggleRow
            icon="share-2"
            label={lang === 'ru' ? 'Транзитный узел' : 'Transit node'}
            desc={lang === 'ru'
              ? 'Ретранслировать чужие пакеты — основа вирусной сети'
              : 'Relay packets for others — the heart of the mesh'}
            value={networkSettings.transitNode}
            onChange={v => updateNetworkSettings({ transitNode: v })}
            color="#FFB347"
          />

          <View style={[styles.sep, { backgroundColor: glass.cardBorder }]} />

          {/* Консоль */}
          <Row icon="terminal" label={t.debugConsole} onPress={() => setDebugOpen(true)} />
        </View>

        {/* Язык */}
        <View style={[styles.section, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.language}</Text>
          <Pressable
            style={({ pressed }) => [styles.langRow, { backgroundColor: pressed ? glass.cardStrong : 'transparent' }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleLanguage(); }}>
            <Text style={{ fontSize: 22 }}>{lang === 'ru' ? '🇷🇺' : '🇬🇧'}</Text>
            <Text style={[styles.rowLabel, { color: colors.text }]}>{lang === 'ru' ? 'Русский' : 'English'}</Text>
            <View style={[styles.switchPill, { backgroundColor: colors.tint }]}>
              <Text style={styles.switchText}>{t.switchLang}</Text>
            </View>
          </Pressable>
        </View>

        {/* О приложении */}
        <View style={[styles.section, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t.aboutApp}</Text>
          <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: glass.inputBg }]}>
              <Text style={{ fontSize: 17 }}>👻</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{t.version} 2.0</Text>
              <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
                {lang === 'ru'
                  ? 'Вирусная mesh-сеть · Подписи Ed25519 · BLE + WiFi'
                  : 'Viral mesh network · Ed25519 signatures · BLE + WiFi'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Debug Modal */}
      <Modal visible={debugOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDebugOpen(false)}>
        <View style={[styles.debugModal, { backgroundColor: colors.background }]}>
          <View style={[styles.debugHeader, { borderBottomColor: glass.cardBorder }]}>
            <Text style={[styles.debugTitle, { color: colors.text }]}>{t.debugTitle}</Text>
            <Pressable onPress={() => setDebugOpen(false)}>
              <Feather name="x" size={22} color={colors.text} />
            </Pressable>
          </View>
          {debugLogs.length === 0 ? (
            <View style={styles.debugEmpty}>
              <Feather name="radio" size={32} color={colors.textSecondary} />
              <Text style={[styles.debugEmptyText, { color: colors.textSecondary }]}>{t.debugEmpty}</Text>
              <Text style={[styles.debugEmptyHint, { color: colors.textSecondary }]}>{t.debugHint}</Text>
            </View>
          ) : (
            <ScrollView style={styles.debugScroll} contentContainerStyle={{ padding: 16, gap: 8 }}>
              {debugLogs.map((e, i) => (
                <View key={i} style={[styles.debugRow, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
                  <View style={[styles.debugKindDot, { backgroundColor: kindColor(e.kind, colors) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.debugDetail, { color: colors.text }]}>{e.detail}</Text>
                    <Text style={[styles.debugTime, { color: colors.textSecondary }]}>{formatRelativeTime(e.time)}</Text>
                  </View>
                  <Text style={[styles.debugKind, { color: kindColor(e.kind, colors) }]}>{e.kind}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </LinearGradient>
  );
}

function kindColor(kind: string, colors: any) {
  switch (kind) {
    case 'peer_found': return colors.online;
    case 'peer_lost': return colors.danger;
    case 'msg_in': return colors.tint;
    case 'msg_out': return colors.tintDark;
    case 'relay': return '#FFB347';
    case 'sync': return '#9B59B6';
    case 'ble': return '#3498DB';
    default: return colors.textSecondary;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 32, fontWeight: '800', letterSpacing: 2 },
  headerSub: { fontSize: 14, marginTop: 2 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 16 },
  profileInfo: { flex: 1, gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, fontSize: 18 },
  profileName: { fontSize: 22, fontWeight: '700' },
  codePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
  code: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 18, borderWidth: 1, gap: 4 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, letterSpacing: 0.5, fontWeight: '500' },
  section: { marginHorizontal: 16, marginBottom: 14, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  sectionTitle: { fontSize: 11, letterSpacing: 1, fontWeight: '600', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15 },
  rowValue: { fontSize: 13 },
  rowDesc: { fontSize: 12, marginTop: 2 },
  badge: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  modeBtnText: { fontSize: 13, fontWeight: '600' },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  switchPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  switchText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  debugModal: { flex: 1 },
  debugHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  debugTitle: { fontSize: 17, fontWeight: '700' },
  debugScroll: { flex: 1 },
  debugEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  debugEmptyText: { fontSize: 16, fontWeight: '500' },
  debugEmptyHint: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  debugRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  debugKindDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  debugDetail: { fontSize: 13 },
  debugTime: { fontSize: 11, marginTop: 4 },
  debugKind: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
});
