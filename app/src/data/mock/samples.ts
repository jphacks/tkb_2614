export interface MockSample {
  readonly temperatureC: number;
  readonly relativeHumidityPercent: number;
}

/** この配列を書き換えると、画面へ流すデータを変更できる。末尾から先頭へ繰り返す。 */
export const mockSamples: readonly MockSample[] = [
  { temperatureC: 24.2, relativeHumidityPercent: 55 },
  { temperatureC: 24.6, relativeHumidityPercent: 61 },
  { temperatureC: 25.1, relativeHumidityPercent: 69 },
  { temperatureC: 25.4, relativeHumidityPercent: 74 },
  { temperatureC: 25.8, relativeHumidityPercent: 81 },
  { temperatureC: 25.2, relativeHumidityPercent: 73 },
];
