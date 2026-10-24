

import type { Measurement } from '../domain/measurement';
import type { MeasurementStore } from '../services/syncMeasurements';

interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function createMeasurementStore(storage: KeyValueStorage): MeasurementStore {
  const key = (deviceId: string) => `measurements:v1:${deviceId}`;
  return {
    async load(deviceId) {
      const value = await storage.getItem(key(deviceId));
      if (value === null) return [];
      const records: unknown = JSON.parse(value);
      if (!Array.isArray(records)) throw new Error('保存済み履歴が壊れています。');
      let previousSeq = 0;
      for (const record of records) {
        if (!record || record.deviceId !== deviceId || !Number.isInteger(record.seq) || record.seq <= previousSeq || record.seq > 0xffffffff ||
          ![record.temperatureC, record.relativeHumidityPercent].every((v) => v === null || (typeof v === 'number' && Number.isFinite(v))) ||
          (record.relativeHumidityPercent !== null && (record.relativeHumidityPercent < 0 || record.relativeHumidityPercent > 100)) ||
          !(record.measuredAt === null || (typeof record.measuredAt === 'string' && Number.isFinite(Date.parse(record.measuredAt)))) ||
          typeof record.receivedAt !== 'string' || !Number.isFinite(Date.parse(record.receivedAt))) {
          throw new Error('保存済み履歴が壊れています。ACKせず同期を停止します。');
        }
        previousSeq = record.seq;
      }
      return records as Measurement[];
    },
    save: (deviceId, records) => storage.setItem(key(deviceId), JSON.stringify(records)),
  };
}