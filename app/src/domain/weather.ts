/** 現在地の今の外の天気。過去の値は持たない。 */
export interface OutdoorWeather {
  readonly temperatureC: number;
  readonly relativeHumidityPercent: number;
  /** 直前1時間の降水量。 */
  readonly precipitationMm: number;
  readonly windSpeedMps: number;
  readonly isDay: boolean;
  /** 天気の観測時刻（APIの値）。 */
  readonly observedAt: string;
  /** アプリが取得した時刻。キャッシュの有効期限はこちらで判断する。 */
  readonly fetchedAt: string;
}

export interface WeatherSource {
  readonly label: string;
  /** 権限の拒否・オフライン・APIの失敗ではnullを返す（画面は「外の天気なし」で動かす）。abortだけはAbortErrorで失敗する。 */
  fetchCurrent(signal: AbortSignal): Promise<OutdoorWeather | null>;
}
