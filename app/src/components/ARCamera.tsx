import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { space, type, useScheme } from '../theme/theme';
import { Character } from '../ui/Character';

/** 起動ごとにreadyをリセットし、準備中は下の部屋の絵を透かす。 */
function CameraFeed({ onError }: { onError: () => void }) {
  const [ready, setReady] = useState(false);
  return (
    <CameraView
      style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]}
      facing="back"
      onCameraReady={() => setReady(true)}
      onMountError={onError}
    />
  );
}

/** シーンの親を維持し、ARが見える間だけカメラと権限処理を動かす。 */
export function ARCamera({ isVisible, isActive, children, bottomInset }: {
  isVisible: boolean;
  isActive: boolean;
  children: ReactNode;
  bottomInset: number;
}) {
  const scheme = useScheme();
  const [permission, requestPermission, getPermission] = useCameraPermissions({ get: false });
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (!isVisible || !isActive) return;
    let cancelled = false;
    async function prepare() {
      try {
        // 設定アプリから戻った際の権限変更も確認する。
        const current = await getPermission();
        // 確認中にスワイプで離れた場合は、ダイアログを出さない。
        if (cancelled || current.status !== 'undetermined' || busy.current) return;
        busy.current = true;
        try {
          await requestPermission();
        } finally {
          busy.current = false;
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void prepare();
    return () => { cancelled = true; };
  }, [isVisible, isActive, getPermission, requestPermission]);

  async function retry() {
    if (busy.current) return;
    busy.current = true;
    try {
      if (!permission) {
        setFailed(false);
        await getPermission();
      } else if (permission.granted) {
        setFailed(false);
      } else if (permission.canAskAgain) {
        setFailed(false);
        await requestPermission();
      } else if (Platform.OS !== 'web') {
        await Linking.openSettings();
      } else {
        await requestPermission();
      }
    } catch {
      setFailed(true);
    } finally {
      busy.current = false;
    }
  }

  const denied = permission?.status === 'denied';
  const needsAction = isVisible && isActive && (denied || failed);
  const actionLabel = permission?.granted ? 'カメラを再試行' : permission?.canAskAgain ? 'カメラを許可' : 'カメラの設定を開く';

  return (
    <View style={StyleSheet.absoluteFill}>
      {isVisible && isActive && permission?.granted && !failed && <CameraFeed onError={() => setFailed(true)} />}
      {children}
      {needsAction && (
        <View style={[styles.recovery, { backgroundColor: scheme.surface, paddingBottom: bottomInset }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={() => void retry()}>
            <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              <Character mood="sleep" size={276} />
            </View>
          </Pressable>
          {denied && (
            <Text style={[type.body, styles.message, { color: scheme.onSurfaceVariant }]}>
              {Platform.OS === 'web' && !permission.canAskAgain
                ? 'ブラウザの設定でカメラを許可してください。'
                : 'タップしてカメラを許可'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  recovery: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.s24, paddingHorizontal: space.s24 },
  message: { textAlign: 'center' },
});
