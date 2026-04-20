import AsyncStorage from '@react-native-async-storage/async-storage';
import nacl from 'tweetnacl';
import { decodeBase64, decodeUTF8, encodeBase64, encodeUTF8 } from 'tweetnacl-util';

const KEY_STORAGE = '@ghost_keypair_v2';

export class CryptoManager {
  private keyPair: nacl.SignKeyPair | null = null;

  async init(): Promise<void> {
    const stored = await AsyncStorage.getItem(KEY_STORAGE);
    if (stored) {
      const { pk, sk } = JSON.parse(stored);
      this.keyPair = {
        publicKey: decodeBase64(pk),
        secretKey: decodeBase64(sk),
      };
    } else {
      this.keyPair = nacl.sign.keyPair();
      await AsyncStorage.setItem(KEY_STORAGE, JSON.stringify({
        pk: encodeBase64(this.keyPair.publicKey),
        sk: encodeBase64(this.keyPair.secretKey),
      }));
    }
  }

  getPublicKey(): string {
    if (!this.keyPair) throw new Error('CryptoManager not initialized');
    return encodeBase64(this.keyPair.publicKey);
  }

  // Подписываем строку — возвращаем base64 подписи
  sign(message: string): string {
    if (!this.keyPair) throw new Error('CryptoManager not initialized');
    const msgBytes = decodeUTF8(message);
    const signed = nacl.sign(msgBytes, this.keyPair.secretKey);
    return encodeBase64(signed);
  }

  // Проверяем подпись по публичному ключу
  verify(message: string, signatureB64: string, publicKeyB64: string): boolean {
    try {
      const publicKey = decodeBase64(publicKeyB64);
      const signed = decodeBase64(signatureB64);
      const opened = nacl.sign.open(signed, publicKey);
      if (!opened) return false;
      return encodeUTF8(opened) === message;
    } catch {
      return false;
    }
  }

  // Хэш для ID канала: берём первые 8 символов hex от суммы codepoints
  static channelHash(creatorId: string, name: string): string {
    const input = `${creatorId}::${name}::GHOST_CHANNEL`;
    let h = 5381;
    for (let i = 0; i < input.length; i++) {
      h = ((h << 5) + h) ^ input.charCodeAt(i);
      h = h >>> 0; // unsigned 32-bit
    }
    return h.toString(16).toUpperCase().padStart(8, '0');
  }

  // Генерация UUID для пакетов
  static genPacketId(): string {
    const arr = new Uint8Array(16);
    for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    arr[6] = (arr[6] & 0x0f) | 0x40;
    arr[8] = (arr[8] & 0x3f) | 0x80;
    const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
}
