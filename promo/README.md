# カビのしらせ 紹介動画

[`app/`](../app) のアプリを Android エミュレーターで実際に操作して録画し、Remotion でスマホのフレーム・タップの演出・ズーム・テロップを付けて、30秒・縦型（1080x1920）の MP4 を作る。

- 操作と録画: [agent-device](https://oss.callstack.com/agent-device/)（devDependency）。手順は `record/record.sh`。
- 編集: [Remotion](https://www.remotion.dev/)。構成・テロップ・ズームはすべて `src/Promo.tsx` に書く。
- Claude Code 用の Remotion Agent Skills は `promo/.claude/skills/` に入っている（`promo/` で `pnpm dlx skills add remotion-dev/skills` を実行して入れたもの）。

録画（`public/recordings/*.mp4`）と、その操作の記録（`*.events.json`）は分けて持つ。演出の直しは録画し直さずに `src/Promo.tsx` だけで済む。

## 必要なもの

- Node.js 22.12 以上、pnpm、ffmpeg
- Android SDK のエミュレーター（`Medium_Phone_API_35`、1080x2400 で確認）

コマンドはすべて `promo/` で実行する。

```sh
pnpm install
```

## 1. 録画用のアプリを用意する

作業ツリーを汚さないよう、別の worktree でモックの release ビルドを作る。release にするのは、dev ビルドだけに出る「DEV」ボタンを映さないため。

```sh
git worktree add --detach ../../tkb_2614-promo-rec main
cd ../../tkb_2614-promo-rec/app && pnpm install
~/Library/Android/sdk/emulator/emulator -avd Medium_Phone_API_35 &
```

テイクは2つで、モックの値だけを変える（変更はコミットしない）。

| テイク | モックの変更 | 映るもの |
|---|---|---|
| `low` | なし | メインが低リスク（fine の表情）、グラフ |
| `humid` | `src/data/mock/samples.ts` の配列を `.map((s) => ({ temperatureC: s.temperatureC - 3, relativeHumidityPercent: Math.min(95, s.relativeHumidityPercent + 16) }))` で変換し、`MockMeasurementSource.ts` の既定 `epoch` を `Date.UTC(2026, 0, 1)` に変える | メインが中リスク（worried・カビ背景）、部屋は窓（結露）と棚が高・ベッドが中 |

テイクごとにビルドして入れる。初回は全 ABI のネイティブビルドで20分ほどかかり、2回目以降（JS の変更だけ）は1分かからない。アプリは計測履歴を端末に保存しているので、テイクを切り替えたら `pm clear` で消す。

```sh
EXPO_PUBLIC_MEASUREMENT_SOURCE=mock pnpm expo run:android --variant release --no-bundler
adb shell pm clear com.jphacks.tkb2614
```

## 2. 録画する

```sh
pnpm record low     # low のビルドが入った状態で
pnpm record humid   # humid のビルドを入れ直してから
```

`record/record.sh` は次のことをする。

1. ステータスバーを 9:41・電池満タンに固定する。
2. タップ・スワイプをしながら録画する。録画にはタッチ表示を焼き込まない（`--hide-touches`）。
3. 録画を 30fps 固定にし、末尾を6秒延ばす。screenrecord は画面が止まるとフレームを書かないため。
4. `<take>.events.json`（操作の映像上の時刻 ms と座標）を書く。

agent-device が書く `<take>.gesture-telemetry.json` の時刻は record start が基準で、録画の先頭とのずれが毎回変わる（-0.4〜+3.7秒）。そこで、最後のスワイプで隣のページが入ってくる瞬間を ffmpeg で映像から探し、その差で全操作の時刻を補正している。そのため、どのテイクも最後の操作はページ送りのスワイプにする。タップの波紋・効果音とスワイプの軌跡は、この events.json をもとに Remotion で描く。

撮れたものは `pnpm exec agent-device record contact-sheet public/recordings/low.mp4` で一覧にして確かめられる。agent-device のセッションが残っていて失敗したときは、もう一度実行する。

## 3. 編集・書き出し

```sh
pnpm studio   # プレビュー
pnpm render   # out/chiikabi-promo.mp4
```

- シーンの順番・長さ・テロップ・ズーム先（録画上の px）は `src/Promo.tsx`。各シーンの切り出し位置は events.json のタップ・スワイプの時刻から決めているので、撮り直してもずれない。
- タップの波紋が映像とずれるときは、`src/Phone.tsx` の `RECORD_OFFSET_MS` で合わせる。
- 効果音はアプリのタップ音（`public/sounds/`、`app/assets/sounds/` のコピー）。BGM はない。

Remotion は、社員3人以下の個人・チームなら無料で使える（[ライセンス](https://www.remotion.dev/license)）。
