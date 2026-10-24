import type { Measurement } from '../domain/measurement';
import type { MoldPrediction, MoldRiskLevel } from '../domain/prediction';
import type { SyncStatus } from '../hooks/useMeasurements';
import { type ColorScheme, schemes } from '../theme/schemes';
import { deriveHomeState, type Mood } from '../ui/homeState';
import type { CharacterKind } from '../ui/mascot/types';

/** ウィジェットは別ランタイムで動き、アプリのモジュールを読めないので、配色は値で渡す。 */
export interface WidgetPalette {
  readonly surface: string;
  readonly onSurface: string;
  readonly onSurfaceVariant: string;
  readonly primary: string;
  readonly outline: string;
}

/** Android のウィジェットは SF Symbols のような組み込みアイコンがないので、PNG を tint して使う。 */
export interface WidgetIcons {
  readonly humidity: string;
  readonly temperature: string;
  readonly sync: string;
}

/** 5種類のウィジェットで共通の props。値は表示用の文字列にしておく。 */
export interface MoldWidgetProps {
  /** 整数の湿度。不明なら '–'。 */
  readonly humidity: string;
  /** 整数の温度（単位なし）。不明なら '–'。 */
  readonly temperature: string;
  /** 最後に同期した時刻（HH:mm）。未同期なら '–'。 */
  readonly syncTime: string;
  readonly syncAgo: string;
  /** 古い値や不明な値は outline 色で表示する。 */
  readonly stale: boolean;
  /** アプリと同じくライトの配色だけを使う。 */
  readonly palette: WidgetPalette;
  /**
   * 選んでいるマスコットの、危険度に合った PNG（file:// URL か Android の drawable 名）。用意する前は空文字。
   * iOS は props を UserDefaults に保存し、null を含む値は保存できないので、画像がないことは空文字で表す。
   */
  readonly character: string;
  /** 計測値がないときは、アプリと同じくマスコットを薄く表示する。 */
  readonly characterOpacity: number;
  readonly icons: WidgetIcons;
}

export interface WidgetImages {
  readonly characters: Readonly<Record<CharacterKind, Readonly<Record<MoldRiskLevel, string>>>>;
  readonly icons: WidgetIcons;
}

/** Character と同じく、計測値がないとき（sleep）は low の絵を薄く出す。 */
const moodLevels: Record<Mood, MoldRiskLevel> = { fine: 'low', worried: 'medium', dizzy: 'high', sleep: 'low' };
const SLEEP_OPACITY = 0.45;

export function widgetPalette(scheme: ColorScheme): WidgetPalette {
  const { surface, onSurface, onSurfaceVariant, primary, outline } = scheme;
  return { surface, onSurface, onSurfaceVariant, primary, outline };
}

function paletteFor(risk: MoldRiskLevel | null): WidgetPalette {
  return widgetPalette(schemes[`${risk ?? 'low'}-light`]);
}

const noIcons: WidgetIcons = { humidity: '', temperature: '', sync: '' };

/** アプリを開く前（初回配置時）に表示する、未接続の状態。 */
export const initialWidgetProps: MoldWidgetProps = {
  humidity: '–',
  temperature: '–',
  syncTime: '–',
  syncAgo: '未同期',
  stale: true,
  palette: paletteFor(null),
  character: '',
  characterOpacity: SLEEP_OPACITY,
  icons: noIcons,
};

export interface WidgetSource {
  /** 新しい順の履歴。 */
  readonly measurements: readonly Measurement[];
  readonly status: SyncStatus;
  readonly prediction: MoldPrediction | null;
  /** このプロセスで最後に同期が成功した時刻。まだなら最新の受信時刻を使う。 */
  readonly lastSyncedAt: number | null;
  /** メイン画面で選んでいるマスコット。 */
  readonly character: CharacterKind;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function formatClock(at: number): string {
  const date = new Date(at);
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function formatSyncAgo(syncedAt: number, now: number): string {
  const elapsed = Math.max(0, now - syncedAt);
  if (elapsed < MINUTE_MS) return 'たった今';
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}分前`;
  if (elapsed < 24 * HOUR_MS) return `${Math.floor(elapsed / HOUR_MS)}時間前`;
  return `${Math.floor(elapsed / (24 * HOUR_MS))}日前`;
}

function syncedAtOf(source: WidgetSource): number | null {
  if (source.lastSyncedAt !== null) return source.lastSyncedAt;
  const receivedAt = source.measurements[0]?.receivedAt;
  return receivedAt === undefined ? null : Date.parse(receivedAt);
}

/** 時刻 at に表示する props。古さの判定と表情はアプリの画面（deriveHomeState）と同じにする。 */
export function deriveWidgetProps(source: WidgetSource, images: WidgetImages | null, at: number): MoldWidgetProps {
  const home = deriveHomeState(source.measurements, source.status, source.prediction, at);
  const temperature = source.measurements.find((m) => m.temperatureC !== null)?.temperatureC ?? null;
  const syncedAt = syncedAtOf(source);
  return {
    humidity: 'humidity' in home.reading ? Math.round(home.reading.humidity).toString() : '–',
    temperature: temperature === null ? '–' : Math.round(temperature).toString(),
    syncTime: syncedAt === null ? '–' : formatClock(syncedAt),
    syncAgo: syncedAt === null ? '未同期' : formatSyncAgo(syncedAt, at),
    stale: home.reading.kind !== 'live',
    palette: paletteFor(home.risk),
    character: images?.characters[source.character][moodLevels[home.mood]] ?? '',
    characterOpacity: home.mood === 'sleep' ? SLEEP_OPACITY : 1,
    icons: images?.icons ?? noIcons,
  };
}

export const WIDGET_TIMELINE_STEP_MS = 15 * MINUTE_MS;
const WIDGET_TIMELINE_LENGTH = 6 * HOUR_MS;

/**
 * iOS はアプリが動いていなくてもタイムラインの順に表示を切り替えるので、
 * 「◯分前」と古さの表示を15分ごとに先回りして用意しておく。
 */
export function buildWidgetTimeline(source: WidgetSource, images: WidgetImages | null, now: number) {
  const entries: { date: Date; props: MoldWidgetProps }[] = [];
  for (let at = now; at <= now + WIDGET_TIMELINE_LENGTH; at += WIDGET_TIMELINE_STEP_MS) {
    entries.push({ date: new Date(at), props: deriveWidgetProps(source, images, at) });
  }
  return entries;
}
