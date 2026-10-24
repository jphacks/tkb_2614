import type { Measurement } from '../domain/measurement';

export const CHART_WINDOW_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const GRID_STEP_HOURS = 6;

/**
 * 湿度グラフで塗る危険帯の下限。部屋の湿度が70%だと、冬に3〜4℃低い壁際の表面は80%以上になり、
 * VTT モデルの臨界湿度（20℃超で80%）に届く（docs/mold-model.md）。夏は表面が冷えないので、実際の判定はもっと緩い。
 */
export const HUMIDITY_DANGER_PERCENT = 70;

export type ChartKind = 'humidity' | 'temperature';

export interface ChartPoint {
  readonly x: number;
  readonly y: number;
}

export interface ChartGridLine {
  readonly x: number;
  /** 端末のローカル時刻の時（0, 6, 12, 18）。 */
  readonly hour: number;
}

export interface ChartGeometry {
  /** 欠測で線を切るため、連続した区間ごとのパス。 */
  readonly paths: readonly string[];
  readonly points: readonly ChartPoint[];
  readonly latest: (ChartPoint & { readonly value: number }) | null;
  readonly grid: readonly ChartGridLine[];
  /** 危険帯の下端の y。温度グラフでは null。 */
  readonly dangerY: number | null;
}

/** 線を描く矩形。 */
interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function valueOf(m: Measurement, kind: ChartKind) {
  return kind === 'humidity' ? m.relativeHumidityPercent : m.temperatureC;
}

function rangeOf(values: readonly number[], kind: ChartKind): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  // 湿度は危険帯が見えるよう40〜90%を基本にし、外れる値があれば下端・上端に張り付かないよう10%刻みで広げる。
  if (kind === 'humidity') {
    return [Math.max(0, Math.min(40, Math.floor((min - 5) / 10) * 10)), Math.min(100, Math.max(90, Math.ceil((max + 5) / 10) * 10))];
  }
  return [Math.floor(min) - 1, Math.ceil(max) + 1];
}

/** start より後、end 以前で、ローカル時刻が6時間おきの正時になる時刻。 */
function gridTimes(start: number, end: number) {
  const t = new Date(start);
  t.setMinutes(0, 0, 0);
  const times: number[] = [];
  for (let at = t.getTime(); at <= end; at += HOUR_MS) {
    if (at > start && new Date(at).getHours() % GRID_STEP_HOURS === 0) times.push(at);
  }
  return times;
}

/** 最新順の履歴から、最新の計測時刻を右端とする直近24hのグラフ形状を作る。 */
export function buildChart(measurements: readonly Measurement[], kind: ChartKind, box: Box): ChartGeometry {
  const timed = measurements
    .map((m) => ({ t: Date.parse(m.measuredAt), v: valueOf(m, kind) }))
    .sort((a, b) => a.t - b.t);
  const end = timed.at(-1)?.t;
  if (end === undefined) return { paths: [], points: [], latest: null, grid: [], dangerY: null };
  const start = end - CHART_WINDOW_MS;
  const inWindow = timed.filter((p) => p.t >= start);
  const values = inWindow.flatMap((p) => (p.v === null ? [] : [p.v]));
  const [lo, hi] = values.length ? rangeOf(values, kind) : [0, 1];
  const x = (t: number) => box.left + (box.width * (t - start)) / CHART_WINDOW_MS;
  const y = (v: number) => box.top + box.height * (1 - (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo));

  const paths: string[] = [];
  const points: ChartPoint[] = [];
  let segment: string[] = [];
  for (const p of inWindow) {
    if (p.v === null) {
      if (segment.length > 1) paths.push(segment.join(' '));
      segment = [];
      continue;
    }
    const point = { x: x(p.t), y: y(p.v) };
    points.push(point);
    segment.push(`${segment.length ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`);
  }
  if (segment.length > 1) paths.push(segment.join(' '));

  const last = [...inWindow].reverse().find((p) => p.v !== null);
  return {
    paths,
    points,
    latest: last && last.v !== null ? { x: x(last.t), y: y(last.v), value: last.v } : null,
    grid: gridTimes(start, end).map((t) => ({ x: x(t), hour: new Date(t).getHours() })),
    dangerY: kind === 'humidity' ? y(HUMIDITY_DANGER_PERCENT) : null,
  };
}
