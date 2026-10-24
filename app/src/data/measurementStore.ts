

import type { Measurement } from '../domain/measurement';
import type { MeasurementStore } from '../services/syncMeasurements';

interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function createMeasurementStore(storage: KeyValueStorage): MeasurementStore {
  // v1はseqが主キーだった形式。計測時刻が主キーのv2とは互換がないので読まない。
  const key = (deviceId: string) => `measurements:v2:${deviceId}`;
  return {
    async load(deviceId) {
      const value = await storage.getItem(key(deviceId));
      if (value === null) return [];
      const records: unknown = JSON.parse(value);
      if (!Array.isArray(records)) throw new Error('保存済み履歴が壊れています。');
      let previous = -Infinity;
      for (const record of records) {
        const time = typeof record?.measuredAt === 'string' ? Date.parse(record.measuredAt) : NaN;
        if (!record || record.deviceId !== deviceId || !(time > previous) ||
          ![record.temperatureC, record.relativeHumidityPercent].every((v) => v === null || (typeof v === 'number' && Number.isFinite(v))) ||
          (record.relativeHumidityPercent !== null && (record.relativeHumidityPercent < 0 || record.relativeHumidityPercent > 100)) ||
          typeof record.receivedAt !== 'string' || !Number.isFinite(Date.parse(record.receivedAt))) {
          throw new Error('保存済み履歴が壊れています。上書きせず同期を停止します。');
        }
        previous = time;
      }
      return records as Measurement[];
    },
    save: (deviceId, records) => storage.setItem(key(deviceId), JSON.stringify(records)),
  };
}