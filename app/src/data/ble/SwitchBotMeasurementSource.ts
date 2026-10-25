import type { Device } from 'react-native-ble-plx';

import type { Measurement, MeasurementSource } from '../../domain/measurement';
import { scanDevices } from './manager';
import { fromBase64 } from './protocol';
import { decodeSwitchBotMeter, findSwitchBotServiceData, SWITCHBOT_COMPANY_ID, type SwitchBotReading } from './switchbot';

const HOUR_MS = 60 * 60 * 1000;

/** アドバタイズが SwitchBot 温湿度計のものなら今の値を読む。 */
export function readSwitchBotDevice(device: Device): SwitchBotReading | null {
  const service = findSwitchBotServiceData(device.serviceData);
  if (service === null) return null;
  return decodeSwitchBotMeter(fromBase64(service), device.manufacturerData ? fromBase64(device.manufacturerData) : null);
}

/**
 * 今の値を1件の記録にする。SwitchBot は履歴を返せないので、同期のたびに1件ずつためる。
 * chiikabi と同じく1時間に1件にするため、計測時刻はその時台の始まりにする（同じ時台は後の値で上書きされる）。
 */
export function toMeasurement(deviceId: string, reading: SwitchBotReading, receivedAt: Date): Measurement {
  return {
    deviceId,
    temperatureC: reading.temperatureC,
    relativeHumidityPercent: reading.relativeHumidityPercent,
    measuredAt: new Date(Math.floor(receivedAt.getTime() / HOUR_MS) * HOUR_MS).toISOString(),
    receivedAt: receivedAt.toISOString(),
  };
}

/**
 * peripheralId の SwitchBot 温湿度計のアドバタイズを待ち、今の値を返す。接続はしない。
 * peripheralId は ble-plx の Device.id（Android は MAC アドレス、iOS は端末ごとの UUID）。
 */
export function createSwitchBotMeasurementSource(peripheralId: string): MeasurementSource {
  const deviceId = `switchbot-${peripheralId}`;
  return {
    label: 'SwitchBot',
    deviceId,
    async fetchSince(_since, signal) {
      // バックグラウンドの同期で画面が消えていても見つかるよう、会社IDで絞る。
      const reading = await scanDevices<SwitchBotReading>(signal, (device, done) => {
        if (device.id !== peripheralId) return;
        const value = readSwitchBotDevice(device);
        if (value) done(value);
      }, SWITCHBOT_COMPANY_ID);
      return [toMeasurement(deviceId, reading, new Date())];
    },
  };
}
