import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type AvatarProps = { uri: string | null; name: string; size: number };

const COLORS = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#DDA0DD','#98D8C8','#BB8FCE','#82E0AA'];

function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function Avatar({ uri, name, size }: AvatarProps) {
  const r = size / 2;
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: r, resizeMode: 'cover' }} />;
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: r, backgroundColor: getColor(name) }]}>
      <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});
