/** 正規化済みの履歴。欠測・時刻未同期はnullで保持する。 */
export interface Measurement {
  readonly seq: number;
  readonly deviceId: string;
  readonly temperatureC: number | null;
  readonly relativeHumidityPercent: number | null;
  readonly measuredAt: string | null;
  readonly receivedAt: string;
}

export interface MeasurementSource {
  readonly label: string;
  readonly deviceId: string;
  /** afterSeqより新しい履歴を古い順に返す。BLEの転送形式は未確定。 */
  fetchSince(afterSeq: number, signal: AbortSignal): Promise<readonly Measurement[]>;
  ack(seq: number, signal: AbortSignal): Promise<void>;
}

/** firmware/logstore.hの保存形式。BLEのフレーミングとは別。 */
export function decodeLogRecord(bytes: Uint8Array, deviceId: string, receivedAt: string): Measurement {
  if (bytes.byteLength !== 12) throw new Error('履歴レコードは12バイト必要です。');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const seq = view.getUint32(0, true);
  const timestamp = view.getUint32(4, true);
  const temperature = view.getInt16(8, true);
  const humidity = view.getUint16(10, true);
  if (seq === 0) throw new Error('履歴のseqは1以上である必要があります。');
  if (humidity !== 0xffff && humidity > 10000) throw new Error('相対湿度が範囲外です。');
  return {
    seq, deviceId, receivedAt,
    measuredAt: timestamp === 0 ? null : new Date(timestamp * 1000).toISOString(),
    temperatureC: temperature === -32768 ? null : temperature / 100,
    relativeHumidityPercent: humidity === 0xffff ? null : humidity / 100,
  };
}