import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import Colors, { Glass } from '../../../constants/colors';
import { Chat, useApp } from '../../../context/AppContext';
import { useLanguage } from '../../../context/LanguageContext';
import { Avatar } from '../../components/Avatar';
import { SwipeableRow } from '../../components/SwipeableRow';
import { formatTime } from '../../../utils/formatTime';
import type { RootStackParamList } from '../../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export default function ChatsScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const glass = isDark ? Glass.dark : Glass.light;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { chats, contacts, profile, deleteChat, meshPeersCount } = useApp();
  const { t } = useLanguage();

  const sorted = [...chats].sort((a, b) => {
    const aTime = a.lastMessage?.timestamp ?? a.createdAt;
    const bTime = b.lastMessage?.timestamp ?? b.createdAt;
    return bTime - aTime;
  });

  const getChatName = (chat: Chat) => {
    if (chat.type !== 'direct') return chat.name;
    const other = chat.participants.find(p => p !== profile?.id);
    const contact = contacts.find(c => c.id === other);
    return contact?.name ?? chat.name;
  };

  const handleDelete = useCallback((chat: Chat) => {
    Alert.alert(t.deleteChat, `${t.deleteChatQ} "${getChatName(chat)}"?`, [
      { text: t.cancel, style: 'cancel' },
      { text: t.delete, style: 'destructive', onPress: () => deleteChat(chat.id) },
    ]);
  }, [t]);

  const renderItem = useCallback(({ item }: { item: Chat }) => {
    const chatName = getChatName(item);
    const lastText = item.lastMessage?.text;
    const lastTime = item.lastMessage?.timestamp;
    const isGroup = item.type === 'group';
    const isChannel = item.type === 'channel';

    return (
      <SwipeableRow onDelete={() => handleDelete(item)} deleteLabel={t.delete}>
        <Pressable
          style={({ pressed }) => [styles.chatRow, { backgroundColor: pressed ? glass.cardStrong : 'transparent' }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.navigate('Chat', { id: item.id }); }}>
          <View style={styles.avatarWrap}>
            {isGroup || isChannel ? (
              <LinearGradient
                colors={isChannel ? ['#8B5CF6', '#6D28D9'] : [colors.tint, colors.tintDark]}
                style={styles.iconAvatar}>
                <Feather name={isChannel ? 'radio' : 'users'} size={18} color="#fff" />
              </LinearGradient>
            ) : (
              <Avatar uri={item.avatar} name={chatName} size={50} />
            )}
            {item.unreadCount > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.tint }]}>
                <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            )}
          </View>
          <View style={styles.chatInfo}>
            <View style={styles.chatTop}>
              <Text style={[styles.chatName, { color: colors.text }]} numberOfLines={1}>{chatName}</Text>
              {lastTime && <Text style={[styles.chatTime, { color: colors.textSecondary }]}>{formatTime(lastTime)}</Text>}
            </View>
            <Text style={[styles.chatLast, { color: colors.textSecondary }]} numberOfLines={1}>
              {lastText ?? t.noMessages}
            </Text>
          </View>
        </Pressable>
      </SwipeableRow>
    );
  }, [colors, glass, navigation, contacts, profile, t]);

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: glass.tabBar, borderBottomColor: glass.tabBarBorder }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t.chats}</Text>
          {meshPeersCount > 0 && (
            <Text style={[styles.headerSub, { color: colors.online }]}>
              ● {meshPeersCount} {t.devicesOnline}
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}
            onPress={() => navigation.navigate('NewGroup')}>
            <Feather name="users" size={18} color={colors.tint} />
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}
            onPress={() => navigation.navigate('NewChannel')}>
            <Feather name="radio" size={18} color={colors.tint} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: glass.cardBorder }]} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
              <Feather name="message-circle" size={36} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t.noChats}</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>{t.noChatsDesc}</Text>
          </View>
        }
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 26, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  avatarWrap: { position: 'relative' },
  iconAvatar: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  chatInfo: { flex: 1, gap: 4 },
  chatTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chatName: { fontSize: 16, fontWeight: '600', flex: 1 },
  chatTime: { fontSize: 12 },
  chatLast: { fontSize: 13 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 78 },
  empty: { flex: 1, alignItems: 'center', paddingTop: 100, gap: 16, paddingHorizontal: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
