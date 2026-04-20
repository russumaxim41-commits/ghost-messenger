/**
 * GHOST Foreground Service — Android
 * Держит процесс живым в фоне (даже при заблокированном экране).
 * Без него Android убивает приложение через ~10 мин.
 *
 * Использует @supersami/rn-foreground-service
 * Разрешение: android.permission.FOREGROUND_SERVICE
 */

import { Platform } from 'react-native';

const NOTIF_ID = 1001;
const CHANNEL_ID = 'ghost_mesh_channel';

let _running = false;
let _FGService: any = null;

function getService() {
  if (!_FGService) {
    try {
      _FGService = require('@supersami/rn-foreground-service').default;
    } catch {
      _FGService = null;
    }
  }
  return _FGService;
}

export const ForegroundService = {
  /**
   * Запускает foreground service с уведомлением.
   * После этого Android не сможет убить процесс.
   */
  async start(title = 'GHOST Mesh', text = 'Сеть активна. Поиск устройств...') {
    if (Platform.OS !== 'android') return;
    if (_running) return;

    const svc = getService();
    if (!svc) {
      console.warn('[FGService] @supersami/rn-foreground-service не загружен');
      return;
    }

    try {
      // Создаём notification channel (Android 8+)
      await svc.createNotificationChannel({
        id: CHANNEL_ID,
        name: 'GHOST Mesh Network',
        description: 'GHOST работает в фоне и обнаруживает устройства рядом',
        enableVibration: false,
        importance: 2, // IMPORTANCE_LOW
        soundName: null,
      });

      await svc.startService({
        id: NOTIF_ID,
        title,
        message: text,
        icon: 'ic_notification', // из drawable
        importance: 'LOW',
        serviceType: 'connectedDevice', // подходит для BLE
        number: '0',
        color: '#00C48C',
        button: false,
      });

      _running = true;
      console.log('[FGService] ✓ Запущен');
    } catch (e: any) {
      console.warn('[FGService] Ошибка старта:', e?.message);
    }
  },

  /**
   * Обновляем текст уведомления (пирs найдено, пакетов и т.д.)
   */
  async update(text: string) {
    if (Platform.OS !== 'android' || !_running) return;
    const svc = getService();
    if (!svc) return;
    try {
      await svc.updateNotification({
        id: NOTIF_ID,
        title: 'GHOST Mesh',
        message: text,
        icon: 'ic_notification',
        importance: 'LOW',
        color: '#00C48C',
      });
    } catch {}
  },

  /**
   * Останавливаем foreground service.
   */
  async stop() {
    if (Platform.OS !== 'android' || !_running) return;
    const svc = getService();
    if (!svc) return;
    try {
      await svc.stopService();
      _running = false;
      console.log('[FGService] ✓ Остановлен');
    } catch {}
  },

  isRunning() { return _running; },
};
