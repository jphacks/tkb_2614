export interface MockSample {
  readonly temperatureC: number;
  readonly relativeHumidityPercent: number;
}

/**
 * この配列を書き換えると、画面へ流すデータを変更できる。1時間ごとの1日分で、末尾から先頭へ繰り返す。
 * グラフの見た目を確かめられるよう、日周の変化に計測のばらつきを足した値にしている。
 */
export const mockSamples: readonly MockSample[] = [
  { temperatureC: 22.6, relativeHumidityPercent: 59.4 },
  { temperatureC: 22.2, relativeHumidityPercent: 64.7 },
  { temperatureC: 22, relativeHumidityPercent: 63.7 },
  { temperatureC: 21.8, relativeHumidityPercent: 64.8 },
  { temperatureC: 21.2, relativeHumidityPercent: 68.2 },
  { temperatureC: 20.8, relativeHumidityPercent: 68.3 },
  { temperatureC: 20.8, relativeHumidityPercent: 68.1 },
  { temperatureC: 20.7, relativeHumidityPercent: 70 },
  { temperatureC: 20.8, relativeHumidityPercent: 69.8 },
  { temperatureC: 21, relativeHumidityPercent: 68.4 },
  { temperatureC: 21.2, relativeHumidityPercent: 68 },
  { temperatureC: 21.6, relativeHumidityPercent: 66.5 },
  { temperatureC: 22, relativeHumidityPercent: 65.8 },
  { temperatureC: 22.2, relativeHumidityPercent: 62 },
  { temperatureC: 22.9, relativeHumidityPercent: 60.9 },
  { temperatureC: 23, relativeHumidityPercent: 60.8 },
  { temperatureC: 23.5, relativeHumidityPercent: 59.5 },
  { temperatureC: 23.7, relativeHumidityPercent: 56 },
  { temperatureC: 23.8, relativeHumidityPercent: 57.9 },
  { temperatureC: 23.8, relativeHumidityPercent: 56.9 },
  { temperatureC: 23.8, relativeHumidityPercent: 58.9 },
  { temperatureC: 23.7, relativeHumidityPercent: 59 },
  { temperatureC: 23.6, relativeHumidityPercent: 57.2 },
  { temperatureC: 23, relativeHumidityPercent: 60.1 },
];

/** 1日の形は mockSamples のまま、湿度だけ base を中心に振れ幅 amp で動かす。 */
function humid(base: number, amp: number): MockSample[] {
  return mockSamples.map((s) => ({
    temperatureC: s.temperatureC,
    relativeHumidityPercent: Math.round((base + ((s.relativeHumidityPercent - 64) * amp) / 7) * 10) / 10,
  }));
}

export type MockScenario = 'low' | 'medium' | 'high';

/**
 * EXPO_PUBLIC_MOCK_SCENARIO で選ぶ、カビリスクの段階ごとのデータ。VTT のカビ指数は日数をかけて育つので、
 * 段階ごとに履歴の長さも変える。low は M≈0、medium は M≈1.4、high は M≈3.4 になる（10月時点）。
 */
export const mockScenarios: Record<MockScenario, { readonly samples: readonly MockSample[]; readonly historyDays: number }> = {
  low: { samples: humid(50, 4), historyDays: 30 },
  medium: { samples: humid(88, 4), historyDays: 45 },
  high: { samples: humid(94, 3), historyDays: 90 },
};
