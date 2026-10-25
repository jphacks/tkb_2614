import { useMemo } from 'react';
import type { Measurement } from '../domain/measurement';
import type { SpotPredictions } from '../domain/roomSpots';
import { adviseVentilation, type VentilationAdvice } from '../domain/ventilation';
import type { OutdoorWeather } from '../domain/weather';

/** 窓の開閉判定。spots は部屋ページと同じ predictSpots の結果を渡す。now は useNow などで定期的に進め、夜間や古さの判定を更新する。 */
export function useVentilationAdvice(measurements: readonly Measurement[], spots: SpotPredictions, weather: OutdoorWeather | null, now: number): VentilationAdvice {
  return useMemo(() => adviseVentilation(measurements, spots, weather, now), [measurements, spots, weather, now]);
}
