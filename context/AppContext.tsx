import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { CryptoManager } from '../src/crypto/CryptoManager';
import { GhostPacket, NetworkSettings } from '../src/mesh/GhostProtocol';
import { MeshNetwork, MeshPeer, DebugEvent } from '../src/mesh/MeshNetwork';
import { PacketStore } from '../src/store/PacketStore';

export type UserProfile = {
  id: string;
  name: string;
  avatar: string | null;
  userCode: string;
  createdAt: number;
};

export type Contact = {
  id: string;
  name: string;
  avatar: string | null;
  userCode: string;
  lastSeen: number;
  isOnline: boolean;
};

export type Message = {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  type: 'text' | 'image' | 'system';
  status: 'sent' | 'delivered' | 'read';
  verified?: boolean; // подпись проверена
};

export type Chat = {
  id: string;
  type: 'direct' | 'group' | 'channel';
  name: string;
  avatar: string | null;
  participants: string[];
  ownerId?: string;
  description?: string;
  channelHash?: string; // хэш канала (для каналов)
  lastMessage?: Message;
  unreadCount: number;
  createdAt: number;
  messages: Message[];
};

type AppContextValue = {
  profile: UserProfile | null;
  contacts: Contact[];
  chats: Chat[];
  isProfileSetup: boolean;
  nearbyPeers: MeshPeer[];
  meshPeersCount: number;
  blePeersCount: number;
  packetCount: number;
  debugLogs: DebugEvent[];
  networkSettings: NetworkSettings;
  setupProfile: (name: string) => Promise<void>;
  updateAvatar: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  updateNetworkSettings: (s: Partial<NetworkSettings>) => void;
  addContact: (userCode: string) => Promise<Contact | null>;
  removeContact: (contactId: string) => Promise<void>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  sendChannelPost: (chatId: string, text: string) => Promise<void>;
  createGroupChat: (name: string, participantIds: string[], description?: string) => Promise<Chat>;
  createChannel: (name: string, description?: string) => Promise<Chat>;
  deleteChat: (chatId: string) => Promise<void>;
  getOrCreateDirectChat: (contactId: string) => Promise<Chat>;
  markAsRead: (chatId: string) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

const KEYS = {
  PROFILE: '@ghost_profile',
  CONTACTS: '@ghost_contacts',
  CHATS: '@ghost_chats',
  NETWORK: '@ghost_network_settings',
};

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

const MAX_DEBUG = 100;

// Синглтоны живут вне компонента чтобы не пересоздаваться
let storeInstance: PacketStore | null = null;
let cryptoInstance: CryptoManager | null = null;

function getStore(): PacketStore {
  if (!storeInstance) storeInstance = new PacketStore();
  return storeInstance;
}

async function getCrypto(): Promise<CryptoManager> {
  if (!cryptoInstance) {
    cryptoInstance = new CryptoManager();
    await cryptoInstance.init();
  }
  return cryptoInstance;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isProfileSetup, setIsProfileSetup] = useState(false);
  const [nearbyPeers, setNearbyPeers] = useState<MeshPeer[]>([]);
  const [meshPeersCount, setMeshPeersCount] = useState(0);
  const [blePeersCount, setBlePeersCount] = useState(0);
  const [packetCount, setPacketCount] = useState(0);
  const [debugLogs, setDebugLogs] = useState<DebugEvent[]>([]);
  const [networkSettings, setNetworkSettings] = useState<NetworkSettings>({
    mode: 'auto', stealth: false, transitNode: true,
  });

  const meshRef = useRef<MeshNetwork | null>(null);
  const chatsRef = useRef<Chat[]>([]);
  const contactsRef = useRef<Contact[]>([]);
  const profileRef = useRef<UserProfile | null>(null);
  const cryptoRef = useRef<CryptoManager | null>(null);

  chatsRef.current = chats;
  contactsRef.current = contacts;
  profileRef.current = profile;

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!profile) return;
    let active = true;
    (async () => {
      const crypto = await getCrypto();
      cryptoRef.current = crypto;
      if (!active) return;

      const store = getStore();
      const mesh = new MeshNetwork(
        profile.id, profile.name, profile.userCode, store, crypto, networkSettings
      );
      meshRef.current = mesh;

      mesh.onDebug = (e: DebugEvent) => {
        setDebugLogs(prev => [e, ...prev].slice(0, MAX_DEBUG));
      };

      mesh.onPeerDiscovered = (peer: MeshPeer) => {
        setNearbyPeers(prev => prev.find(p => p.id === peer.id) ? prev : [...prev, peer]);
        setMeshPeersCount(mesh.getWifiPeerCount());
        setContacts(prev => {
          const match = prev.find(c => c.userCode === peer.userCode || c.id === peer.id);
          if (!match) return prev;
          const updated = prev.map(c =>
            c.id === match.id ? { ...c, isOnline: true, lastSeen: Date.now(), name: peer.name } : c
          );
          saveContacts(updated);
          return updated;
        });
      };

      mesh.onPeerLost = (peerId: string) => {
        setNearbyPeers(prev => prev.filter(p => p.id !== peerId));
        setMeshPeersCount(mesh.getWifiPeerCount());
        setContacts(prev => {
          const updated = prev.map(c => c.id === peerId ? { ...c, isOnline: false, lastSeen: Date.now() } : c);
          saveContacts(updated);
          return updated;
        });
      };

      mesh.onBLEPeer = (count: number) => {
        setBlePeersCount(count);
      };

      // Входящий пакет из сети
      mesh.onPacket = (p: GhostPacket) => {
        setPacketCount(store.count());

        if (p.type === 'chat' && p.chatId) {
          handleIncomingChat(p);
        } else if (p.type === 'channel_post' && p.channelHash) {
          handleIncomingChannelPost(p);
        }
      };

      await mesh.start();

      // Обновить счётчик пакетов
      setPacketCount(store.count());

      return () => { active = false; mesh.stop(); };
    })();
    return () => { active = false; };
  }, [profile?.id]);

  const handleIncomingChat = (p: GhostPacket) => {
    const incomingMessage: Message = {
      id: p.id, senderId: p.senderId, text: p.payload,
      timestamp: p.ts, type: 'text', status: 'delivered', verified: true,
    };
    const contact = contactsRef.current.find(c => c.id === p.senderId || c.userCode === p.senderCode);

    setChats(prev => {
      // Ищем существующий чат
      let chat = prev.find(c => c.id === p.chatId);
      if (!chat) {
        chat = prev.find(c =>
          c.type === 'direct' &&
          c.participants.includes(p.senderId) &&
          c.participants.includes(profileRef.current?.id ?? '')
        );
      }
      if (!chat) {
        // Создаём чат автоматически (нам написали)
        const newChat: Chat = {
          id: p.chatId!, type: 'direct',
          name: contact?.name ?? p.senderName,
          avatar: contact?.avatar ?? null,
          participants: [profileRef.current?.id ?? '', p.senderId],
          unreadCount: 1, createdAt: p.ts, messages: [incomingMessage], lastMessage: incomingMessage,
        };
        const updated = [...prev, newChat];
        saveChats(updated);
        return updated;
      }
      if (chat.messages.find(m => m.id === p.id)) return prev; // дубликат
      const updated = prev.map(c => c.id !== chat!.id ? c : {
        ...c, messages: [...c.messages, incomingMessage],
        lastMessage: incomingMessage, unreadCount: c.unreadCount + 1,
      });
      saveChats(updated);
      return updated;
    });
  };

  const handleIncomingChannelPost = (p: GhostPacket) => {
    const post: Message = {
      id: p.id, senderId: p.senderId, text: p.payload,
      timestamp: p.ts, type: 'text', status: 'delivered', verified: true,
    };
    setChats(prev => {
      const channel = prev.find(c => c.channelHash === p.channelHash);
      if (!channel) return prev; // Не подписаны на этот канал
      if (channel.messages.find(m => m.id === p.id)) return prev;
      const updated = prev.map(c => c.id !== channel.id ? c : {
        ...c, messages: [...c.messages, post], lastMessage: post, unreadCount: c.unreadCount + 1,
      });
      saveChats(updated);
      return updated;
    });
  };

  const loadData = async () => {
    try {
      const [p, c, ch, ns] = await Promise.all([
        AsyncStorage.getItem(KEYS.PROFILE),
        AsyncStorage.getItem(KEYS.CONTACTS),
        AsyncStorage.getItem(KEYS.CHATS),
        AsyncStorage.getItem(KEYS.NETWORK),
      ]);
      if (p) { const parsed = JSON.parse(p) as UserProfile; setProfile(parsed); setIsProfileSetup(true); }
      if (c) setContacts(JSON.parse(c));
      if (ch) setChats(JSON.parse(ch));
      if (ns) setNetworkSettings(JSON.parse(ns));
    } catch {}
  };

  const saveProfile = (p: UserProfile) => AsyncStorage.setItem(KEYS.PROFILE, JSON.stringify(p));
  const saveContacts = (c: Contact[]) => AsyncStorage.setItem(KEYS.CONTACTS, JSON.stringify(c));
  const saveChats = (c: Chat[]) => AsyncStorage.setItem(KEYS.CHATS, JSON.stringify(c));

  const updateNetworkSettings = useCallback((partial: Partial<NetworkSettings>) => {
    setNetworkSettings(prev => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(KEYS.NETWORK, JSON.stringify(next));
      meshRef.current?.updateSettings(partial);
      return next;
    });
  }, []);

  const setupProfile = useCallback(async (name: string) => {
    const p: UserProfile = { id: genId(), name, avatar: null, userCode: genCode(), createdAt: Date.now() };
    setProfile(p); setIsProfileSetup(true); await saveProfile(p);
  }, []);

  const updateAvatar = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      setProfile(prev => { if (!prev) return prev; const u = { ...prev, avatar: uri }; saveProfile(u); return u; });
    }
  }, []);

  const updateName = useCallback(async (name: string) => {
    setProfile(prev => { if (!prev) return prev; const u = { ...prev, name }; saveProfile(u); return u; });
  }, []);

  const addContact = useCallback(async (userCode: string): Promise<Contact | null> => {
    const code = userCode.trim().toUpperCase();
    if (profileRef.current?.userCode === code) return null;
    if (contactsRef.current.find(c => c.userCode === code)) return null;
    const peer = meshRef.current?.getWifiPeers().find(p => p.userCode === code);
    const contact: Contact = {
      id: peer?.id ?? genId(), name: peer?.name ?? 'Ghost ' + code.slice(0, 4),
      avatar: null, userCode: code, lastSeen: Date.now(), isOnline: !!peer,
    };
    const updated = [...contactsRef.current, contact];
    setContacts(updated); await saveContacts(updated);
    return contact;
  }, []);

  const removeContact = useCallback(async (id: string) => {
    const updated = contactsRef.current.filter(c => c.id !== id);
    setContacts(updated); await saveContacts(updated);
  }, []);

  // Личное сообщение (DM / группа)
  const sendMessage = useCallback(async (chatId: string, text: string) => {
    if (!profileRef.current || !text.trim()) return;
    const chat = chatsRef.current.find(c => c.id === chatId);
    const targetId = chat?.participants.find(id => id !== profileRef.current?.id);

    let packet: GhostPacket | null = null;
    if (meshRef.current) {
      packet = meshRef.current.createAndSend({
        type: 'chat', payload: text.trim(),
        targetId, chatId, isPublic: false,
      });
    }

    const message: Message = {
      id: packet?.id ?? genId(), senderId: profileRef.current.id, text: text.trim(),
      timestamp: Date.now(), type: 'text', status: 'sent', verified: true,
    };
    setChats(prev => {
      const updated = prev.map(c => c.id !== chatId ? c : {
        ...c, messages: [...c.messages, message], lastMessage: message, unreadCount: 0,
      });
      saveChats(updated); return updated;
    });
  }, []);

  // Пост в канал (публичный — вирусный)
  const sendChannelPost = useCallback(async (chatId: string, text: string) => {
    if (!profileRef.current || !text.trim()) return;
    const chat = chatsRef.current.find(c => c.id === chatId);
    if (!chat?.channelHash) return;

    let packet: GhostPacket | null = null;
    if (meshRef.current) {
      packet = meshRef.current.createAndSend({
        type: 'channel_post', payload: text.trim(),
        channelHash: chat.channelHash, chatId, isPublic: true,
      });
    }

    const post: Message = {
      id: packet?.id ?? genId(), senderId: profileRef.current.id, text: text.trim(),
      timestamp: Date.now(), type: 'text', status: 'sent', verified: true,
    };
    setChats(prev => {
      const updated = prev.map(c => c.id !== chatId ? c : {
        ...c, messages: [...c.messages, post], lastMessage: post, unreadCount: 0,
      });
      saveChats(updated); return updated;
    });
  }, []);

  const getOrCreateDirectChat = useCallback(async (contactId: string): Promise<Chat> => {
    if (!profileRef.current) throw new Error('No profile');
    const existing = chatsRef.current.find(c =>
      c.type === 'direct' && c.participants.includes(contactId) && c.participants.includes(profileRef.current!.id)
    );
    if (existing) return existing;
    const contact = contactsRef.current.find(c => c.id === contactId);
    const chat: Chat = {
      id: genId(), type: 'direct', name: contact?.name ?? 'Contact',
      avatar: contact?.avatar ?? null, participants: [profileRef.current.id, contactId],
      unreadCount: 0, createdAt: Date.now(), messages: [],
    };
    const updated = [...chatsRef.current, chat];
    setChats(updated); await saveChats(updated);
    return chat;
  }, []);

  const createGroupChat = useCallback(async (name: string, participantIds: string[], description?: string): Promise<Chat> => {
    if (!profileRef.current) throw new Error('No profile');
    const systemMsg: Message = {
      id: genId(), senderId: 'system', text: `${profileRef.current.name} создал(а) группу`,
      timestamp: Date.now(), type: 'system', status: 'read',
    };
    const chat: Chat = {
      id: genId(), type: 'group', name, avatar: null,
      participants: [profileRef.current.id, ...participantIds],
      ownerId: profileRef.current.id, description,
      unreadCount: 0, createdAt: Date.now(), messages: [systemMsg], lastMessage: systemMsg,
    };
    const updated = [...chatsRef.current, chat];
    setChats(updated); await saveChats(updated);
    return chat;
  }, []);

  // Канал = уникальный хэш по создателю + имени
  const createChannel = useCallback(async (name: string, description?: string): Promise<Chat> => {
    if (!profileRef.current) throw new Error('No profile');
    const channelHash = CryptoManager.channelHash(profileRef.current.id, name);
    const chat: Chat = {
      id: genId(), type: 'channel', name, avatar: null,
      participants: [profileRef.current.id], ownerId: profileRef.current.id,
      description, channelHash,
      unreadCount: 0, createdAt: Date.now(), messages: [],
    };
    const updated = [...chatsRef.current, chat];
    setChats(updated); await saveChats(updated);
    return chat;
  }, []);

  const deleteChat = useCallback(async (chatId: string) => {
    const updated = chatsRef.current.filter(c => c.id !== chatId);
    setChats(updated); await saveChats(updated);
  }, []);

  const markAsRead = useCallback(async (chatId: string) => {
    setChats(prev => {
      const updated = prev.map(c => c.id !== chatId ? c : { ...c, unreadCount: 0 });
      saveChats(updated); return updated;
    });
  }, []);

  return (
    <AppContext.Provider value={{
      profile, contacts, chats, isProfileSetup, nearbyPeers,
      meshPeersCount, blePeersCount, packetCount, debugLogs, networkSettings,
      setupProfile, updateAvatar, updateName, updateNetworkSettings,
      addContact, removeContact, sendMessage, sendChannelPost,
      createGroupChat, createChannel, deleteChat, getOrCreateDirectChat, markAsRead,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
