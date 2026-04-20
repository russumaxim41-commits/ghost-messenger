import {
  BROADCAST_INTERVAL,
  DEFAULT_TTL,
  GhostPacket,
  NetworkSettings,
  PACKET_EXPIRY_DAYS,
  PEER_TIMEOUT,
  SyncRequest,
  SyncResponse,
  TCP_PORT,
  UDP_PORT,
  signData,
} from './GhostProtocol';
import { PacketStore } from '../store/PacketStore';
import { CryptoManager } from '../crypto/CryptoManager';
import { BLEMesh } from './BLEMesh';
import { ForegroundService } from '../services/ForegroundService';

// ─── BLE threshold: пакеты > LARGE_PACKET_BYTES используют WiFi ───
const LARGE_PACKET_BYTES = 20_000; // 20 КБ

export interface MeshPeer {
  id: string;
  name: string;
  userCode: string;
  ip: string;
  port: number;
  lastSeen: number;
  transport: 'wifi' | 'ble';
}

export type DebugEvent = {
  time: number;
  kind: 'peer_found' | 'peer_lost' | 'msg_in' | 'msg_out' | 'relay' | 'sync' | 'ble' | 'info';
  detail: string;
};

export class MeshNetwork {
  private deviceId: string;
  private deviceName: string;
  private userCode: string;
  private localIp = '';
  private broadcastAddrs: string[] = ['255.255.255.255'];

  private tcpServer: any = null;
  private udpSocket: any = null;
  private bleMesh: BLEMesh | null = null;

  private wifiPeers = new Map<string, MeshPeer>();
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private fgUpdateTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  public settings: NetworkSettings;
  public packetStore: PacketStore;
  public crypto: CryptoManager;

  public onPacket?: (p: GhostPacket) => void;
  public onPeerDiscovered?: (peer: MeshPeer) => void;
  public onPeerLost?: (peerId: string) => void;
  public onDebug?: (e: DebugEvent) => void;
  public onBLEPeer?: (count: number) => void;

  constructor(
    deviceId: string,
    deviceName: string,
    userCode: string,
    store: PacketStore,
    crypto: CryptoManager,
    settings: NetworkSettings,
  ) {
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.userCode = userCode;
    this.packetStore = store;
    this.crypto = crypto;
    this.settings = { ...settings };
  }

  private dbg(kind: DebugEvent['kind'], detail: string) {
    this.onDebug?.({ time: Date.now(), kind, detail });
  }

  // ─────────────────────────────────────────────
  // Запуск всей mesh-сети
  // ─────────────────────────────────────────────
  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // 1. Запускаем Android Foreground Service (чтобы OS не убила процесс)
    await ForegroundService.start(
      'GHOST Mesh',
      'Инициализация mesh-сети...',
    );

    // 2. Определяем IP в WiFi
    await this.detectLocalIp();

    // 3. TCP сервер для обмена пакетами
    this.startTcpServer();

    const useWifi = this.settings.mode === 'wifi' || this.settings.mode === 'auto';
    const useBle = this.settings.mode === 'ble' || this.settings.mode === 'auto';

    // 4. WiFi UDP Discovery
    if (useWifi) this.startUdpDiscovery();

    // 5. BLE Dual Role (GATT Server + Central)
    if (useBle) await this.startBLEMesh();

    // 6. Периодическая очистка
    this.cleanupTimer = setInterval(() => {
      this.packetStore.cleanup();
      this.cleanupPeers();
    }, 3_600_000);

    // 7. Обновляем notification каждые 30с
    this.fgUpdateTimer = setInterval(() => {
      const wc = this.wifiPeers.size;
      const bc = this.bleMesh?.getPeerCount() ?? 0;
      const pc = this.packetStore.count();
      ForegroundService.update(`WiFi: ${wc} · BLE: ${bc} · Пакетов: ${pc}`);
      this.onBLEPeer?.(bc);
    }, 30_000);

    ForegroundService.update('Сеть активна. Поиск устройств...');
    this.dbg('info', 'GHOST Mesh v2 запущен');
  }

  // ─────────────────────────────────────────────
  // WiFi IP
  // ─────────────────────────────────────────────
  private async detectLocalIp(): Promise<void> {
    try {
      const NetInfo = require('@react-native-community/netinfo');
      const state = await NetInfo.default.fetch();
      if (state.type === 'wifi' && state.details?.ipAddress) {
        this.localIp = state.details.ipAddress;
        const parts = this.localIp.split('.');
        if (parts.length === 4) {
          this.broadcastAddrs = [
            `${parts[0]}.${parts[1]}.${parts[2]}.255`,
            '255.255.255.255',
          ];
        }
        this.dbg('info', `WiFi IP: ${this.localIp}`);
      }
    } catch {
      this.dbg('info', 'NetInfo недоступен → 255.255.255.255');
    }
  }

  // ─────────────────────────────────────────────
  // TCP Сервер
  // ─────────────────────────────────────────────
  private startTcpServer() {
    try {
      const Tcp = require('react-native-tcp-socket');
      this.tcpServer = Tcp.createServer((socket: any) => {
        let buf = '';
        socket.on('data', (raw: any) => {
          buf += typeof raw === 'string' ? raw : raw.toString('utf8');
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try { this.handleTcpMessage(JSON.parse(line), socket); } catch {}
          }
        });
        socket.on('error', () => {});
        socket.on('close', () => {});
      });
      this.tcpServer.listen({ port: TCP_PORT, host: '0.0.0.0' }, () => {
        this.dbg('info', `TCP сервер на :${TCP_PORT}`);
      });
      this.tcpServer.on('error', () => {});
    } catch (e: any) {
      this.dbg('info', `TCP: ${e?.message}`);
    }
  }

  private handleTcpMessage(msg: any, socket: any) {
    if (!msg?.type) return;
    if (msg.type === 'chat' || msg.type === 'channel_post') {
      this.receivePacket(msg as GhostPacket);
    } else if (msg.type === 'sync_req') {
      const req = msg as SyncRequest;
      const missing = this.packetStore.getMissingFrom(req.knownIds);
      if (missing.length > 0) {
        this.dbg('sync', `→ ${req.deviceId}: отдаём ${missing.length} пакетов`);
        const resp: SyncResponse = { type: 'sync_resp', packets: missing };
        try { socket.write(JSON.stringify(resp) + '\n'); } catch {}
      }
    } else if (msg.type === 'sync_resp') {
      let newCount = 0;
      for (const p of (msg as SyncResponse).packets) {
        if (this.receivePacket(p)) newCount++;
      }
      if (newCount > 0) this.dbg('sync', `← получили ${newCount} новых`);
    }
  }

  // ─────────────────────────────────────────────
  // Входящий GhostPacket
  // ─────────────────────────────────────────────
  private receivePacket(p: GhostPacket): boolean {
    if (this.packetStore.has(p.id)) return false;
    if (p.exp < Date.now()) return false;

    // Проверяем Ed25519 подпись
    if (p.senderPubKey && p.sig) {
      const { sig: _s, ...pNoSig } = p;
      const valid = this.crypto.verify(signData(pNoSig), p.sig, p.senderPubKey);
      if (!valid) {
        this.dbg('info', `❌ Неверная подпись от ${p.senderName}`);
        return false;
      }
    }

    this.packetStore.store(p);
    this.dbg('msg_in', `${p.senderName}: ${p.payload.slice(0, 60)}`);
    this.onPacket?.(p);

    // Транзитный узел: пересылаем дальше (WiFi)
    if (this.settings.transitNode && p.ttl > 1 && !p.path.includes(this.deviceId)) {
      this.relayPacketWifi(p);
    }
    return true;
  }

  private relayPacketWifi(p: GhostPacket) {
    const relayed: GhostPacket = { ...p, path: [...p.path, this.deviceId], ttl: p.ttl - 1 };
    for (const peer of this.wifiPeers.values()) {
      if (!relayed.path.includes(peer.id)) {
        this.dbg('relay', `→ ${peer.name} (ttl=${relayed.ttl})`);
        this.sendTcp(peer.ip, peer.port, relayed);
      }
    }
  }

  // ─────────────────────────────────────────────
  // UDP Discovery (WiFi)
  // ─────────────────────────────────────────────
  private startUdpDiscovery() {
    try {
      const dgram = require('react-native-udp');
      this.udpSocket = dgram.createSocket({ type: 'udp4', reusePort: true });
      this.udpSocket.bind(UDP_PORT, () => {
        try { this.udpSocket.setBroadcast(true); } catch {}
        this.dbg('info', `UDP на :${UDP_PORT}`);
      });

      this.udpSocket.on('message', (raw: any, rinfo: { address: string }) => {
        if (this.localIp && rinfo.address === this.localIp) return;
        try {
          const ann = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
          if (ann.type === 'announce' && ann.id !== this.deviceId) {
            const existed = this.wifiPeers.has(ann.id);
            const peer: MeshPeer = {
              id: ann.id, name: ann.name, userCode: ann.userCode,
              ip: rinfo.address, port: TCP_PORT,
              lastSeen: Date.now(), transport: 'wifi',
            };
            this.wifiPeers.set(peer.id, peer);
            if (!existed) {
              this.dbg('peer_found', `${peer.name} (${peer.userCode}) @ ${rinfo.address}`);
              this.onPeerDiscovered?.(peer);
              setTimeout(() => this.syncWifi(peer), 600);
            } else {
              this.wifiPeers.get(ann.id)!.lastSeen = Date.now();
            }
          }
        } catch {}
      });
      this.udpSocket.on('error', () => {});

      const announce = () => {
        if (!this.running || this.settings.stealth) return;
        try {
          const payload = JSON.stringify({
            type: 'announce', id: this.deviceId,
            name: this.deviceName, userCode: this.userCode,
            pubKey: this.crypto.getPublicKey(),
          });
          for (const addr of this.broadcastAddrs) {
            try { this.udpSocket.send(payload, 0, payload.length, UDP_PORT, addr, () => {}); } catch {}
          }
        } catch {}
      };
      setTimeout(announce, 400);
      this.broadcastTimer = setInterval(announce, BROADCAST_INTERVAL);
    } catch (e: any) {
      this.dbg('info', `UDP: ${e?.message}`);
    }
  }

  private syncWifi(peer: MeshPeer) {
    if (!this.running) return;
    const myIds = this.packetStore.getAllIds();
    const req: SyncRequest = { type: 'sync_req', deviceId: this.deviceId, knownIds: myIds };
    this.dbg('sync', `→ ${peer.name}: sync (${myIds.length} пакетов)`);
    this.sendTcp(peer.ip, peer.port, req);
  }

  // ─────────────────────────────────────────────
  // BLE Dual Role Engine
  // ─────────────────────────────────────────────
  private async startBLEMesh() {
    const ble = new BLEMesh(this.packetStore, this.deviceId, this.deviceName);

    ble.onEvent = (event) => {
      if (event.type === 'log') {
        this.dbg('ble', event.msg);
      } else if (event.type === 'error') {
        this.dbg('info', `BLE ⚠️ ${event.msg}`);
      } else if (event.type === 'peer_found') {
        this.dbg('peer_found', `BLE: ${event.peer.name} (RSSI ${event.peer.rssi})`);
        this.onBLEPeer?.(ble.getPeerCount());
      } else if (event.type === 'peer_lost') {
        this.dbg('peer_lost', `BLE: ${event.id.slice(-8)} вышел`);
        this.onBLEPeer?.(ble.getPeerCount());
      } else if (event.type === 'synced') {
        this.dbg('sync', `BLE sync: +${event.received} пакетов от ${event.peerId.slice(-8)}`);
      }
    };

    ble.onPacket = (p: GhostPacket) => {
      if (this.packetStore.has(p.id)) return;
      this.receivePacket(p);
    };

    await ble.start();
    this.bleMesh = ble;
    this.dbg('ble', 'BLE Dual Role запущен (Peripheral + Central)');
  }

  // ─────────────────────────────────────────────
  // Автоматический выбор транспорта
  // ─────────────────────────────────────────────
  private chooseTransport(payloadSize: number): 'wifi' | 'ble' | 'both' {
    if (this.settings.mode === 'wifi') return 'wifi';
    if (this.settings.mode === 'ble') return 'ble';
    // Auto: большие пакеты (фото/файлы) → WiFi, маленькие → оба
    if (payloadSize > LARGE_PACKET_BYTES) return 'wifi';
    return 'both';
  }

  // ─────────────────────────────────────────────
  // Создание и отправка пакета
  // ─────────────────────────────────────────────
  createAndSend(params: {
    type: GhostPacket['type'];
    payload: string;
    targetId?: string;
    channelHash?: string;
    chatId?: string;
    isPublic: boolean;
  }): GhostPacket {
    const id = CryptoManager.genPacketId();
    const ts = Date.now();
    const exp = ts + PACKET_EXPIRY_DAYS * 86_400_000;

    const draft: Omit<GhostPacket, 'sig'> = {
      id, v: 2, type: params.type,
      senderId: this.deviceId, senderName: this.deviceName,
      senderCode: this.userCode, senderPubKey: this.crypto.getPublicKey(),
      targetId: params.targetId, channelHash: params.channelHash,
      chatId: params.chatId, isPublic: params.isPublic,
      payload: params.payload,
      ts, ttl: DEFAULT_TTL, path: [this.deviceId], exp,
    };

    const sig = this.crypto.sign(signData(draft));
    const packet: GhostPacket = { ...draft, sig };
    this.packetStore.store(packet);

    const payloadBytes = new TextEncoder().encode(params.payload).length;
    const transport = this.chooseTransport(payloadBytes);

    // WiFi отправка
    if (transport === 'wifi' || transport === 'both') {
      let wifiSent = 0;
      for (const peer of this.wifiPeers.values()) {
        this.sendTcp(peer.ip, peer.port, packet);
        wifiSent++;
      }
      this.dbg('msg_out', `WiFi → ${wifiSent} пирам: ${params.payload.slice(0, 50)}`);
    }

    // BLE отправка (только маленькие пакеты / auto режим)
    if ((transport === 'ble' || transport === 'both') && this.bleMesh) {
      if (params.isPublic) {
        // Каналы: gossip ко всем BLE пирам
        this.bleMesh.gossipPublicPackets().catch(() => {});
      }
      this.dbg('msg_out', `BLE gossip: ${this.bleMesh.getConnectedCount()} BLE пиров`);
    }

    return packet;
  }

  // ─────────────────────────────────────────────
  // TCP отправка
  // ─────────────────────────────────────────────
  private sendTcp(ip: string, port: number, data: object) {
    try {
      const Tcp = require('react-native-tcp-socket');
      const client = Tcp.createConnection({ port, host: ip, timeout: 6000 }, () => {
        try {
          client.write(JSON.stringify(data) + '\n');
          setTimeout(() => { try { client.destroy(); } catch {} }, 5000);
        } catch {}
      });
      client.on('timeout', () => { try { client.destroy(); } catch {} });
      client.on('error', () => { try { client.destroy(); } catch {} });
    } catch {}
  }

  // ─────────────────────────────────────────────
  // Очистка
  // ─────────────────────────────────────────────
  private cleanupPeers() {
    const now = Date.now();
    for (const [id, peer] of this.wifiPeers) {
      if (now - peer.lastSeen > PEER_TIMEOUT) {
        this.wifiPeers.delete(id);
        this.dbg('peer_lost', `${peer.name} — вышел`);
        this.onPeerLost?.(id);
      }
    }
  }

  updateSettings(s: Partial<NetworkSettings>) {
    this.settings = { ...this.settings, ...s };
  }

  getWifiPeers(): MeshPeer[] { return Array.from(this.wifiPeers.values()); }
  getWifiPeerCount(): number { return this.wifiPeers.size; }
  getBLEPeerCount(): number { return this.bleMesh?.getPeerCount() ?? 0; }

  stop() {
    this.running = false;
    if (this.broadcastTimer) clearInterval(this.broadcastTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.fgUpdateTimer) clearInterval(this.fgUpdateTimer);
    try { this.tcpServer?.close(); } catch {}
    try { this.udpSocket?.close(); } catch {}
    this.bleMesh?.stop();
    this.wifiPeers.clear();
    ForegroundService.stop().catch(() => {});
  }
}
