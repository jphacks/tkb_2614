import { Roboto_500Medium, Roboto_600SemiBold, useFonts } from '@expo-google-fonts/roboto';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import { createAppServices } from './src/services/createAppServices';

export default function App() {
  const [services] = useState(createAppServices);
  const [fontsLoaded, fontError] = useFonts({ Roboto_500Medium, Roboto_600SemiBold });

  // 読み込みに失敗したらシステムフォントで表示する。
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <HomeScreen services={services} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
