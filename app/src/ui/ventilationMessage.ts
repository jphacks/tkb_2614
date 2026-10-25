import type { MoldRiskLevel } from '../domain/prediction';
import type { SpotId, SpotPredictions } from '../domain/roomSpots';
import { riskySpots, type VentilationAdvice } from '../domain/ventilation';

export interface BubbleMessage {
  /** 吹き出しの1行目に小さく出す理由。キャラの表情と食い違うときだけ出す。 */
  readonly reason: string | null;
  readonly text: string;
}

/**
 * 「◯% くらい」の刻み [%]。全部入れ替わったときの値で実際はそこまで下がらず、センサーにも ±3% の誤差があるので細かく出さない。
 * 丸めて 0% にはしない（外がとても乾いていても、室内の湿度が 0% になることはない）。
 */
const PREDICTED_RH_STEP = 5;

const spotReasons: Record<SpotId, string> = {
  window: '窓のまわりが湿っているよ',
  shelf: '家具の裏が湿っているよ',
  bed: 'ベッドの裏が湿っているよ',
};

function adviceText(advice: Exclude<VentilationAdvice, { kind: 'none' }>) {
  switch (advice.kind) {
    case 'open':
      return advice.brief
        ? '外が寒いから、5〜10分だけ窓を開けよう'
        : `窓を開けよう！ ${Math.max(PREDICTED_RH_STEP, Math.round(advice.predictedIndoorRh / PREDICTED_RH_STEP) * PREDICTED_RH_STEP)}% くらいまで下がりそう`;
    case 'close':
      return '外のほうがジメジメ。窓は閉めておこう';
    case 'keep':
      if (advice.reason === 'rain') return '雨だから窓はそのままで';
      return '今日はエアコンや除湿機を使おう';
  }
}

/**
 * 窓の開閉判定を、キャラの吹き出しのひとことにする。none と夜間（keep / night）なら null（吹き出しを出さない）。
 * 夜は開けるよう勧めないだけで、言うことがないので出さない。
 * キャラの表情は部屋全体のカビのリスク（壁の隅）で決まるので、リスクが低いのに乾かすよう勧めるときは、
 * どのスポットが原因かを reason に出して、表情（危険度：低）と食い違わないようにする。
 */
export function ventilationMessage(advice: VentilationAdvice, spots: SpotPredictions | null, risk: MoldRiskLevel | null): BubbleMessage | null {
  if (advice.kind === 'none' || (advice.kind === 'keep' && advice.reason === 'night')) return null;
  const asksToDry = advice.kind === 'open' || (advice.kind === 'keep' && (advice.reason === 'wind' || advice.reason === 'hot'));
  const cause = asksToDry && risk !== 'medium' && risk !== 'high' && spots !== null ? riskySpots(spots)[0] : undefined;
  const reason = cause === undefined ? null : cause === 'window' && spots?.window?.isCondensing ? '窓が結露しているよ' : spotReasons[cause];
  return { reason, text: adviceText(advice) };
}
