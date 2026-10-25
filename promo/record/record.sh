#!/usr/bin/env bash
# Usage: pnpm record <low|humid>
# 起動中の Android エミュレーターに、そのテイク用のモックで作った release ビルドが入っている前提（README 参照）。
# public/recordings/<take>.mp4 と、操作の時刻（映像の時刻, ms）・座標の <take>.events.json を書く。
set -euo pipefail
take=${1:?usage: record.sh <low|humid>}
cd "$(dirname "$0")/.."
APP=${APP:-com.jphacks.tkb2614}
video=public/recordings/$take.mp4
ad() { pnpm exec agent-device "$@" --platform android; }

# 画面 1080x2400 の座標。キャラの胴体と、ページ送りのスワイプの高さ。
CX=540 CY=1360 SWIPE_Y=1500
# 指を左から右へ動かすと左のページ（グラフ）へ、右から左で右のページ（部屋）へ送る。
to_left() { ad swipe 200 $SWIPE_Y 900 $SWIPE_Y; }
to_right() { ad swipe 900 $SWIPE_Y 200 $SWIPE_Y; }

# ステータスバーを 9:41・電池満タン・通知なしに固定する。
adb shell settings put global sysui_demo_allowed 1
demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" > /dev/null; }
demo enter
demo clock -e hhmm 0941
demo battery -e level 100 -e plugged false
demo network -e wifi show -e level 4
demo network -e mobile show -e datatype none -e level 4
demo notifications -e visible false
trap 'demo exit' EXIT

ad open "$APP" --relaunch
sleep 5 # 同期とフォントの読み込みを待つ

ad record start "$video" --hide-touches --quality high
sleep 2.5
case $take in
  low)
    ad press $CX $CY; sleep 3
    to_left; sleep 5
    ;;
  humid)
    ad press $CX $CY; sleep 3.5
    to_right; sleep 5
    ;;
  *) echo "unknown take: $take" >&2; exit 1 ;;
esac
ad record stop
ad close

# screenrecord は画面が変わったときしかフレームを書かず、止まった画面の後ろが切れる。
# 30fps 固定にし、最後のフレームを延ばして、編集でどこを切り出しても映像があるようにする。
tmp=$(mktemp -t "$take").mp4
ffmpeg -v error -y -i "$video" -vf "fps=30,tpad=stop_mode=clone:stop_duration=6" -an -c:v libx264 -crf 16 -pix_fmt yuv420p "$tmp"
mv "$tmp" "$video"

# telemetry の tMs は record start からの時刻で、録画の先頭とのずれが毎回変わる（実測で -0.4〜+3.7 秒）。
# 最後の操作のスワイプで隣のページが入ってくる瞬間を映像から探し、その差で全操作の時刻を映像の時刻に直す。
# 見るのはメイン画面では何もない帯（y=300〜700）の平均輝度。
swiped_s=$(ffmpeg -v error -i "$video" -vf "crop=1080:400:0:300,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -an -f null - |
  awk '/pts_time/ { split($3, a, ":"); t = a[2] } /YAVG/ { split($0, b, "="); if (base == "") base = b[2]; d = b[2] - base; if (d * d > 1) { print t; exit } }')
node -e '
  const fs = require("fs");
  const [telemetry, out, swipedS] = process.argv.slice(1);
  const events = JSON.parse(fs.readFileSync(telemetry, "utf8")).events;
  const offset = swipedS * 1000 - events.at(-1).tMs;
  fs.writeFileSync(out, JSON.stringify(events.map((e) => ({ ...e, tMs: Math.round(e.tMs + offset) })), null, 2) + "\n");
' "public/recordings/$take.gesture-telemetry.json" "public/recordings/$take.events.json" "${swiped_s:?swipe not found in $video}"
echo "wrote $video public/recordings/$take.events.json (swipe at ${swiped_s}s)"
