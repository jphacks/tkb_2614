import type { Measurement } from '../domain/measurement';

export const CHART_WINDOW_MS = 24 * 60 * 60 * 1000;
const GRID_STEP_MS = 6 * 60 * 60 * 1000;

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

export interface ChartGeometry {
  /** 欠測で線を切るため、連続した区間ごとのパス。 */
  readonly paths: readonly string[];
  readonly points: readonly ChartPoint[];
  readonly latest: (ChartPoint & { readonly value: number }) | null;
  readonly gridX: readonly number[];
  /** 危険帯の下端の y。温度グラフでは null。 */
  readonly dangerY: number | null;
}

interface Box {
  readonly width: number;
  readonly height: number;
  readonly padding: number;
}

function valueOf(m: Measurement, kind: ChartKind) {
  return kind === 'humidity' ? m.relativeHumidityPercent : m.temperatureC;
}

function rangeOf(values: readonly number[], kind: ChartKind): [number, number] {
  if (kind === 'humidity') return [30, 90];
  const min = Math.min(...values);
  const max = Math.max(...values);
  return [Math.floor(min) - 2, Math.ceil(max) + 2];
}

/** 最新順の履歴から、最新の計測時刻を右端とする直近24hのグラフ形状を作る。時刻未同期の記録は使わない。 */
export function buildChart(measurements: readonly Measurement[], kind: ChartKind, box: Box): ChartGeometry {
  const timed = measurements
    .filter((m) => m.measuredAt !== null)
    .map((m) => ({ t: Date.parse(m.measuredAt as string), v: valueOf(m, kind) }))
    .sort((a, b) => a.t - b.t);
  const end = timed.at(-1)?.t;
  if (end === undefined) return { paths: [], points: [], latest: null, gridX: [], dangerY: null };
  const start = end - CHART_WINDOW_MS;
  const inWindow = timed.filter((p) => p.t >= start);
  const values = inWindow.flatMap((p) => (p.v === null ? [] : [p.v]));
  const [lo, hi] = values.length ? rangeOf(values, kind) : [0, 1];
  const plotWidth = box.width - 2 * box.padding;
  const plotHeight = box.height - 2 * box.padding;
  const x = (t: number) => box.padding + (plotWidth * (t - start)) / CHART_WINDOW_MS;
  const y = (v: number) => box.padding + plotHeight * (1 - (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo));

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
  const gridX = [0, 1, 2, 3].map((i) => x(start + i * GRID_STEP_MS));
  return {
    paths,
    points,
    latest: last && last.v !== null ? { x: x(last.t), y: y(last.v), value: last.v } : null,
    gridX,
    dangerY: kind === 'humidity' ? y(HUMIDITY_DANGER_PERCENT) : null,
  };
}
