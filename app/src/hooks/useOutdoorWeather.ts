import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { OutdoorWeather, WeatherSource } from '../domain/weather';

interface WeatherState {
  readonly weather: OutdoorWeather | null;
  readonly loading: boolean;
}

/** 起動時とフォアグラウンド復帰時に取得する。30分以内なら取得元がキャッシュを返す。取れなければweatherはnull。 */
export function useOutdoorWeather(source: WeatherSource): WeatherState {
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
    load();
    return () => { subscription.remove(); controller?.abort(); };
  }, [source]);

  return state;
}
