import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { OutdoorWeather, WeatherSource } from '../domain/weather';

interface WeatherState {
  readonly weather: OutdoorWeather | null;
  readonly loading: boolean;
}

/** フォアグラウンドにいる間に取り直す間隔。取得元のキャッシュが残っていれば、位置もAPIも使わずにそれが返る。 */
export const WEATHER_REFRESH_MS = 5 * 60 * 1000;

/** 起動時・フォアグラウンド復帰時と、フォアグラウンドにいる間は一定間隔で取得する。30分以内なら取得元がキャッシュを返す。取れなければweatherはnull。 */
export function useOutdoorWeather(source: WeatherSource, refreshMs = WEATHER_REFRESH_MS): WeatherState {
  const [state, setState] = useState<WeatherState>({ weather: null, loading: true });

  useEffect(() => {
    let controller: AbortController | undefined;
    function load() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      source.fetchCurrent(current.signal).then(
        // 取れなかったときは前の値を残さず「外の天気なし」にする。
        (weather) => { if (!current.signal.aborted) setState({ weather, loading: false }); },
        () => { if (!current.signal.aborted) setState((previous) => ({ ...previous, loading: false })); },
      );
    }
    const subscription = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') load();
      else if (appState === 'background') controller?.abort();
    });
    // 開いたままでもキャッシュが切れたら取り直す。バックグラウンドでは位置を取れないので取らない。
    const timer = setInterval(() => { if (AppState.currentState === 'active') load(); }, refreshMs);
    load();
    return () => { subscription.remove(); clearInterval(timer); controller?.abort(); };
  }, [source, refreshMs]);

  return state;
}
