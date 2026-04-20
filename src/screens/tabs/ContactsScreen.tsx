import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Colors, { Glass } from '../../../constants/colors';
import { Contact, useApp } from '../../../context/AppContext';
import { useLanguage } from '../../../context/LanguageContext';
import { Avatar } from '../../components/Avatar';
import { SwipeableRow } from '../../components/SwipeableRow';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ContactsScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const glass = isDark ? Glass.dark : Glass.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { contacts, nearbyPeers, removeContact } = useApp();
  const { t } = useLanguage();

  const handleDelete = (contact: Contact) => {
    Alert.alert(t.deleteContact, `${t.delete} "${contact.name}"?`, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => removeContact(contact.id) },
    ]);
  };

  const nearbyNotAdded = nearbyPeers.filter(p => !contacts.find(c => c.id === p.id || c.userCode === p.userCode));

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: glass.tabBar, borderBottomColor: glass.tabBarBorder }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.contacts}</Text>
        <Pressable
          style={[styles.addBtn, { backgroundColor: colors.tint }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('AddContact'); }}>
          <Feather name="user-plus" size={16} color="#fff" />
          <Text style={styles.addBtnText}>{t.addContact}</Text>
        </Pressable>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={i => i.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        ListHeaderComponent={
          nearbyNotAdded.length > 0 ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
              <Text style={[styles.section, { color: colors.textSecondary }]}>{t.nearbyMesh}</Text>
              {nearbyNotAdded.map(peer => (
                <Pressable
                  key={peer.id}
                  style={[styles.peerRow, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}
                  onPress={() => navigation.navigate('AddContact')}>
                  <View style={[styles.peerDot, { backgroundColor: colors.online }]} />
                  <Avatar uri={null} name={peer.name} size={40} />
                  <View style={styles.peerInfo}>
                    <Text style={[styles.peerName, { color: colors.text }]}>{peer.name}</Text>
                    <Text style={[styles.peerCode, { color: colors.textSecondary }]}>#{peer.userCode}</Text>
                  </View>
                  <Feather name="user-plus" size={18} color={colors.tint} />
                </Pressable>
              ))}
              {contacts.length > 0 && <Text style={[styles.section, { color: colors.textSecondary, marginTop: 4 }]}>{t.contacts.toUpperCase()}</Text>}
            </View>
          ) : contacts.length > 0 ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Text style={[styles.section, { color: colors.textSecondary }]}>{t.contacts.toUpperCase()}</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <SwipeableRow onDelete={() => handleDelete(item)} deleteLabel={t.delete}>
            <Pressable
              style={[styles.contactRow]}
              onPress={() => navigation.navigate('ContactDetail', { id: item.id })}>
              <View style={{ position: 'relative' }}>
                <Avatar uri={item.avatar} name={item.name} size={50} />
                {item.isOnline && <View style={[styles.onlineDot, { backgroundColor: colors.online }]} />}
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.contactCode, { color: colors.textSecondary }]}>#{item.userCode}</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textSecondary} />
            </Pressable>
          </SwipeableRow>
        )}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: glass.cardBorder }]} />}
        ListEmptyComponent={nearbyNotAdded.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
              <Feather name="users" size={36} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noContacts}</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>{t.noContactsDesc}</Text>
            <Pressable
              style={[styles.emptyBtn, { backgroundColor: colors.tint }]}
              onPress={() => navigation.navigate('AddContact')}>
              <Feather name="user-plus" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>{t.addContact}</Text>
            </Pressable>
          </View>
        ) : null}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 26, fontWeight: '700' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  section: { fontSize: 11, letterSpacing: 1, fontWeight: '500', marginBottom: 6 },
  peerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 12 },
  peerDot: { position: 'absolute', left: 0, top: 0, width: 8, height: 8, borderRadius: 4 },
  peerInfo: { flex: 1 },
  peerName: { fontSize: 15, fontWeight: '600' },
  peerCode: { fontSize: 12, marginTop: 2 },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#07091A' },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '600' },
  contactCode: { fontSize: 12, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 78 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 16, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
