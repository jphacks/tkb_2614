import type { ConfigContext, ExpoConfig } from 'expo/config';

// Personal Team では bundle identifier を人ごとに変える必要があるので、app.json に書かず .env.local から読む。
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  ios: { ...config.ios, bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER },
});
