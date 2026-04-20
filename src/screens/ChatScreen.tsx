import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, useColorScheme,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Colors, { Glass } from '../../constants/colors';
import { Message, useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Avatar } from '../components/Avatar';
import { formatMessageTime } from '../../utils/formatTime';
import type { RootStackParamList } from '../navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type ChatRoute = RouteProp<RootStackParamList, 'Chat'>;

export default function ChatScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const glass = isDark ? Glass.dark : Glass.light;
  const insets = useSafeAreaInsets();
  const route = useRoute<ChatRoute>();
  const { id } = route.params;
  const navigation = useNavigation<NavProp>();
  const { chats, profile, sendMessage, sendChannelPost, contacts, markAsRead } = useApp();
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const chat = chats.find(c => c.id === id);

  useEffect(() => { if (chat) markAsRead(chat.id); }, [chat?.id]);
  useEffect(() => {
    if (chat?.messages.length) setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }, [chat?.messages.length]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const msgText = text; setText('');
    if (chat?.type === 'channel') {
      await sendChannelPost(id, msgText);
    } else {
      await sendMessage(id, msgText);
    }
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [text, id, chat?.type, sendMessage, sendChannelPost]);

  const getContactName = (senderId: string) => {
    if (senderId === profile?.id) return t.you;
    if (senderId === 'system') return '';
    return contacts.find(c => c.id === senderId)?.name ?? t.unknown;
  };

  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isMe = item.senderId === profile?.id;
    const isSystem = item.type === 'system';
    if (isSystem) {
      return (
        <View style={styles.systemWrap}>
          <View style={[styles.systemPill, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
            <Text style={[styles.systemText, { color: colors.textSecondary }]}>{item.text}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRight : styles.msgLeft]}>
        {!isMe && chat?.type !== 'direct' && (
          <Avatar uri={contacts.find(c => c.id === item.senderId)?.avatar ?? null} name={getContactName(item.senderId)} size={28} />
        )}
        <View style={styles.bubbleWrap}>
          {!isMe && chat?.type !== 'direct' && (
            <Text style={[styles.senderName, { color: colors.tint }]}>{getContactName(item.senderId)}</Text>
          )}
          {isMe ? (
            <LinearGradient colors={[colors.tint, colors.tintDark]} style={[styles.bubble, styles.bubbleMe]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={[styles.bubbleText, { color: '#fff' }]}>{item.text}</Text>
              <View style={styles.meta}>
                <Text style={[styles.time, { color: 'rgba(255,255,255,0.7)' }]}>{formatMessageTime(item.timestamp)}</Text>
                <Feather name="check" size={12} color="rgba(255,255,255,0.7)" />
              </View>
            </LinearGradient>
          ) : (
            <View style={[styles.bubble, styles.bubbleThem, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
              <Text style={[styles.bubbleText, { color: colors.text }]}>{item.text}</Text>
              <View style={styles.meta}>
                <Text style={[styles.time, { color: colors.textSecondary }]}>{formatMessageTime(item.timestamp)}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }, [colors, glass, chat, contacts, profile, t]);

  if (!chat) {
    return (
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
        <View style={styles.notFound}><Text style={{ color: colors.text }}>{t.noChat}</Text></View>
      </LinearGradient>
    );
  }

  const partnerContact = chat.type === 'direct'
    ? contacts.find(c => c.id !== profile?.id && chat.participants.includes(c.id))
    : null;
  const chatName = (() => {
    if (chat.type !== 'direct') return chat.name;
    return partnerContact?.name ?? chat.name;
  })();

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 4, backgroundColor: glass.tabBar, borderBottomColor: glass.cardBorder }]}>
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Feather name="chevron-left" size={26} color={colors.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          {chat.type === 'direct' ? (
            <Avatar uri={chat.avatar} name={chatName} size={36} />
          ) : (
            <LinearGradient
              colors={chat.type === 'channel' ? ['#8B5CF6', '#6D28D9'] : [colors.tint, colors.tintDark]}
              style={styles.headerIcon}>
              <Feather name={chat.type === 'channel' ? 'radio' : 'users'} size={16} color="#fff" />
            </LinearGradient>
          )}
          <View>
            <Text style={[styles.headerName, { color: colors.text }]}>{chatName}</Text>
            {partnerContact && (
              <Text style={[styles.headerSub, { color: partnerContact.isOnline ? colors.online : colors.textSecondary }]}>
                {partnerContact.isOnline ? t.inMesh : t.notOnline}
              </Text>
            )}
          </View>
        </View>
        <Pressable style={[styles.moreBtn, { backgroundColor: glass.card, borderColor: glass.cardBorder }]}>
          <Feather name="more-vertical" size={18} color={colors.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={flatListRef}
          data={chat.messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          style={styles.list}
          contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 14, gap: 6 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8, backgroundColor: glass.tabBar, borderTopColor: glass.tabBarBorder }]}>
          <View style={[styles.inputWrap, { backgroundColor: glass.inputBg, borderColor: glass.inputBorder }]}>
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder={t.messagePlaceholder}
              placeholderTextColor={colors.textSecondary}
              value={text}
              onChangeText={setText}
              multiline maxLength={2000}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
          </View>
          <Pressable onPress={handleSend} style={({ pressed }) => [styles.sendBtn, { opacity: pressed ? 0.8 : 1 }]} disabled={!text.trim()}>
            <LinearGradient
              colors={text.trim() ? [colors.tint, colors.tintDark] : [colors.textSecondary, colors.textSecondary]}
              style={styles.sendGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Feather name="send" size={18} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 10, borderBottomWidth: 1, gap: 4 },
  backBtn: { padding: 8 },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerName: { fontSize: 16, fontWeight: '600' },
  headerSub: { fontSize: 12, marginTop: 1 },
  moreBtn: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  list: { flex: 1 },
  systemWrap: { alignItems: 'center', marginVertical: 6 },
  systemPill: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 5 },
  systemText: { fontSize: 12, textAlign: 'center' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  msgLeft: { justifyContent: 'flex-start' },
  msgRight: { justifyContent: 'flex-end' },
  bubbleWrap: { maxWidth: '75%' },
  senderName: { fontSize: 11, marginBottom: 3, marginLeft: 14 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, gap: 4 },
  bubbleMe: { borderRadius: 20, borderBottomRightRadius: 5 },
  bubbleThem: { borderRadius: 20, borderBottomLeftRadius: 5, borderWidth: 1 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  time: { fontSize: 11 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1, gap: 10 },
  inputWrap: { flex: 1, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 2, minHeight: 44, justifyContent: 'center' },
  textInput: { fontSize: 15, maxHeight: 120, paddingVertical: 8 },
  sendBtn: { marginBottom: 2 },
  sendGrad: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
