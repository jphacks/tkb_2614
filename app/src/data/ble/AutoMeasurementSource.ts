import type { MeasurementSource } from '../../domain/measurement';
import { createBleMeasurementSource, isChiikabiDevice } from './BleMeasurementSource';
import { scanDevices } from './manager';
import { createSwitchBotMeasurementSource, readSwitchBotDevice, toMeasurement } from './SwitchBotMeasurementSource';
import type { SwitchBotReading } from './switchbot';

type Sensor = { readonly kind: 'chiikabi' } | { readonly kind: 'switchbot'; readonly peripheralId: string };

interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const STORAGE_KEY = 'sensor:v1';
/** SwitchBot を見つけてから chiikabi やもっと近い SwitchBot を待つ時間。 */
const SETTLE_MS = 3000;
/**
 * 自動で選ぶ SwitchBot の電波の強さの下限（dBm）。スマホのすぐそば（数十cm）にある端末だけを選ぶ。
 * マンションの隣の部屋や会場には他人の SwitchBot がたくさんあり、一番強いものを選ぶだけだと他人の端末を選びうる。
 * 自分の端末が離れていて見つからないときは、スマホを近づけてキャラを長押しすると選び直せる。
 */
const NEAR_RSSI_DBM = -60;
/** 探したときに読んだ SwitchBot の値を、続く取得でそのまま使ってよい時間。 */
const CACHE_MS = 60_000;

function parseSensor(value: string | null): Sensor | null {
  if (value === null) return null;
  const sensor: unknown = JSON.parse(value);
  if (typeof sensor !== 'object' || sensor === null) return null;
  if ('kind' in sensor && sensor.kind === 'chiikabi') return { kind: 'chiikabi' };
  if ('kind' in sensor && sensor.kind === 'switchbot' && 'peripheralId' in sensor && typeof sensor.peripheralId === 'string') {
    return { kind: 'switchbot', peripheralId: sensor.peripheralId };
  }
  return null;
}

/** chiikabi があればそれを、なければすぐそばにある中で一番近い（RSSI が強い）SwitchBot 温湿度計を選ぶ。 */
function discover(signal: AbortSignal) {
  let best: { peripheralId: string; rssi: number; reading: SwitchBotReading; at: number } | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return scanDevices<{ sensor: Sensor; reading?: SwitchBotReading; at?: number }>(signal, (device, done) => {
    if (isChiikabiDevice(device)) return done({ sensor: { kind: 'chiikabi' } });
    const reading = readSwitchBotDevice(device);
    if (!reading) return;
    const rssi = device.rssi ?? -Infinity;
    if (rssi < NEAR_RSSI_DBM) return;
    if (!best || rssi > best.rssi || device.id === best.peripheralId) best = { peripheralId: device.id, rssi, reading, at: Date.now() };
    timer ??= setTimeout(() => {
      const found = best!;
      done({ sensor: { kind: 'switchbot', peripheralId: found.peripheralId }, reading: found.reading, at: found.at });
    }, SETTLE_MS);
  }).finally(() => clearTimeout(timer));
}

/**
 * 近くの温湿度計を勝手に選んで使う。選ぶ画面は作らない。選んだ端末は保存し、forget で選び直す。
 * 選び終わるまでは deviceId が決まらないので、同期は prepare を呼んでから deviceId を読む。
 */
export function createAutoMeasurementSource(storage: KeyValueStorage): MeasurementSource & { forget(): Promise<void> } {
  let current: MeasurementSource | undefined;
  let cached: { reading: SwitchBotReading; at: number } | undefined;
  // 探している間に forget されたら、その結果を使わない。
  let generation = 0;

  return {
    get label() { return current?.label ?? '温湿度計'; },
    get deviceId() { return current?.deviceId ?? 'unresolved'; },
    async prepare(signal) {
      if (current) return;
      const started = generation;
      let sensor = parseSensor(await storage.getItem(STORAGE_KEY));
      if (!sensor) {
        const found = await discover(signal);
        if (started !== generation) throw new Error('温湿度計を探し直しています。');
        sensor = found.sensor;
        if (found.reading && found.at !== undefined) cached = { reading: found.reading, at: found.at };
        await storage.setItem(STORAGE_KEY, JSON.stringify(sensor));
      }
      if (started !== generation) throw new Error('温湿度計を探し直しています。');
      current = sensor.kind === 'chiikabi' ? createBleMeasurementSource() : createSwitchBotMeasurementSource(sensor.peripheralId);
    },
    async fetchSince(since, signal) {
      if (!current) throw new Error('温湿度計がまだ決まっていません。');
      const fresh = cached && Date.now() - cached.at < CACHE_MS ? cached : undefined;
      cached = undefined;
      if (fresh) return [toMeasurement(current.deviceId, fresh.reading, new Date(fresh.at))];
      return current.fetchSince(since, signal);
    },
    async forget() {
      generation++;
      current = undefined;
      cached = undefined;
      await storage.removeItem(STORAGE_KEY);
    },
  };
}
