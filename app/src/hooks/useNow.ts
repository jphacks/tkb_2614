import { useEffect, useState } from 'react';

/** 表示を時間経過で変える（古い値を薄くする）ための現在時刻。intervalMs ごとに更新する。 */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
