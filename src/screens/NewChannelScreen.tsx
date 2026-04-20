import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Colors, { Glass } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import type { RootStackParamList } from '../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function NewChannelScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const glass = isDark ? Glass.dark : Glass.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { createChannel } = useApp();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    const chat = await createChannel(name.trim(), desc.trim() || undefined);
    setLoading(false);
    navigation.goBack();
    navigation.navigate('Chat', { id: chat.id });
  };

  const canCreate = name.trim().length > 0 && !loading;

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: glass.cardBorder }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, { backgroundColor: glass.card, borderColor: glass.cardBorder, opacity: pressed ? 0.6 : 1 }]}
          onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t.newChannel}</Text>
        <Pressable onPress={handleCreate} disabled={!canCreate}>
          <Text style={[styles.createText, { color: canCreate ? colors.tint : colors.textSecondary }]}>
            {loading ? '...' : t.create}
          </Text>
        </Pressable>
      </View>

      <View style={{ padding: 16, gap: 12 }}>
        <View style={[styles.inputRow, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
          <Feather name="radio" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={t.channelName}
            placeholderTextColor={colors.textSecondary}
            value={name} onChangeText={setName}
            autoFocus maxLength={60}
          />
        </View>
        <View style={[styles.inputRow, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
          <Feather name="align-left" size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={t.channelDesc}
            placeholderTextColor={colors.textSecondary}
            value={desc} onChangeText={setDesc}
            maxLength={200}
          />
        </View>
        <Pressable
          onPress={handleCreate}
          disabled={!canCreate}
          style={({ pressed }) => [styles.createBtn, { opacity: pressed || loading ? 0.85 : 1 }]}>
          <LinearGradient colors={['#8B5CF6', '#6D28D9']} style={styles.createGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Feather name="radio" size={18} color="#fff" />
            <Text style={styles.createBtnText}>{loading ? t.creating : t.createChannel}</Text>
          </LinearGradient>
        </Pressable>
      </View>
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
  createBtn: { borderRadius: 16, overflow: 'hidden' },
  createGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
