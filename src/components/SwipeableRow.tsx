import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

type Props = { children: React.ReactNode; onDelete: () => void; deleteLabel?: string };

export function SwipeableRow({ children, onDelete, deleteLabel = 'Удалить' }: Props) {
  const ref = useRef<Swipeable>(null);

  const renderRight = (_prog: any, dragX: Animated.AnimatedInterpolation<number>) => {
    const trans = dragX.interpolate({ inputRange: [-80, 0], outputRange: [0, 80], extrapolate: 'clamp' });
    return (
      <Animated.View style={[styles.action, { transform: [{ translateX: trans }] }]}>
        <Pressable
          onPress={() => { ref.current?.close(); onDelete(); }}
          style={styles.btn}>
          <Text style={styles.label}>{deleteLabel}</Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Swipeable ref={ref} renderRightActions={renderRight} rightThreshold={40}>
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  action: { backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'flex-end' },
  btn: { width: 80, paddingVertical: 16, justifyContent: 'center', alignItems: 'center' },
  label: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
