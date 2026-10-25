import type { MoldRiskLevel } from '../domain/prediction';
import type { SpotId, SpotPredictions } from '../domain/roomSpots';
import { riskySpots, type VentilationAdvice } from '../domain/ventilation';
import type { ActionName } from './action/types';

export interface BubbleMessage {
  /** 読み上げの最初に言う理由。キャラの表情と食い違うときだけ付ける。 */
  readonly reason: string | null;
  /** スクリーンリーダーで読み上げるひとこと。画面には出さない。 */
  readonly text: string;
  /** 吹き出しに出すアニメーション。画面に文言を出さないので、これだけで何をすればいいかわかるようにする。 */
  readonly animation: ActionName;
}

/**
 * 「◯% くらい」の刻み [%]。全部入れ替わったときの値で実際はそこまで下がらず、センサーにも ±3% の誤差があるので細かく出さない。
 * 丸めて 0% にはしない（外がとても乾いていても、室内の湿度が 0% になることはない）。
 */
const PREDICTED_RH_STEP = 5;
/**
 * 「◯% くらい」の下限 [%]。外がとても乾いている日（春先の 15℃・30% など）は全部入れ替わったときの値が 20% 台になるが、
 * 実際は壁や家具が水分を吐き出すのでそこまでは下がらず、勧めたい値（乾燥しすぎない範囲）でもないので、これより下は出さない。
 */
const PREDICTED_RH_FLOOR = 40;

const spotReasons: Record<SpotId, string> = {
  window: '窓のまわりが湿っているよ',
  shelf: '家具の裏が湿っているよ',
  bed: 'ベッドの裏が湿っているよ',
};

/**
 * 判定ごとのひとことと絵。window-close-pollen（花粉）の絵は、花粉の判定を作るまで使わない。
 * 外のほうが湿っている（close）ときは、エアコン・除湿機を勧める。close はどこかのスポットが湿っているとき（ルール2）にしか出ないので、
 * 窓を閉めても部屋は乾かず、乾かすにはエアコンや除湿機が要る。
 */
function adviceContent(advice: Exclude<VentilationAdvice, { kind: 'none' }>): { text: string; animation: ActionName } {
  switch (advice.kind) {
    case 'open':
      if (advice.brief) return { text: '外が寒いから、5〜10分だけ窓を開けよう', animation: 'window-open-brief' };
      return { text: `窓を開けよう！ ${predictedRhLabel(advice.predictedIndoorRh)}% くらいまで下がりそう`, animation: 'window-open' };
    case 'close':
      return { text: '外のほうがジメジメ。エアコンや除湿機を使おう', animation: 'aircon-dry' };
    case 'keep':
      if (advice.reason === 'rain') return { text: '雨だから窓を閉めよう', animation: 'window-close-rain' };
      if (advice.reason === 'wind') return { text: '風が強いから窓を閉めよう', animation: 'window-close-wind' };
      return { text: '今日はエアコンや除湿機を使おう', animation: 'aircon-dry' };
  }
}

/**
 * 読み上げる「◯%」。5% 刻みに丸め、PREDICTED_RH_FLOOR より下は出さない。
 * 開ける判定は水蒸気圧の差が VAPOR_PRESSURE_THRESHOLD_HPA 以上のときだけなので、室温 30℃ でも 3 ポイント以上は下がる。
 * 丸めで最大 2.5 ポイント上がっても、今の湿度（画面の数字）より低い値になる（下限で切り上げたときを除く）。
 */
function predictedRhLabel(predictedIndoorRh: number) {
  return Math.max(PREDICTED_RH_FLOOR, Math.round(predictedIndoorRh / PREDICTED_RH_STEP) * PREDICTED_RH_STEP);
}

/**
 * 窓の開閉判定を、キャラの吹き出し（アニメーションと読み上げのひとこと）にする。none と夜間（keep / night）なら null（吹き出しを出さない）。
 * 夜は開けるよう勧めないだけで、言うことがないので出さない。
 * キャラの表情は部屋全体のカビのリスク（壁の隅）で決まるので、リスクが低いのに乾かすよう勧めるときは、
 * どのスポットが原因かを reason として読み上げ、表情（危険度：低）と食い違わないようにする。
 */
export function ventilationMessage(advice: VentilationAdvice, spots: SpotPredictions | null, risk: MoldRiskLevel | null): BubbleMessage | null {
  if (advice.kind === 'none' || (advice.kind === 'keep' && advice.reason === 'night')) return null;
  const asksToDry = advice.kind === 'open' || (advice.kind === 'keep' && advice.reason === 'hot');
  const cause = asksToDry && risk !== 'medium' && risk !== 'high' && spots !== null ? riskySpots(spots)[0] : undefined;
  const reason = cause === undefined ? null : cause === 'window' && spots?.window?.isCondensing ? '窓が結露しているよ' : spotReasons[cause];
  return { reason, ...adviceContent(advice) };
}
