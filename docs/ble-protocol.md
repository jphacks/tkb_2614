# chiikabi BLE 通信仕様（形式バージョン 2）

ESP32（chiikabi）とスマホアプリの BLE 通信の取り決め。ESP32 は 1 時間ごとに温湿度を測り、**計測時刻を主キーにして 1 年分ためておく**。アプリは数分おきに接続し、「この時刻から最新まで」を要求して記録をまとめて受け取る。

- ESP32 がペリフェラル、スマホがセントラル。ESP32 からスマホへ接続しにいくことはない
- 数値はすべてリトルエンディアン
- 時刻はすべて UNIX 時間（UTC 基準の秒、uint32）
- 受け取ったかどうかを ESP32 に伝える必要はない（ACK はない）。同じ記録を何度読んでもよい
- ファームウェアの定義は `firmware/ble.h`。UUID やバイト形式を変えるときは、このファイル・`firmware/`・`app/` を同じコミットで直す

## 全体の流れ

```
アプリ                                         ESP32
  │──── 接続（Android は MTU 517 を要求）────────────→│
  │──── データの Notify を購読 ───────────────────→│
  │──── 制御に「開始時刻 T 以降をください」          │
  │     ＋「端末の現在時刻」を Write ───────────────→│ 必要なら端末の時刻で時計を合わせる
  │←─── 記録（1 通知に複数件）…… ─────────────────────│
  │←─── 終了の印 ──────────────────────────────────│
  │──── 切断 ─────────────────────────────────────→│ アドバタイズ再開
  │ （計測時刻をキーにして手元のデータに反映）           │
```

例えば直近 1 ヶ月分がほしければ、開始時刻に「端末の現在時刻 − 30 日」を入れる。1 ヶ月分は約 720 件・約 5.8KB。

## 1. 時刻と記録の約束（ESP32 側の動き）

計測時刻を主キーにするため、ESP32 は次のように動く。アプリは「記録の時刻は正しく、重複しない」と考えてよい。

| 約束 | 内容 |
|---|---|
| 時計の合わせ方 | 起動時に Wi-Fi 経由の NTP で合わせる。うまくいかないとき・最後に合わせてから 24 時間経ったときは、10 分おきに NTP を試し直す |
| 端末の時刻を使う条件 | 送信要求に入っている端末の現在時刻は、ESP32 が**未同期**か、最後に時計を合わせてから **24 時間以上**経っているときだけ使う。それ以外は NTP の時刻を優先し、端末の時刻では上書きしない |
| 未同期の間 | 計測しても記録しない。時計が合った時点で計測し直して記録する |
| 時刻は必ず増える | 直前の記録と同じか古い時刻の記録は作らない（時計の合わせ直しで時計が戻った場合など） |
| 保持期間 | 1 年。記録を追加するたびに、その時刻から 365 日より古い記録を消す |
| 電源断 | 記録はフラッシュに残る。時計は消えるので、起動し直すと未同期から始まる |

## 2. デバイスを見つける（アドバタイズ）

| 項目 | 値 |
|---|---|
| デバイス名 | `chiikabi` |
| アドバタイズ間隔 | 100〜200ms |
| サービス UUID | スキャン応答に入っている（アドバタイズ本体には入っていない） |

アドバタイズ本体に入っている Manufacturer Data（8 バイト）:

| バイト | 内容 | 型 | 備考 |
|---|---|---|---|
| 0–1 | 会社 ID | uint16 | `0xFFFF`（テスト用の値） |
| 2 | 形式バージョン | uint8 | `2` |
| 3 | フラグ | uint8 | bit0: ESP32 の時刻が同期済み |
| 4–7 | 最新の記録の時刻 | uint32 | 記録がなければ 0 |

例: `FF FF 02 01 40 2D DC 6A` は「時刻同期済み、最新の記録は 1792814400（2026-10-24 13:00:00 JST）」。

最新の記録の時刻を前回の値と比べれば、接続しなくても新しい記録が増えたかがわかる。

**見つけ方の注意**: サービス UUID はスキャン応答にしか入っていないので、OS のスキャンフィルタに UUID を指定すると見つからない場合がある。フィルタなしでスキャンし、名前 `chiikabi` か、会社 ID `0xFFFF`・形式バージョン `2` の Manufacturer Data で絞り込むのが確実。

## 3. GATT

| 名前 | UUID | 操作 |
|---|---|---|
| サービス | `a29c0001-756b-4378-90b5-8651bbdbe79e` | |
| 状態 | `a29c0002-756b-4378-90b5-8651bbdbe79e` | Read |
| 制御 | `a29c0003-756b-4378-90b5-8651bbdbe79e` | Write（応答あり） |
| データ | `a29c0004-756b-4378-90b5-8651bbdbe79e` | Notify |

暗号化やペアリングは今は不要（「7. 今後変わる予定のこと」を参照）。同時に接続できるのは 1 台だけ。

## 4. 状態（Read、23 バイト）

送信要求には必須ではない。ESP32 の状態を確認したいときに読む。

| バイト | 内容 | 型 | 備考 |
|---|---|---|---|
| 0 | 形式バージョン | uint8 | `2` |
| 1 | フラグ | uint8 | bit0: ESP32 の時刻が同期済み |
| 2–5 | 記録の件数 | uint32 | ESP32 が保持している全件数 |
| 6–9 | 最古の記録の時刻 | uint32 | 記録がなければ 0 |
| 10–13 | 最新の記録の時刻 | uint32 | 記録がなければ 0 |
| 14–17 | ESP32 の現在時刻 | uint32 | 未同期なら 0 |
| 18–21 | 最後に時計を合わせた時刻 | uint32 | 未同期なら 0 |
| 22 | 最後に時計を合わせた手段 | uint8 | `0` 未同期 / `1` NTP / `2` 端末 |

## 5. 制御（Write、9 バイト）

| バイト | 内容 | 型 |
|---|---|---|
| 0 | 命令 | uint8。`0x01`（送信要求）だけ |
| 1–4 | 開始時刻 | uint32。この時刻**以上**の記録を送る。0 なら全件 |
| 5–8 | 端末の現在時刻 | uint32 |

例: 端末の現在時刻が 2026-10-24 15:00:00 JST（1792821600）で、30 日前の 2026-09-24 15:00:00 JST（1790229600）以降を要求するなら `01 60 BC B4 6A 60 49 DC 6A`。

ESP32 は、計測時刻が開始時刻以上の記録を、古い順にデータの Notify で全部送る。送る前に、必要なら端末の現在時刻で時計を合わせる（「1. 時刻と記録の約束」を参照）。

- 長さが 9 バイトでない書き込みや、知らない命令は無視される（エラー応答は返らない）
- データの Notify を購読する**前**に送信要求を書くと、記録は送られない（時計合わせだけは行われる）。必ず購読してから書く
- 送信中に次の送信要求を書くと、そこから送り直しになる

## 6. データ（Notify）

1 件 8 バイトの記録を、1 回の通知に MTU（1 回に送れるサイズ）に収まるだけ詰めて送る。

| バイト | 内容 | 型 | 備考 |
|---|---|---|---|
| 0–3 | 計測時刻 | uint32 | 主キー。1 以上 |
| 4–5 | 温度 ×100 | int16 | ℃。`-32768`（INT16_MIN）は読み取り失敗 |
| 6–7 | 湿度 ×100 | uint16 | %RH（0〜10000）。`0xFFFF` は読み取り失敗 |

例: `40 2D DC 6A F2 09 EE 14` は「2026-10-24 13:00:00 JST（1792814400）、25.46℃、53.58%」。

1 回の通知に入る件数は `floor((MTU − 3) / 8)`。

| MTU | 1 通知あたり | 1 ヶ月分（720 件）の通知回数 |
|---|---|---|
| 23（初期値） | 2 件 | 360 回 |
| 185 前後（iOS でよくある値） | 22 件 | 33 回 |
| 517（Android で要求した場合） | 64 件 | 12 回 |

**終了の印**: 送り終えたら、計測時刻 0 の 8 バイト（全バイト 0）を送る。終了の印は最後の記録と同じ通知に入ることもあれば、単独の通知で来ることもある。受け取った通知を 8 バイトずつ区切って読み、計測時刻が 0 の区切りが出たら完了とする。

```
例: 3 件、MTU が十分大きい場合
通知1: [記録1][記録2][記録3][00 × 8]

例: 3 件、MTU 23 の場合
通知1: [記録1][記録2]
通知2: [記録3][00 × 8]
```

該当する記録がなければ、終了の印だけが届く。

## 7. エラー時・注意点

- **途中で切断されたとき**: ESP32 は送信をやめる。次の接続で同じ要求をし直せばよい
- **終了の印が届かないとき**: アプリ側でタイムアウトを設けて切断する。受け取った分は正しい記録なので、使ってよい
- **同じ記録が何度も届く**: 毎回同じ期間を要求すれば、前回と同じ記録がまた届く。アプリは計測時刻をキーにして上書き（または重複を無視）する
- **記録の間隔**: 通常は 1 時間おき。電源が切れていた期間や時計が未同期だった期間は記録が抜ける。時計が合った直後は、前の記録から 1 時間経たずに記録されることがある
- **時刻を ESP32 に設定する命令はない**: 端末の時刻は送信要求のたびに渡し、使うかどうかは ESP32 が「1. 時刻と記録の約束」に従って決める
- **MTU**: Android は接続時に MTU 517 を要求すると速い（react-native-ble-plx なら `connectToDevice(id, { requestMTU: 517 })`）。iOS は OS が自動で決める

## 8. 今後変わる予定のこと

- **ペアリング（ボンディング）**: 最後に追加する予定。追加すると、ペアリング済みのスマホしか接続できなくなり、初回接続時に OS のペアリングのダイアログが出る。バイト形式は変わらない
- **会社 ID** `0xFFFF` はテスト用の値で、正式な ID は持っていない。製品化しない限りこのままにする
- 形式を変えるときは、アドバタイズと状態の形式バージョンを上げる

## 形式バージョン 1 からの変更点

| 項目 | バージョン 1 | バージョン 2 |
|---|---|---|
| 主キー | 通し番号 | 計測時刻 |
| 記録のサイズ | 12 バイト（通し番号つき） | 8 バイト |
| 削除 | アプリの ACK で削除 | 1 年より古いものを自動で削除。ACK はない |
| 送信要求 | `01` + 通し番号（5 バイト） | `01` + 開始時刻 + 端末の現在時刻（9 バイト） |
| 未同期のとき | 時刻 0 で記録 | 記録しない |
| 終了の印 | 12 バイトの 0 | 8 バイトの 0 |

アプリ側の実装は `app/src/data/ble/protocol.ts`（バイト形式）と `app/src/data/ble/BleMeasurementSource.ts`（スキャン〜受信）にある。

## TypeScript でのデコード例

react-native-ble-plx では、値は base64 文字列で渡される。`Uint8Array` に直してから下の関数に渡す。Manufacturer Data（`device.manufacturerData`）は先頭の会社 ID も含む。

```ts
export const SERVICE_UUID = 'a29c0001-756b-4378-90b5-8651bbdbe79e';
export const STATUS_UUID = 'a29c0002-756b-4378-90b5-8651bbdbe79e';
export const CONTROL_UUID = 'a29c0003-756b-4378-90b5-8651bbdbe79e';
export const DATA_UUID = 'a29c0004-756b-4378-90b5-8651bbdbe79e';

const PROTOCOL_VERSION = 2;
const RECORD_SIZE = 8;

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const toDate = (epoch: number) => (epoch === 0 ? null : new Date(epoch * 1000));

/** アドバタイズの Manufacturer Data（8 バイト）。chiikabi のものでなければ null */
export function decodeAdvertisement(b: Uint8Array) {
  if (b.byteLength !== 8) return null;
  const v = view(b);
  if (v.getUint16(0, true) !== 0xffff || v.getUint8(2) !== PROTOCOL_VERSION) return null;
  return {
    timeSynced: (v.getUint8(3) & 0x01) !== 0,
    latestRecordAt: toDate(v.getUint32(4, true)),
  };
}

/** 状態（23 バイト） */
export function decodeStatus(b: Uint8Array) {
  if (b.byteLength !== 23) throw new Error('状態は 23 バイト必要です。');
  const v = view(b);
  if (v.getUint8(0) !== PROTOCOL_VERSION) throw new Error('未対応の状態形式です。');
  return {
    timeSynced: (v.getUint8(1) & 0x01) !== 0,
    recordCount: v.getUint32(2, true),
    oldestRecordAt: toDate(v.getUint32(6, true)),
    latestRecordAt: toDate(v.getUint32(10, true)),
    deviceTime: toDate(v.getUint32(14, true)),
    lastClockSyncAt: toDate(v.getUint32(18, true)),
    lastClockSyncSource: (['none', 'ntp', 'phone'] as const)[v.getUint8(22)] ?? 'none',
  };
}

/** 制御に書く 9 バイト。since 以降の記録を要求し、端末の現在時刻も渡す */
export function encodeSendRequest(since: Date, now: Date = new Date()): Uint8Array {
  const b = new Uint8Array(9);
  const v = view(b);
  v.setUint8(0, 0x01);
  v.setUint32(1, Math.floor(since.getTime() / 1000), true);
  v.setUint32(5, Math.floor(now.getTime() / 1000), true);
  return b;
}

/** 記録 1 件（8 バイト） */
export function decodeRecord(b: Uint8Array) {
  const v = view(b);
  const temperature = v.getInt16(4, true);
  const humidity = v.getUint16(6, true);
  return {
    measuredAt: new Date(v.getUint32(0, true) * 1000), // 主キー
    temperatureC: temperature === -32768 ? null : temperature / 100,
    relativeHumidityPercent: humidity === 0xffff ? null : humidity / 100,
  };
}

/** データの通知 1 回分を記録に分ける。終了の印が含まれていれば done = true */
export function decodeDataNotification(b: Uint8Array) {
  if (b.byteLength % RECORD_SIZE !== 0) throw new Error('通知の長さが 8 の倍数ではありません。');
  const records: ReturnType<typeof decodeRecord>[] = [];
  for (let i = 0; i < b.byteLength; i += RECORD_SIZE) {
    const chunk = b.subarray(i, i + RECORD_SIZE);
    if (view(chunk).getUint32(0, true) === 0) return { records, done: true };
    records.push(decodeRecord(chunk));
  }
  return { records, done: false };
}

// 使い方: 直近 30 日分を要求する
// const now = new Date();
// const request = encodeSendRequest(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now);
```

## 動作確認

nRF Connect for Mobile で手動で確認できる。

1. `chiikabi` に接続し、`a29c0004` の Notify を購読する
2. `a29c0003` に BYTE ARRAY で `01` + 開始時刻 + 端末の現在時刻（例: 全件なら `01 00000000` + 現在時刻）を書く
3. `a29c0004` に記録と終了の印が届く

ESP32 を USB でつなぎ、シリアルモニター（115200 baud）で `help` と打つと、記録の追加・表示や時計・BLE の状態確認ができる。
