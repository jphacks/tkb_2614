# 環境アクションのアニメーション素材

キャラの吹き出しに出す、窓の開閉などのアクションの原本SVGを置く。画面に文言は出さず、吹き出しにはこのアニメーションだけを出す。
`preview.html` をブラウザーで開くと、全6種類の動きを確認できる。

| ファイル | 内容 | 使う判定（`src/ui/ventilationMessage.ts`） |
|---|---|---|
| `window-open.svg` | 窓を開けて換気する | open |
| `window-open-brief.svg` | 少しだけ開ける（タイマー付き） | open（brief、外が寒い） |
| `window-close-rain.svg` | 雨で窓を閉める | keep / rain |
| `window-close-wind.svg` | 強風で窓を閉める | keep / wind |
| `window-close-pollen.svg` | 花粉で窓を閉める | まだ使わない（花粉の判定がない） |
| `aircon-dry.svg` | エアコン・除湿機で除湿する | keep / hot、close（外のほうが湿っている） |

アニメーションはSVG内のCSS（キーフレーム）で書かれている。React NativeではCSSアニメーションを直接実行できないため、
変更後は `node scripts/generate-actions.mjs` を実行して `src/ui/action/artwork.ts` を再生成する。
生成データを `src/ui/ActionAnimation.tsx` がグループ単位で動かす（変形と不透明度）。
対応するのは transform（translate・rotate・scale）と opacity のキーフレームで、それ以外はエラーにする。
メインページを見ていないとき・バックグラウンド・「視差効果を減らす」設定では止め、動かす前の姿で表示する。
`tests/actionGenerator.test.mjs` で、生成データが原本SVGと一致しているかを確認する。
