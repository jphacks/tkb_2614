# マスコット素材

`mimi`（みみばね）、`antenna`（ふさアンテナ）、`fin`（しめり背びれ）、
`mushroom`（きのこまもり）、`cloudtail`（くもりしっぽ）の原本SVGを置く。
各フォルダの `low.svg` / `medium.svg` / `high.svg` が危険度に対応する。
SVG内のCSSには待機・タップ時のキーフレームを含む。

React NativeではCSSアニメーションを直接実行できないため、変更後は
`node scripts/generate-mascots.mjs` を実行して
`src/ui/mascot/artwork.ts` を再生成する。生成データを `Character.tsx` と
`mascot/MotionGroup.tsx` がSVGのグループ単位で描画・アニメーションする。
みみばねの耳の回転中心は変換スクリプト内でSVG座標に補正している。

ホーム右上の切り替えボタンは5種類を循環し、横スワイプはページを移動する。
選択中の種類はARページにも反映する。危険度の変化ではSVGを即時切り替える。
計測値がないときは薄く静止表示し、端末の「視差効果を減らす」にも対応する。
