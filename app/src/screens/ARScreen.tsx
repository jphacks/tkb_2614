import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Button, Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MovingCharacters } from '../components/MovingCharacters';

export function ARScreen({ onBack }: { onBack: () => void }) {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [isActive, setIsActive] = useState(AppState.currentState !== 'background');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setIsActive(state === 'active');
      setCameraReady(false);
      if (state === 'active') {
        // 設定アプリで権限を変更した場合も反映する。
        void getPermission().catch(() => setActionError('カメラ権限を確認できませんでした。画面を開き直してください。'));
      }
    });
    return () => subscription.remove();
  }, [getPermission]);

  async function allowCamera() {
    setActionError(null);
    setRequesting(true);
    try {
      await requestPermission();
    } catch {
      setActionError('カメラ権限を取得できませんでした。もう一度お試しください。');
    } finally {
      setRequesting(false);
    }
  }

  const showCamera = permission?.granted && isActive && !cameraError;

  return (
    <View style={styles.container}>
      {showCamera && (
        <CameraView
          key={cameraKey}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => { setCameraError(true); setCameraReady(false); }}
        />
      )}
      <SafeAreaView style={styles.overlay}>
        <View style={styles.header}>
          <Button title="ホームに戻る" onPress={onBack} color="#a9d9ff" />
          <Text style={styles.title}>AR（仮）</Text>
        </View>
        {showCamera && cameraReady ? <MovingCharacters /> : (
          <View style={styles.message}>
            {!permission ? (
              <><ActivityIndicator color="#fff" /><Text style={styles.text}>カメラ権限を確認中…</Text></>
            ) : !permission.granted ? (
              <>
                <Text style={styles.text}>キャラを部屋に表示するため、カメラの使用を許可してください。</Text>
                {permission.canAskAgain ? (
                  <Button title="カメラを許可する" disabled={requesting} onPress={() => void allowCamera()} />
                ) : (
                  <>
                    <Text style={styles.text}>端末の設定からカメラの使用を許可してください。</Text>
                    {Platform.OS === 'web' ? (
                      <Text style={styles.text}>ブラウザのサイト設定でカメラを許可し、ページを再読み込みしてください。</Text>
                    ) : (
                      <Button title="設定を開く" onPress={() => {
                        void Linking.openSettings().catch(() => setActionError('設定を開けませんでした。端末の設定から変更してください。'));
                      }} />
                    )}
                  </>
                )}
              </>
            ) : cameraError ? (
              <>
                <Text style={styles.text}>カメラを起動できませんでした。カメラのある実機で、ほかのアプリのカメラを閉じてお試しください。</Text>
                <Button title="再試行" onPress={() => {
                  setCameraReady(false);
                  setCameraError(false);
                  setCameraKey((key) => key + 1);
                }} />
              </>
            ) : (
              <><ActivityIndicator color="#fff" /><Text style={styles.text}>{isActive ? 'カメラを起動中…' : 'カメラを一時停止中'}</Text></>
            )}
          </View>
        )}
        {actionError && <Text style={styles.error} accessibilityRole="alert">{actionError}</Text>}
        <Text style={styles.caption}>カメラ映像にキャラを重ねる試作です</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#151c21' },
  overlay: { flex: 1 },
  header: { padding: 12, gap: 8, backgroundColor: '#151c21cc' },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center' },
  message: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16 },
  text: { color: '#fff', textAlign: 'center', fontSize: 16 },
  error: { color: '#ffb4ab', padding: 16, backgroundColor: '#151c21cc' },
  caption: { color: '#fff', backgroundColor: '#151c21cc', textAlign: 'center', padding: 16 },
});
