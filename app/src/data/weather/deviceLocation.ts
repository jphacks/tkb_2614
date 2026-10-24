import * as Location from 'expo-location';
import type { Coordinates } from './OpenMeteoWeatherSource';

/** 直近1時間以内の位置があればGPSを使わずにそれを使う。 */
const LAST_KNOWN_MAX_AGE_MS = 60 * 60 * 1000;

/** 市区町村レベルの現在地。権限が拒否されたらnull（設定から許可されるまで再要求しない）。 */
export async function getCoarseLocation(): Promise<Coordinates | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  const granted = permission.granted || (permission.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted);
  if (!granted) return null;
  const position = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })
    ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
  return position ? { latitude: position.coords.latitude, longitude: position.coords.longitude } : null;
}
