/**
 * GHOST BLE Mesh — Dual Role Engine
 * Устройство работает одновременно:
 *   Peripheral (сервер): объявляет GHOST сервис, принимает пакеты через WRITE
 *   Central (клиент): сканирует эфир, коннектится к найденным GHOST-устройствам
 *
 * Протокол обмена (поверх BLE GATT):
 *   1. Central находит Peripheral → коннектится
 *   2. Central пишет sync_req (список своих packet ID) в WRITE char
 *   3. Peripheral отвечает через NOTIFY (пакеты которых нет у Central)
 *   4. После синхронизации Central пишет свои новые пакеты в WRITE char
 *
 * Фрагментация: пакеты разбиваются на чанки по MAX_CHUNK байт
 *   Формат чанка: {"m":"<msgId>","s":<seq>,"t":<total>,"d":"<base64>"}
 */

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { GhostPacket } from './GhostProtocol';
import { PacketStore } from '../store/PacketStore';

export const GHOST_SERVICE_UUID = '0000AA10-0000-1000-8000-00805F9B34FB';
export const MESSAGE_CHAR_UUID  = '0000AA11-0000-1000-8000-00805F9B34FB';
export const DEVICE_NAME_PREFIX = 'GHOST';

const MAX_CHUNK = 180; // байт (безопасно для BLE 4.2+)
const SYNC_INTERVAL_MS = 18_000;
const MAX_BLE_CONNECTIONS = 3;

export interface BLEPeer {
  id: string;           // MAC / peripheral ID
  name: string;
  rssi: number;
  lastSeen: number;
  connected: boolean;
}

export type BLEEvent =
  | { type: 'peer_found'; peer: BLEPeer }
  | { type: 'peer_lost'; id: string }
  | { type: 'synced'; peerId: string; sent: number; received: number }
  | { type: 'error'; msg: string }
  | { type: 'log'; msg: string };

export class BLEMesh {
  private ble: any = null;
  private emitter: NativeEventEmitter | null = null;
  private listeners: Array<{ remove: () => void }> = [];

  private peers = new Map<string, BLEPeer>();
  private connected = new Set<string>();
  private inboundChunks = new Map<string, Map<number, string>>(); // msgId → {seq → base64}
  private inboundMeta = new Map<string, number>();               // msgId → totalChunks
  private pendingMessages = new Map<string, string[]>();          // peerId → reassembled JSON

  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  public onEvent?: (e: BLEEvent) => void;
  public onPacket?: (p: GhostPacket) => void;

  private store: PacketStore;
  private deviceId: string;
  private deviceName: string;

  constructor(store: PacketStore, deviceId: string, deviceName: string) {
    this.store = store;
    this.deviceId = deviceId;
    this.deviceName = deviceName;
  }

  // ─────────────────────────────────────────────
  // Старт
  // ─────────────────────────────────────────────
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const BleManager = require('react-native-ble-manager').default;
      this.ble = BleManager;
      const { BleManager: BleManagerModule } = NativeModules;
      this.emitter = new NativeEventEmitter(BleManagerModule);

      await BleManager.start({ showAlert: false, forceLegacy: false });
      this.emit('log', 'BLE инициализирован');

      this.subscribeToEvents();

      // Запускаем GATT сервер (Peripheral role)
      await this.startPeripheral();

      // Запускаем сканирование (Central role)
      this.startScanning();

      // Периодическая синхронизация с подключёнными пирами
      this.syncTimer = setInterval(() => this.syncAllConnected(), SYNC_INTERVAL_MS);
    } catch (e: any) {
      this.emit('error', `BLE старт: ${e?.message}`);
    }
  }

  // ─────────────────────────────────────────────
  // Peripheral mode (GATT Server + Advertising)
  // ─────────────────────────────────────────────
  private async startPeripheral(): Promise<void> {
    if (!this.ble || Platform.OS !== 'android') return;
    try {
      // Создаём GATT сервис с характеристикой для записи и уведомлений
      await this.ble.createBond?.(); // ignore if not available

      // Peripheral mode API react-native-ble-manager v12 (Android)
      if (typeof this.ble.startPeripheral === 'function') {
        await this.ble.startPeripheral();
        // Добавляем сервис
        // properties: 0x08 = WRITE, 0x10 = NOTIFY, 0x18 = WRITE+NOTIFY
        // permissions: 0x10 = WRITE
        await this.ble.addService(GHOST_SERVICE_UUID, true);
        await this.ble.addCharacteristic(
          GHOST_SERVICE_UUID, MESSAGE_CHAR_UUID,
          0x18, // WRITE | NOTIFY
          0x10  // WRITE permission
        );
        await this.ble.startAdvertising({
          serviceUUIDs: [GHOST_SERVICE_UUID],
          localName: `${DEVICE_NAME_PREFIX}:${this.deviceId.slice(-6)}`,
        });
        this.emit('log', 'BLE Peripheral: рекламируем GHOST сервис');
      } else {
        // Fallback: используем альтернативный путь через enableBluetooth + advertise
        this.emit('log', 'BLE: Peripheral API недоступен, только Central mode');
      }
    } catch (e: any) {
      this.emit('log', `BLE Peripheral: ${e?.message ?? 'нет поддержки на устройстве'}`);
    }
  }

  // ─────────────────────────────────────────────
  // Подписка на BLE события
  // ─────────────────────────────────────────────
  private subscribeToEvents(): void {
    if (!this.emitter) return;

    // Найдено новое BLE устройство
    this.listeners.push(
      this.emitter.addListener('BleManagerDiscoverPeripheral', (p: any) => {
        const isGhost = p.name?.startsWith(DEVICE_NAME_PREFIX) ||
          p.advertising?.serviceUUIDs?.includes(GHOST_SERVICE_UUID) ||
          p.advertising?.serviceUUIDs?.some((u: string) => u.toUpperCase() === GHOST_SERVICE_UUID.toUpperCase());

        if (!isGhost) return;

        const peer: BLEPeer = {
          id: p.id, name: p.name ?? `GHOST_${p.id.slice(-4)}`,
          rssi: p.rssi ?? -80, lastSeen: Date.now(), connected: false,
        };
        const existed = this.peers.has(p.id);
        this.peers.set(p.id, peer);

        if (!existed) {
          this.emit('log', `BLE найден: ${peer.name} (RSSI ${peer.rssi})`);
          this.onEvent?.({ type: 'peer_found', peer });
          // Подключаемся и синхронизируемся
          if (this.connected.size < MAX_BLE_CONNECTIONS) {
            setTimeout(() => this.connectAndSync(peer.id), 500);
          }
        } else {
          const existing = this.peers.get(p.id)!;
          existing.lastSeen = Date.now();
          existing.rssi = peer.rssi;
        }
      })
    );

    // Устройство отключилось
    this.listeners.push(
      this.emitter.addListener('BleManagerDisconnectPeripheral', ({ peripheral }: any) => {
        this.connected.delete(peripheral);
        const peer = this.peers.get(peripheral);
        if (peer) {
          peer.connected = false;
          this.emit('log', `BLE отключён: ${peer.name}`);
          this.onEvent?.({ type: 'peer_lost', id: peripheral });
        }
      })
    );

    // Данные от удалённого периферала (NOTIFY)
    this.listeners.push(
      this.emitter.addListener('BleManagerDidUpdateValueForCharacteristic', ({ peripheral, characteristic, value }: any) => {
        if (characteristic?.toUpperCase() !== MESSAGE_CHAR_UUID.toUpperCase()) return;
        const bytes: number[] = Array.isArray(value) ? value : Object.values(value);
        this.processIncomingBytes(peripheral, bytes);
      })
    );

    // Данные от Central → нам (Peripheral mode: Central написал в нашу характеристику)
    this.listeners.push(
      this.emitter.addListener('BleManagerDidReceiveDataFromPeripheral', ({ characteristic, value }: any) => {
        if (characteristic?.toUpperCase() !== MESSAGE_CHAR_UUID.toUpperCase()) return;
        const bytes: number[] = Array.isArray(value) ? value : Object.values(value);
        this.processIncomingBytes('_server_', bytes);
      })
    );
  }

  // ─────────────────────────────────────────────
  // Сканирование (Central mode)
  // ─────────────────────────────────────────────
  private startScanning(): void {
    const scan = () => {
      if (!this.running || !this.ble) return;
      this.ble.scan([GHOST_SERVICE_UUID], 8, true).catch(() => {});
    };
    scan();
    this.scanTimer = setInterval(scan, 20_000);
  }

  // ─────────────────────────────────────────────
  // Подключение + синхронизация пакетов
  // ─────────────────────────────────────────────
  private async connectAndSync(peripheralId: string): Promise<void> {
    if (!this.ble || this.connected.has(peripheralId)) return;
    try {
      this.emit('log', `BLE → подключаемся к ${peripheralId.slice(-8)}`);
      await this.ble.connect(peripheralId);
      this.connected.add(peripheralId);

      const peer = this.peers.get(peripheralId);
      if (peer) peer.connected = true;

      // Получаем список сервисов
      await this.ble.retrieveServices(peripheralId, [GHOST_SERVICE_UUID]);

      // Подписываемся на уведомления (Peripheral → нам)
      await this.ble.startNotification(peripheralId, GHOST_SERVICE_UUID, MESSAGE_CHAR_UUID);

      // Отправляем sync_req: список наших packet ID
      const myIds = this.store.getAllIds();
      const syncReq = JSON.stringify({ type: 'sync_req', knownIds: myIds, deviceId: this.deviceId });
      await this.sendChunked(peripheralId, syncReq);
      this.emit('log', `BLE sync_req → ${peripheralId.slice(-8)} (у нас ${myIds.length} пакетов)`);

      // Ждём ответа (NOTIFY) — он придёт в BleManagerDidUpdateValueForCharacteristic
      // После ответа отключаемся через 30с
      setTimeout(() => this.gracefulDisconnect(peripheralId), 30_000);
    } catch (e: any) {
      this.emit('log', `BLE connect ошибка: ${e?.message}`);
      this.connected.delete(peripheralId);
    }
  }

  private async gracefulDisconnect(peripheralId: string): Promise<void> {
    try {
      await this.ble?.stopNotification(peripheralId, GHOST_SERVICE_UUID, MESSAGE_CHAR_UUID);
      await this.ble?.disconnect(peripheralId);
    } catch {}
    this.connected.delete(peripheralId);
  }

  // Переодически синхронизируем со всеми подключёнными пирами
  private async syncAllConnected(): Promise<void> {
    for (const peerId of this.connected) {
      try {
        const myIds = this.store.getAllIds();
        const syncReq = JSON.stringify({ type: 'sync_req', knownIds: myIds, deviceId: this.deviceId });
        await this.sendChunked(peerId, syncReq);
      } catch {}
    }
  }

  // ─────────────────────────────────────────────
  // Фрагментация и сборка (BLE MTU ограничен)
  // ─────────────────────────────────────────────
  private async sendChunked(peripheralId: string, json: string): Promise<void> {
    if (!this.ble) return;
    const msgId = Math.random().toString(36).slice(2, 10);
    // Разбиваем на чанки по MAX_CHUNK символов (base64 экономит ~25% места)
    const chunks: string[] = [];
    for (let i = 0; i < json.length; i += MAX_CHUNK * 3 / 4 | 0) {
      chunks.push(btoa(json.slice(i, i + (MAX_CHUNK * 3 / 4 | 0))));
    }

    for (let s = 0; s < chunks.length; s++) {
      const frame = JSON.stringify({ m: msgId, s, t: chunks.length, d: chunks[s] });
      const bytes = Array.from(frame).map(c => c.charCodeAt(0));
      try {
        await this.ble.writeWithoutResponse(
          peripheralId, GHOST_SERVICE_UUID, MESSAGE_CHAR_UUID, bytes
        );
      } catch {}
      // Небольшая задержка между чанками (BLE не любит спам)
      if (chunks.length > 1) await delay(30);
    }
  }

  // Отправляем ответ через NOTIFY (мы — Peripheral, центральный подписан)
  private async sendNotify(json: string): Promise<void> {
    if (!this.ble || typeof this.ble.sendDataToPeripheral !== 'function') return;
    const msgId = Math.random().toString(36).slice(2, 10);
    for (let i = 0; i < json.length; i += MAX_CHUNK * 3 / 4 | 0) {
      const chunk = btoa(json.slice(i, i + (MAX_CHUNK * 3 / 4 | 0)));
      const frame = JSON.stringify({ m: msgId, s: i === 0 ? 0 : Math.ceil(i / (MAX_CHUNK * 3 / 4)), t: Math.ceil(json.length / (MAX_CHUNK * 3 / 4)), d: chunk });
      const bytes = Array.from(frame).map(c => c.charCodeAt(0));
      try {
        await this.ble.sendDataToPeripheral(MESSAGE_CHAR_UUID, bytes);
      } catch {}
      if (json.length > MAX_CHUNK * 3 / 4) await delay(30);
    }
  }

  // ─────────────────────────────────────────────
  // Обработка входящих байт (с учётом фрагментации)
  // ─────────────────────────────────────────────
  private processIncomingBytes(peerId: string, bytes: number[]): void {
    try {
      const str = bytes.map(b => String.fromCharCode(b)).join('');
      const frame = JSON.parse(str);
      const { m: msgId, s: seq, t: total, d: dataB64 } = frame;

      if (!msgId || seq === undefined || !total || !dataB64) return;

      // Собираем чанки
      if (!this.inboundChunks.has(msgId)) this.inboundChunks.set(msgId, new Map());
      const chunks = this.inboundChunks.get(msgId)!;
      chunks.set(seq, dataB64);
      this.inboundMeta.set(msgId, total);

      // Все чанки получены?
      if (chunks.size >= total) {
        let json = '';
        for (let i = 0; i < total; i++) {
          json += atob(chunks.get(i) ?? '');
        }
        this.inboundChunks.delete(msgId);
        this.inboundMeta.delete(msgId);
        this.processMessage(peerId, json);
      }
    } catch {}
  }

  // ─────────────────────────────────────────────
  // Обработка собранного сообщения от пира
  // ─────────────────────────────────────────────
  private async processMessage(peerId: string, json: string): Promise<void> {
    try {
      const msg = JSON.parse(json);

      if (msg.type === 'sync_req') {
        // Пир прислал свои ID — отдаём то чего у него нет
        const missing = this.store.getMissingFrom(msg.knownIds ?? []);
        if (missing.length > 0) {
          this.emit('log', `BLE sync_resp → ${peerId.slice(-8)}: ${missing.length} пакетов`);
          const resp = JSON.stringify({ type: 'sync_resp', packets: missing });
          if (peerId === '_server_') {
            await this.sendNotify(resp);
          } else {
            await this.sendChunked(peerId, resp);
          }
        }
        // Также запрашиваем у них то чего нет у нас
        const myIds = this.store.getAllIds();
        const req = JSON.stringify({ type: 'sync_req', knownIds: myIds, deviceId: this.deviceId });
        if (peerId === '_server_') {
          await this.sendNotify(req);
        }

      } else if (msg.type === 'sync_resp') {
        // Получили пакеты
        let newCount = 0;
        let channelCount = 0;
        for (const p of (msg.packets as GhostPacket[])) {
          const isNew = this.store.store(p);
          if (isNew) {
            newCount++;
            this.onPacket?.(p);
            if (p.isPublic) channelCount++;
          }
        }
        this.emit('log', `BLE получено: ${newCount} новых (${channelCount} канальных)`);
        this.onEvent?.({ type: 'synced', peerId, sent: 0, received: newCount });
      }
    } catch (e: any) {
      this.emit('log', `BLE processMsg: ${e?.message}`);
    }
  }

  // ─────────────────────────────────────────────
  // Прямая отправка пакета в конкретное BLE устройство
  // ─────────────────────────────────────────────
  async sendPacket(peripheralId: string, packet: GhostPacket): Promise<void> {
    const json = JSON.stringify({ type: 'sync_resp', packets: [packet] });
    await this.sendChunked(peripheralId, json);
  }

  // ─────────────────────────────────────────────
  // Gossip: рассылаем PUBLIC пакеты (каналы) ВСЕМ BLE пирам
  // ─────────────────────────────────────────────
  async gossipPublicPackets(): Promise<void> {
    const publicPackets = this.store.getAllPublic();
    if (publicPackets.length === 0) return;

    for (const peerId of this.connected) {
      try {
        const json = JSON.stringify({ type: 'sync_resp', packets: publicPackets });
        await this.sendChunked(peerId, json);
        this.emit('log', `BLE gossip → ${peerId.slice(-8)}: ${publicPackets.length} публичных`);
      } catch {}
    }
  }

  // ─────────────────────────────────────────────
  getConnectedCount(): number { return this.connected.size; }
  getPeers(): BLEPeer[] { return Array.from(this.peers.values()); }
  getPeerCount(): number { return this.peers.size; }

  private emit(type: 'log' | 'error', msg: string) {
    this.onEvent?.({ type, msg });
  }

  stop(): void {
    this.running = false;
    if (this.scanTimer) clearInterval(this.scanTimer);
    if (this.syncTimer) clearInterval(this.syncTimer);
    for (const l of this.listeners) l.remove();
    try { this.ble?.stopScan(); } catch {}
    try { this.ble?.stopAdvertising?.(); } catch {}
    for (const id of this.connected) {
      try { this.ble?.disconnect(id); } catch {}
    }
    this.connected.clear();
    this.peers.clear();
    this.listeners = [];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
