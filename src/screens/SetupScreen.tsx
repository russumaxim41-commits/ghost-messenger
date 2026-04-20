import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors, { Glass } from '../../constants/colors';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';

export default function SetupScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const glass = isDark ? Glass.dark : Glass.light;
  const insets = useSafeAreaInsets();
  const { setupProfile } = useApp();
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError(t.nameRequired); return; }
    if (trimmed.length < 2) { setError(t.nameMinLength); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    await setupProfile(trimmed);
    setLoading(false);
  };

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.gradient}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
          <View style={styles.logoSection}>
            <View style={[styles.logoOuter, {
              backgroundColor: glass.card, borderColor: glass.cardBorder, shadowColor: colors.tint,
            }]}>
              <LinearGradient colors={[colors.tint, colors.tintDark]} style={styles.logoInner}>
                <Text style={styles.ghostEmoji}>👻</Text>
              </LinearGradient>
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>GHOST</Text>
            <View style={[styles.taglinePill, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
              <View style={[styles.dot, { backgroundColor: colors.tint }]} />
              <Text style={[styles.tagline, { color: colors.textSecondary }]}>{t.appTagline}</Text>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t.namePrompt}</Text>
            <View style={[styles.inputWrap, {
              backgroundColor: glass.inputBg,
              borderColor: error ? colors.danger : glass.inputBorder,
            }]}>
              <Feather name="user" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder={t.namePlaceholder}
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={v => { setName(v); setError(''); }}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleContinue}
                maxLength={30}
              />
            </View>
            {!!error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
            <Pressable
              style={({ pressed }) => [styles.button, { opacity: pressed || loading ? 0.85 : 1 }]}
              onPress={handleContinue}
              disabled={loading}>
              <LinearGradient
                colors={[colors.tint, colors.tintDark]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.buttonText}>{loading ? t.creating : t.startBtn}</Text>
                {!loading && <Feather name="arrow-right" size={18} color="#fff" />}
              </LinearGradient>
            </Pressable>
          </View>

          <View style={styles.features}>
            {[
              { icon: 'wifi-off' as const, label: t.noInternet },
              { icon: 'shield' as const, label: t.private },
              { icon: 'zap' as const, label: t.fast },
            ].map(f => (
              <View key={f.icon} style={[styles.featureItem, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
                <Feather name={f.icon} size={16} color={colors.tint} />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  logoSection: { alignItems: 'center', gap: 16 },
  logoOuter: {
    width: 90, height: 90, borderRadius: 28, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
  },
  logoInner: { width: 70, height: 70, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  ghostEmoji: { fontSize: 34 },
  appName: { fontSize: 36, fontWeight: '800', letterSpacing: 4 },
  taglinePill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tagline: { fontSize: 13 },
  card: { borderRadius: 24, borderWidth: 1, padding: 24, gap: 16 },
  label: { fontSize: 11, letterSpacing: 1.5, fontWeight: '500' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14 },
  input: { flex: 1, fontSize: 16 },
  error: { fontSize: 13 },
  button: { borderRadius: 16, overflow: 'hidden' },
  buttonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  features: { flexDirection: 'row', gap: 10 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, flex: 1 },
  featureText: { fontSize: 11, flex: 1 },
});
