import { State, type Device, type Subscription } from 'react-native-ble-plx';

import type { Measurement, MeasurementSource } from '../../domain/measurement';
import {
  COMPANY_ID, CONTROL_UUID, DATA_UUID, DEVICE_NAME, SERVICE_UUID,
  decodeDataNotification, encodeSendRequest, fromBase64, isChiikabiAdvertisement, toBase64,
} from './protocol';
import { asError, bleManager, requestAndroidPermissions, stateError } from './manager';

/** サービスUUIDはスキャン応答にしかないので、フィルタせず名前かManufacturer Dataで見分ける。 */
export function isChiikabiDevice(device: Device) {
  const data = device.manufacturerData ? fromBase64(device.manufacturerData) : null;
  return device.name === DEVICE_NAME || device.localName === DEVICE_NAME || (data !== null && isChiikabiAdvertisement(data));
}

/** スキャン→接続→送信要求→終了の印まで受信→切断を1回の取得で行う。 */
export function createBleMeasurementSource(): MeasurementSource {
  // ponytail: 1台前提。複数台を切り替えるなら、見つけた端末ごとにdeviceIdを分ける。
  const deviceId = DEVICE_NAME;

  return {
    label: 'chiikabi',
    deviceId,
    async fetchSince(since, signal) {
      await requestAndroidPermissions();
      const ble = bleManager();

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
          // Manufacturer Data はアドバタイズ本体にあるので会社IDで絞れる。絞らないと、画面が消えている間（バックグラウンドの同期）にスキャンが始まらない。
          ble.startDeviceScan(null, { manufacturerId: COMPANY_ID }, (error, device) => {
            if (error) return finish(error);
            if (!device || connectingId || settled || !isChiikabiDevice(device)) return;
            void ble.stopDeviceScan().catch(() => {});
            transfer(device.id).catch((cause) => finish(asError(cause)));
          }).catch((cause) => finish(asError(cause)));
        }

        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) return abort();
        stateSubscription = ble.onStateChange((state) => {
          const error = stateError(state);
          if (error) finish(error);
          else if (state === State.PoweredOn && !scanning) scan();
        }, true);
      });
    },
  };
}
