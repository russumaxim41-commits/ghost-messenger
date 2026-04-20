import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Glass } from '../../constants/colors';

type Props = {
  value: string;
  label: string;
  hint?: string;
  colors: { textSecondary: string; tint: string };
};

export function QRCodeDisplay({ value, label, hint, colors }: Props) {
  const isDark = useColorScheme() === 'dark';
  const glass = isDark ? Glass.dark : Glass.light;

  return (
    <View style={[styles.container, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label.toUpperCase()}</Text>
      <View style={styles.qrWrap}>
        <QRCode value={value || 'GHOST'} size={160} color="#0D0D0D" backgroundColor="#FFFFFF" />
      </View>
      <Text style={[styles.code, { color: colors.tint }]}>{value}</Text>
      {!!hint && <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 20, borderWidth: 1, padding: 20, alignItems: 'center', gap: 12, width: '100%' },
  label: { fontSize: 11, letterSpacing: 1, fontWeight: '500' },
  qrWrap: { padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
  code: { fontSize: 18, letterSpacing: 3, fontWeight: '700' },
  hint: { fontSize: 12, textAlign: 'center' },
});
