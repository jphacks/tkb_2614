import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State, type Device, type Subscription } from 'react-native-ble-plx';

// Expo Go（モック構成）でネイティブを触らないよう、初回の取得まで作らない。
let manager: BleManager | undefined;
/** chiikabi と SwitchBot で1つを共有する。BleManager は複数作らない。 */
export const bleManager = () => (manager ??= new BleManager());

export async function requestAndroidPermissions() {
  if (Platform.OS !== 'android') return;
  const permissions = Platform.Version >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  // バックグラウンドでは Activity がなく要求できないので、許可済みなら要求しない。
  const granted = await Promise.all(permissions.map((p) => PermissionsAndroid.check(p)));
  if (granted.every(Boolean)) return;
  const results = await PermissionsAndroid.requestMultiple(permissions);
  if (!permissions.every((p) => results[p] === PermissionsAndroid.RESULTS.GRANTED)) throw new Error('Bluetoothの権限がありません。');
}

export const asError = (cause: unknown) => (cause instanceof Error ? cause : new Error('BLEの通信に失敗しました。'));

/** Bluetoothが使えない状態ならそのエラー。オンか、まだ分からないなら null。 */
export function stateError(state: State): Error | null {
  if (state === State.PoweredOff) return new Error('Bluetoothがオフです。');
  if (state === State.Unauthorized) return new Error('Bluetoothの使用が許可されていません。');
  if (state === State.Unsupported) return new Error('この端末はBLEに対応していません。');
  return null;
}

/**
 * Bluetoothがオンになるのを待ってスキャンし、見つけた端末を onDevice に渡す。
 * manufacturerId を渡すと、Manufacturer Data にその会社IDを持つ端末だけに絞る（Android だけ。patches/ で ble-plx に足した）。
 * Android は画面が消えているとフィルタなしのスキャンを始めないので、バックグラウンドの同期で使うスキャンは絞る。
 * onDevice が done を呼ぶか signal が中止されたらスキャンを止める。
 */
export async function scanDevices<T>(
  signal: AbortSignal,
  onDevice: (device: Device, done: (result: T) => void) => void,
  manufacturerId?: number,
): Promise<T> {
  await requestAndroidPermissions();
  const ble = bleManager();
  return new Promise<T>((resolve, reject) => {
    let scanning = false;
    let settled = false;
    let subscription: Subscription | undefined;
    function finish(error: Error | null, result?: T) {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      subscription?.remove();
      void ble.stopDeviceScan().catch(() => {});
      if (error) reject(error);
      else resolve(result as T);
    }
    function abort() { finish(new Error('BLEの通信を中止しました。')); }
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) return abort();
    subscription = ble.onStateChange((state) => {
      const error = stateError(state);
      if (error) return finish(error);
      if (state !== State.PoweredOn || scanning) return;
      scanning = true;
      ble.startDeviceScan(null, manufacturerId === undefined ? null : { manufacturerId }, (scanError, device) => {
        if (scanError) return finish(scanError);
        if (device && !settled) onDevice(device, (result) => finish(null, result));
      }).catch((cause) => finish(asError(cause)));
    }, true);
    if (settled) subscription.remove();
  });
}
