import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Colors, { Glass } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Avatar } from '../components/Avatar';
import type { RootStackParamList } from '../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function NewGroupScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const glass = isDark ? Glass.dark : Glass.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { contacts, createGroupChat } = useApp();
  const { t } = useLanguage();
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleCreate = async () => {
    if (!groupName.trim() || selected.length === 0) return;
    const chat = await createGroupChat(groupName.trim(), selected);
    navigation.goBack();
    navigation.navigate('Chat', { id: chat.id });
  };

  const canCreate = groupName.trim().length > 0 && selected.length > 0;

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: glass.cardBorder }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, { backgroundColor: glass.card, borderColor: glass.cardBorder, opacity: pressed ? 0.6 : 1 }]}
          onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.newGroup}</Text>
        <Pressable onPress={handleCreate} disabled={!canCreate}>
          <Text style={[styles.createText, { color: canCreate ? colors.tint : colors.textSecondary }]}>{t.create}</Text>
        </Pressable>
      </View>

      <View style={[styles.inputRow, { backgroundColor: glass.card, borderColor: glass.cardBorder, margin: 16 }]}>
        <Feather name="users" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder={t.groupName}
          placeholderTextColor={colors.textSecondary}
          value={groupName}
          onChangeText={setGroupName}
          maxLength={50}
        />
      </View>

      {selected.length > 0 && (
        <View style={[styles.selectedBanner, { backgroundColor: glass.card, borderColor: glass.cardBorder, marginHorizontal: 16, marginBottom: 8 }]}>
          <Feather name="check-circle" size={15} color={colors.tint} />
          <Text style={[styles.selectedText, { color: colors.tint }]}>{t.selectedCount} {selected.length}</Text>
        </View>
      )}

      <FlatList
        data={contacts}
        keyExtractor={i => i.id}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 40 }}
        renderItem={({ item }) => {
          const isSel = selected.includes(item.id);
          return (
            <Pressable
              style={[styles.contactRow, {
                backgroundColor: isSel ? glass.cardStrong : glass.card,
                borderColor: isSel ? colors.tint : glass.cardBorder,
              }]}
              onPress={() => toggle(item.id)}>
              <Avatar uri={item.avatar} name={item.name} size={44} />
              <View style={styles.contactInfo}>
                <Text style={[styles.contactName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.contactCode, { color: colors.textSecondary }]}>#{item.userCode}</Text>
              </View>
              <View style={[styles.checkbox, {
                borderColor: isSel ? colors.tint : glass.cardStrongBorder,
                backgroundColor: isSel ? colors.tint : 'transparent',
              }]}>
                {isSel && <Feather name="check" size={14} color="#fff" />}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={32} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.noContactsToAdd}</Text>
          </View>
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  createText: { fontSize: 16, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  input: { flex: 1, fontSize: 15 },
  selectedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10 },
  selectedText: { fontSize: 14, fontWeight: '500' },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, borderWidth: 1, gap: 12 },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: '600' },
  contactCode: { fontSize: 12, marginTop: 2 },
  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 14 },
});
