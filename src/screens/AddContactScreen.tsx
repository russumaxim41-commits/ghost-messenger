import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  Alert, Pressable, StyleSheet, Text, TextInput, View, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Colors, { Glass } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { QRCodeDisplay } from '../components/QRCodeDisplay';

type Tab = 'code' | 'qr';

export default function AddContactScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const glass = isDark ? Glass.dark : Glass.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { addContact, nearbyPeers, profile } = useApp();
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('code');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { Alert.alert(t.error, t.invalidCode); return; }
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const contact = await addContact(trimmed);
    setLoading(false);
    if (contact) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t.contactAdded, t.contactAddedDesc.replace('%s', contact.name), [
        { text: t.ok, onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert(t.error, t.contactExists);
    }
  };

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: glass.cardBorder }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, { backgroundColor: glass.card, borderColor: glass.cardBorder, opacity: pressed ? 0.6 : 1 }]}
          onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.addContactTitle}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.tabs, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
        {(['code', 'qr'] as Tab[]).map(tp => (
          <Pressable
            key={tp}
            onPress={() => setTab(tp)}
            style={[styles.tab, tab === tp && { backgroundColor: colors.tint }]}>
            <Feather name={tp === 'code' ? 'hash' : 'grid'} size={15} color={tab === tp ? '#fff' : colors.textSecondary} />
            <Text style={[styles.tabText, { color: tab === tp ? '#fff' : colors.textSecondary }]}>
              {tp === 'code' ? t.byCode : t.byQR}
            </Text>
          </Pressable>
        ))}
      </View>

      {nearbyPeers.length > 0 && (
        <View style={[styles.nearbyBanner, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
          <View style={[styles.nearbyDot, { backgroundColor: colors.online }]} />
          <Text style={[styles.nearbyText, { color: colors.text }]}>
            {nearbyPeers.length} {t.deviceNearby}
          </Text>
        </View>
      )}

      {tab === 'code' ? (
        <View style={styles.codeSection}>
          <View style={[styles.inputRow, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
            <Feather name="hash" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.codeInput, { color: colors.text }]}
              placeholder={t.codePlaceholder}
              placeholderTextColor={colors.textSecondary}
              value={code}
              onChangeText={v => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              maxLength={12}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
          </View>
          <Pressable
            onPress={handleAdd}
            disabled={loading}
            style={({ pressed }) => [styles.addBtn, { opacity: pressed || loading ? 0.85 : 1 }]}>
            <LinearGradient colors={[colors.tint, colors.tintDark]} style={styles.addBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Feather name="user-plus" size={18} color="#fff" />
              <Text style={styles.addBtnText}>{loading ? t.adding : t.addContact}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      ) : (
        <View style={styles.qrSection}>
          <View style={[styles.qrCard, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
            <Feather name="info" size={18} color={colors.tint} />
            <Text style={[styles.qrInfo, { color: colors.textSecondary }]}>{t.cameraUnavailable}</Text>
          </View>
          {profile && (
            <View style={styles.myQR}>
              <Text style={[styles.myQRLabel, { color: colors.textSecondary }]}>{t.myQRCode}</Text>
              <QRCodeDisplay value={profile.userCode} label={t.myQRCode} hint={t.showCodeHint} colors={colors} />
            </View>
          )}
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  tabs: { flexDirection: 'row', margin: 16, borderRadius: 16, borderWidth: 1, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 12 },
  tabText: { fontSize: 14, fontWeight: '500' },
  nearbyBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, padding: 12 },
  nearbyDot: { width: 8, height: 8, borderRadius: 4 },
  nearbyText: { fontSize: 14 },
  codeSection: { paddingHorizontal: 16, gap: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  codeInput: { flex: 1, fontSize: 15, letterSpacing: 1 },
  addBtn: { borderRadius: 16, overflow: 'hidden' },
  addBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  qrSection: { flex: 1, paddingHorizontal: 16, gap: 16 },
  qrCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 14 },
  qrInfo: { flex: 1, fontSize: 14, lineHeight: 20 },
  myQR: { gap: 8 },
  myQRLabel: { fontSize: 11, letterSpacing: 1, fontWeight: '500' },
});
