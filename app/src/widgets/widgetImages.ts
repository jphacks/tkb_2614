import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { widgetsDirectory } from 'expo-widgets';

import type { MoldRiskLevel } from '../domain/prediction';
import type { CharacterKind } from '../ui/mascot/types';
import type { WidgetImages, WidgetIcons } from './widgetProps';

// scripts/renderWidgetImages.ts が assets/mascots から書き出した PNG。
const characterModules: Record<CharacterKind, Record<MoldRiskLevel, number>> = {
  mimi: {
    low: require('../../assets/widgets/mimi-low.png'),
    medium: require('../../assets/widgets/mimi-medium.png'),
    high: require('../../assets/widgets/mimi-high.png'),
  },
  antenna: {
    low: require('../../assets/widgets/antenna-low.png'),
    medium: require('../../assets/widgets/antenna-medium.png'),
    high: require('../../assets/widgets/antenna-high.png'),
  },
  fin: {
    low: require('../../assets/widgets/fin-low.png'),
    medium: require('../../assets/widgets/fin-medium.png'),
    high: require('../../assets/widgets/fin-high.png'),
  },
  mushroom: {
    low: require('../../assets/widgets/mushroom-low.png'),
    medium: require('../../assets/widgets/mushroom-medium.png'),
    high: require('../../assets/widgets/mushroom-high.png'),
  },
  cloudtail: {
    low: require('../../assets/widgets/cloudtail-low.png'),
    medium: require('../../assets/widgets/cloudtail-medium.png'),
    high: require('../../assets/widgets/cloudtail-high.png'),
  },
};

const iconModules: Record<keyof WidgetIcons, number> = {
  humidity: require('../../assets/widgets/icon-humidity.png'),
  temperature: require('../../assets/widgets/icon-temperature.png'),
  sync: require('../../assets/widgets/icon-sync.png'),
};

/** ウィジェットはアプリのバンドルを読めないので、App Group の共有ディレクトリにコピーしてその URL を渡す。 */
async function copyToWidgetsDirectory(name: string, module: number): Promise<string> {
  const [asset] = await Asset.loadAsync(module);
  if (!asset?.localUri) throw new Error(`ウィジェット用の画像 ${name} を読み込めませんでした。`);
  // Android のリリースビルドでは画像が drawable に埋め込まれ、localUri はスキームのないリソース名になる。
  // Android のウィジェットはリソース名をそのまま読めるので、コピーせずに渡す。
  if (!/^[a-z][a-z0-9+.-]*:/i.test(asset.localUri)) return asset.localUri;
  const destination = new File(widgetsDirectory, `${name}.png`);
  // 画像を作り直したときに古いものが残らないよう、起動ごとに上書きする。
  await new File(asset.localUri).copy(destination, { overwrite: true });
  return destination.uri;
}

async function copyAll<K extends string>(modules: Record<K, number>, prefix: string): Promise<Record<K, string>> {
  const keys = Object.keys(modules) as K[];
  const uris = await Promise.all(keys.map((key) => copyToWidgetsDirectory(`${prefix}-${key}`, modules[key])));
  return Object.fromEntries(keys.map((key, index) => [key, uris[index]])) as Record<K, string>;
}

let prepared: Promise<WidgetImages> | null = null;

/** プロセスごとに1回だけ用意する。失敗したら次の呼び出しでやり直す。 */
export function prepareWidgetImages(): Promise<WidgetImages> {
  prepared ??= Promise.all([
    Promise.all(
      (Object.keys(characterModules) as CharacterKind[]).map(
        async (kind) => [kind, await copyAll(characterModules[kind], kind)] as const,
      ),
    ),
    copyAll(iconModules, 'icon'),
  ])
    .then(([characters, icons]) => ({ characters: Object.fromEntries(characters) as WidgetImages['characters'], icons }))
    .catch((error: unknown) => {
      prepared = null;
      throw error;
    });
  return prepared;
}
