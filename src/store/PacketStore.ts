import * as SQLite from 'expo-sqlite';
import { GhostPacket } from '../mesh/GhostProtocol';

const DB_NAME = 'ghost_v2.db';

export class PacketStore {
  private db: SQLite.SQLiteDatabase;

  constructor() {
    this.db = SQLite.openDatabaseSync(DB_NAME);
    this.initSchema();
    this.cleanup();
  }

  private initSchema() {
    this.db.execSync(`
      CREATE TABLE IF NOT EXISTS packets (
        id      TEXT PRIMARY KEY,
        data    TEXT NOT NULL,
        target  TEXT,
        channel TEXT,
        sender  TEXT,
        ts      INTEGER,
        ttl     INTEGER,
        exp     INTEGER,
        seen    INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_packets_target  ON packets(target);
      CREATE INDEX IF NOT EXISTS idx_packets_channel ON packets(channel);
      CREATE INDEX IF NOT EXISTS idx_packets_exp     ON packets(exp);
    `);
  }

  // Сохраняем пакет — возвращает true если пакет был новым
  store(p: GhostPacket): boolean {
    if (this.has(p.id)) return false;
    if (p.exp < Date.now()) return false;
    this.db.runSync(
      `INSERT OR IGNORE INTO packets (id, data, target, channel, sender, ts, ttl, exp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, JSON.stringify(p), p.targetId ?? null, p.channelHash ?? null,
       p.senderId, p.ts, p.ttl, p.exp]
    );
    return true;
  }

  has(id: string): boolean {
    const r = this.db.getFirstSync<{ c: number }>(
      'SELECT COUNT(*) as c FROM packets WHERE id = ?', [id]
    );
    return (r?.c ?? 0) > 0;
  }

  // Все ID пакетов которые у нас есть (для sync_req)
  getAllIds(): string[] {
    return this.db
      .getAllSync<{ id: string }>('SELECT id FROM packets WHERE exp > ?', [Date.now()])
      .map(r => r.id);
  }

  // Пакеты которых нет в knownIds — то что отдадим пиру
  getMissingFrom(knownIds: string[]): GhostPacket[] {
    const all = this.db.getAllSync<{ id: string; data: string }>(
      'SELECT id, data FROM packets WHERE exp > ? AND ttl > 0', [Date.now()]
    );
    const known = new Set(knownIds);
    return all.filter(r => !known.has(r.id)).map(r => JSON.parse(r.data));
  }

  // Пакеты для конкретного получателя (личка / группа)
  forTarget(targetId: string): GhostPacket[] {
    return this.db
      .getAllSync<{ data: string }>(
        'SELECT data FROM packets WHERE target = ? AND exp > ? ORDER BY ts DESC LIMIT 200',
        [targetId, Date.now()]
      )
      .map(r => JSON.parse(r.data));
  }

  // Пакеты канала
  forChannel(channelHash: string): GhostPacket[] {
    return this.db
      .getAllSync<{ data: string }>(
        'SELECT data FROM packets WHERE channel = ? AND exp > ? ORDER BY ts DESC LIMIT 100',
        [channelHash, Date.now()]
      )
      .map(r => JSON.parse(r.data));
  }

  // Все публичные пакеты (посты каналов) — для gossip-рассылки
  getAllPublic(): GhostPacket[] {
    return this.db
      .getAllSync<{ data: string }>(
        'SELECT data FROM packets WHERE channel IS NOT NULL AND exp > ? ORDER BY ts DESC LIMIT 50',
        [Date.now()]
      )
      .map(r => JSON.parse(r.data));
  }

  count(): number {
    return this.db.getFirstSync<{ c: number }>(
      'SELECT COUNT(*) as c FROM packets WHERE exp > ?', [Date.now()]
    )?.c ?? 0;
  }

  // Удаляем просроченные пакеты
  cleanup() {
    this.db.runSync('DELETE FROM packets WHERE exp < ?', [Date.now()]);
  }
}
