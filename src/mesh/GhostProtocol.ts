export const GHOST_VERSION = 2;
export const DEFAULT_TTL = 8;
export const PACKET_EXPIRY_DAYS = 7;
export const GHOST_BLE_SERVICE_UUID = '0000AA10-0000-1000-8000-00805F9B34FB';
export const UDP_PORT = 7645;
export const TCP_PORT = 7646;
export const BROADCAST_INTERVAL = 4000;
export const PEER_TIMEOUT = 15000;
export const PUBLIC_FEED = 'PUBLIC_FEED';

// Полный пакет GHOST — именно он передаётся между устройствами
export interface GhostPacket {
  id: string;              // UUID пакета
  v: number;               // версия протокола
  type: 'chat' | 'channel_post';
  senderId: string;
  senderName: string;
  senderCode: string;
  senderPubKey: string;    // Ed25519 публичный ключ (base64)
  targetId?: string;       // ID получателя (личка / группа)
  channelHash?: string;    // Хэш канала (для channel_post)
  isPublic: boolean;       // true = канал (все хранят и пересылают)
  chatId?: string;         // ID чата в UI
  payload: string;         // Текст сообщения
  sig: string;             // Ed25519 подпись
  ts: number;              // Timestamp создания
  ttl: number;             // Оставшиеся прыжки
  path: string[];          // Путь (для дедупликации)
  exp: number;             // Время смерти пакета
}

// Запрос синхронизации — «вот что я знаю»
export interface SyncRequest {
  type: 'sync_req';
  deviceId: string;
  knownIds: string[];
}

// Ответ синхронизации — «вот чего у тебя нет»
export interface SyncResponse {
  type: 'sync_resp';
  packets: GhostPacket[];
}

// Announce-пакет (UDP broadcast, не GhostPacket)
export interface AnnouncePacket {
  type: 'announce';
  id: string;
  name: string;
  userCode: string;
  pubKey: string;
  stealth?: boolean;
}

export type NetworkMode = 'wifi' | 'ble' | 'auto';

export interface NetworkSettings {
  mode: NetworkMode;
  stealth: boolean;      // Только приём, без отправки своего ID
  transitNode: boolean;  // Пересылать чужие пакеты (transit relay)
}

// Данные для подписи: детерминированная строка из полей пакета
export function signData(p: Omit<GhostPacket, 'sig'>): string {
  return [p.id, p.senderId, p.targetId ?? '', p.channelHash ?? '', p.payload, p.ts].join('|');
}
