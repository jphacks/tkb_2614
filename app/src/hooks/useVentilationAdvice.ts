import { useMemo } from 'react';
import type { Measurement } from '../domain/measurement';
import { predictSpots } from '../domain/roomSpots';
import { adviseVentilation } from '../domain/ventilation';
import type { OutdoorWeather } from '../domain/weather';

/** スポットごとの予測と、窓の開閉判定。now は useNow などで定期的に進め、夜間や古さの判定を更新する。 */
export function useVentilationAdvice(measurements: readonly Measurement[], weather: OutdoorWeather | null, now: number) {
  const outdoorTemperatureC = weather?.temperatureC ?? null;
  const spots = useMemo(() => {
    try {
      return predictSpots(measurements, outdoorTemperatureC);
    } catch {
      return null;
    }
  }, [measurements, outdoorTemperatureC]);
  const advice = useMemo(() => (spots === null ? { kind: 'none' as const } : adviseVentilation(measurements, spots, weather, now)), [measurements, spots, weather, now]);
  return { spots, advice };
}
