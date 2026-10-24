import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, State, type Subscription } from 'react-native-ble-plx';

import type { Measurement, MeasurementSource } from '../../domain/measurement';
import {
  CONTROL_UUID, DATA_UUID, DEVICE_NAME, SERVICE_UUID,
  decodeDataNotification, encodeSendRequest, fromBase64, isChiikabiAdvertisement, toBase64,
} from './protocol';

async function requestAndroidPermissions() {
  if (Platform.OS !== 'android') return;
  const permissions = Platform.Version >= 31
    ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
    : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const results = await PermissionsAndroid.requestMultiple(permissions);
  if (!permissions.every((p) => results[p] === PermissionsAndroid.RESULTS.GRANTED)) throw new Error('Bluetoothの権限がありません。');
}

const asError = (cause: unknown) => (cause instanceof Error ? cause : new Error('BLEの通信に失敗しました。'));

/** スキャン→接続→送信要求→終了の印まで受信→切断を1回の取得で行う。 */
export function createBleMeasurementSource(): MeasurementSource {
  // ponytail: 1台前提。複数台を切り替えるなら、見つけた端末ごとにdeviceIdを分ける。
  const deviceId = DEVICE_NAME;
  // Expo Go（モック構成）でネイティブを触らないよう、初回の取得まで作らない。
  let manager: BleManager | undefined;

  return {
    label: 'chiikabi',
    deviceId,
    async fetchSince(since, signal) {
      await requestAndroidPermissions();
      const ble = (manager ??= new BleManager());

      return new Promise<Measurement[]>((resolve, reject) => {
        const records: Measurement[] = [];
        let stateSubscription: Subscription | undefined;
        let dataSubscription: Subscription | undefined;
        let connectingId: string | undefined;
        let scanning = false;
        let settled = false;

        // 成功・失敗・中止のどれでもスキャンと接続を片付ける。
        function finish(error: Error | null) {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', abort);
          stateSubscription?.remove();
          dataSubscription?.remove();
          void ble.stopDeviceScan().catch(() => {});
          if (connectingId) void ble.cancelDeviceConnection(connectingId).catch(() => {});
          if (error) reject(error);
          else resolve(records);
        }
        function abort() { finish(new Error('BLEの通信を中止しました。')); }

        async function transfer(id: string) {
          // 接続待ちの間に中止されても切断できるよう、接続前にIDを残す。
          connectingId = id;
          await ble.connectToDevice(id, { requestMTU: 517 });
          if (settled) return;
          await ble.discoverAllServicesAndCharacteristicsForDevice(id);
          if (settled) return;
          // 購読してから送信要求を書く。逆だと記録が送られない。
          dataSubscription = ble.monitorCharacteristicForDevice(id, SERVICE_UUID, DATA_UUID, (error, characteristic) => {
            if (error) return finish(error);
            if (!characteristic?.value) return;
            try {
              const { records: batch, done } = decodeDataNotification(fromBase64(characteristic.value));
              const receivedAt = new Date().toISOString();
              for (const record of batch) {
                records.push({ ...record, deviceId, measuredAt: record.measuredAt.toISOString(), receivedAt });
              }
              if (done) finish(null);
            } catch (cause) {
              finish(asError(cause));
            }
          });
          await ble.writeCharacteristicWithResponseForDevice(id, SERVICE_UUID, CONTROL_UUID, toBase64(encodeSendRequest(since, new Date())));
        }

        function scan() {
          scanning = true;
          // サービスUUIDはスキャン応答にしかないので、フィルタせず名前かManufacturer Dataで見分ける。
          ble.startDeviceScan(null, null, (error, device) => {
            if (error) return finish(error);
            if (!device || connectingId || settled) return;
            const data = device.manufacturerData ? fromBase64(device.manufacturerData) : null;
            if (device.name !== DEVICE_NAME && device.localName !== DEVICE_NAME && !(data && isChiikabiAdvertisement(data))) return;
            void ble.stopDeviceScan().catch(() => {});
            transfer(device.id).catch((cause) => finish(asError(cause)));
          }).catch((cause) => finish(asError(cause)));
        }

        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) return abort();
        stateSubscription = ble.onStateChange((state) => {
          if (state === State.PoweredOn && !scanning) scan();
          else if (state === State.PoweredOff) finish(new Error('Bluetoothがオフです。'));
          else if (state === State.Unauthorized) finish(new Error('Bluetoothの使用が許可されていません。'));
          else if (state === State.Unsupported) finish(new Error('この端末はBLEに対応していません。'));
        }, true);
      });
    },
  };
}
