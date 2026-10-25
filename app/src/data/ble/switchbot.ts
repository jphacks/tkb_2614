// SwitchBot 温湿度計のアドバタイズ。OpenWonderLabs/SwitchBotAPI-BLE と pySwitchbot の読み方に合わせる。
// 接続せずにアドバタイズだけを読むので、手に入るのは今の値だけで履歴はない。

/** Manufacturer Data の会社ID（Woan Technology）。サービス UUID の一覧は出さないので、スキャンはこれで絞る。 */
export const SWITCHBOT_COMPANY_ID = 0x0969;
/** サービスデータの UUID。新しいファームは FD3D、古いファームは 0D00。 */
const SERVICE_DATA_UUID = /^(0000)?(fd3d|0d00)(-0000-1000-8000-00805f9b34fb)?$/i;
/** サービスデータ先頭の機種コード。温湿度の並びが同じ機種だけを扱う（Hub 2 などは並びが違うので扱わない）。 */
const METER_MODELS = new Set([
  0x54, // 'T' 温湿度計
  0x69, // 'i' 温湿度計プラス
  0x77, // 'w' 防水温湿度計
  0x34, // '4' 温湿度計 Pro
  0x35, // '5' CO2センサー（温湿度計 Pro CO2）
]);

export interface SwitchBotReading {
  readonly temperatureC: number;
  readonly relativeHumidityPercent: number;
}

/** ble-plx の serviceData（UUID → Base64）から SwitchBot のサービスデータを取り出す。 */
export function findSwitchBotServiceData(serviceData: Readonly<Record<string, string>> | null | undefined) {
  if (!serviceData) return null;
  const key = Object.keys(serviceData).find((uuid) => SERVICE_DATA_UUID.test(uuid));
  return key === undefined ? null : serviceData[key];
}

/**
 * サービスデータと Manufacturer Data（会社IDを含む）から温湿度を読む。温湿度計でなければ null。
 * 温湿度の3バイトは [小数部(下位4ビット), 符号(bit7が正)+整数部, 湿度(下位7ビット)]。
 * Manufacturer Data にあればそちら（会社IDの後ろ 8〜10 バイト目）を、なければサービスデータの 3〜5 バイト目を使う。
 */
export function decodeSwitchBotMeter(service: Uint8Array | null, manufacturer: Uint8Array | null): SwitchBotReading | null {
  if (!service || service.byteLength < 1 || !METER_MODELS.has(service[0] & 0x7f)) return null;
  const fromManufacturer = manufacturer !== null && manufacturer.byteLength >= 13 &&
    (manufacturer[0] | (manufacturer[1] << 8)) === SWITCHBOT_COMPANY_ID;
  const bytes = fromManufacturer ? manufacturer.subarray(10, 13) : service.byteLength >= 6 ? service.subarray(3, 6) : null;
  if (!bytes) return null;
  const sign = bytes[1] & 0x80 ? 1 : -1;
  const temperatureC = sign * ((bytes[1] & 0x7f) + (bytes[0] & 0x0f) / 10);
  const relativeHumidityPercent = bytes[2] & 0x7f;
  if (relativeHumidityPercent > 100) return null;
  // 小数第1位まで。浮動小数の誤差（22.5 → 22.499…）を残さない。
  return { temperatureC: Math.round(temperatureC * 10) / 10, relativeHumidityPercent };
}
