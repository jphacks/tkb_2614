// docs/ble-protocol.md（形式バージョン 2）のバイト形式。firmware/ble.h と同じ値を保つこと。
export const DEVICE_NAME = 'chiikabi';
export const SERVICE_UUID = 'a29c0001-756b-4378-90b5-8651bbdbe79e';
export const CONTROL_UUID = 'a29c0003-756b-4378-90b5-8651bbdbe79e';
export const DATA_UUID = 'a29c0004-756b-4378-90b5-8651bbdbe79e';

const PROTOCOL_VERSION = 2;
export const COMPANY_ID = 0xffff;
const RECORD_SIZE = 8;

export interface BleRecord {
  readonly measuredAt: Date;
  readonly temperatureC: number | null;
  readonly relativeHumidityPercent: number | null;
}

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const epochSeconds = (date: Date) => Math.floor(date.getTime() / 1000);

export const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
export const toBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));

/** Manufacturer Data（会社IDを含む8バイト）がchiikabiのものか。 */
export function isChiikabiAdvertisement(b: Uint8Array): boolean {
  return b.byteLength === 8 && view(b).getUint16(0, true) === COMPANY_ID && b[2] === PROTOCOL_VERSION;
}

/** 制御に書く9バイト。since以上の記録を要求し、端末の現在時刻も渡す。 */
export function encodeSendRequest(since: Date | null, now: Date): Uint8Array {
  const b = new Uint8Array(9);
  const v = view(b);
  v.setUint8(0, 0x01);
  v.setUint32(1, since === null ? 0 : epochSeconds(since), true);
  v.setUint32(5, epochSeconds(now), true);
  return b;
}

/** データの通知1回分を記録に分ける。終了の印（計測時刻0）が含まれていればdone。 */
export function decodeDataNotification(b: Uint8Array): { records: BleRecord[]; done: boolean } {
  if (b.byteLength % RECORD_SIZE !== 0) throw new Error('通知の長さが8の倍数ではありません。');
  const records: BleRecord[] = [];
  for (let i = 0; i < b.byteLength; i += RECORD_SIZE) {
    const v = view(b.subarray(i, i + RECORD_SIZE));
    const timestamp = v.getUint32(0, true);
    if (timestamp === 0) return { records, done: true };
    const temperature = v.getInt16(4, true);
    const humidity = v.getUint16(6, true);
    if (humidity !== 0xffff && humidity > 10000) throw new Error('相対湿度が範囲外です。');
    records.push({
      measuredAt: new Date(timestamp * 1000),
      temperatureC: temperature === -32768 ? null : temperature / 100,
      relativeHumidityPercent: humidity === 0xffff ? null : humidity / 100,
    });
  }
  return { records, done: false };
}
