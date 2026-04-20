import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Colors, { Glass } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Avatar } from '../components/Avatar';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { formatRelativeTime } from '../../utils/formatTime';
import type { RootStackParamList } from '../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type ContactDetailRoute = RouteProp<RootStackParamList, 'ContactDetail'>;

export default function ContactDetailScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const glass = isDark ? Glass.dark : Glass.light;
  const insets = useSafeAreaInsets();
  const route = useRoute<ContactDetailRoute>();
  const { id } = route.params;
  const navigation = useNavigation<NavProp>();
  const { contacts, removeContact, getOrCreateDirectChat } = useApp();
  const { t } = useLanguage();
  const contact = contacts.find(c => c.id === id);

  if (!contact) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
        <View style={styles.notFound}><Text style={{ color: colors.text }}>{t.noChat}</Text></View>
      </LinearGradient>
    );
  }

  const handleChat = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const chat = await getOrCreateDirectChat(contact.id);
    navigation.navigate('Chat', { id: chat.id });
  };

  const handleDelete = () => {
    Alert.alert(t.deleteContact, `${t.delete} "${contact.name}"?`, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: async () => { await removeContact(contact.id); navigation.goBack(); } },
    ]);
  };

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.navRow}>
          <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.navBtn, { backgroundColor: glass.card, borderColor: glass.cardBorder, opacity: pressed ? 0.6 : 1 }]}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={handleDelete} style={({ pressed }) => [styles.navBtn, { backgroundColor: glass.card, borderColor: glass.cardBorder, opacity: pressed ? 0.6 : 1 }]}>
            <Feather name="trash-2" size={18} color={colors.danger} />
          </Pressable>
        </View>

        <View style={styles.profile}>
          <Avatar uri={contact.avatar} name={contact.name} size={88} />
          <Text style={[styles.name, { color: colors.text }]}>{contact.name}</Text>
          <View style={[styles.codePill, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
            <Feather name="hash" size={13} color={colors.tint} />
            <Text style={[styles.code, { color: colors.tint }]}>{contact.userCode}</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: contact.isOnline ? colors.online : colors.textSecondary }]} />
            <Text style={[styles.status, { color: colors.textSecondary }]}>
              {contact.isOnline ? t.onlineStatus : `${t.wasOnline} ${formatRelativeTime(contact.lastSeen)}`}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleChat}
          style={({ pressed }) => [styles.chatBtn, { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 }]}>
          <Feather name="message-circle" size={20} color="#fff" />
          <Text style={styles.chatBtnText}>{t.sendMessage}</Text>
        </Pressable>

        <QRCodeDisplay value={contact.userCode} label={`${t.contactQR} ${contact.name}`} hint={t.showCodeHint} colors={colors} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  navBtn: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  profile: { alignItems: 'center', gap: 12, marginBottom: 24 },
  name: { fontSize: 26, fontWeight: '800' },
  codePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  code: { fontSize: 14, letterSpacing: 1, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 14 },
  chatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18, borderRadius: 18, marginBottom: 24 },
  chatBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
