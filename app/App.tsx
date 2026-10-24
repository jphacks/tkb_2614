import { Roboto_500Medium, Roboto_600SemiBold, useFonts } from '@expo-google-fonts/roboto';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ARScreen } from './src/screens/ARScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { createAppServices } from './src/services/createAppServices';

export default function App() {
  const [services] = useState(createAppServices);
  const [screen, setScreen] = useState<'home' | 'ar'>('home');
  const [fontsLoaded, fontError] = useFonts({ Roboto_500Medium, Roboto_600SemiBold });

  // 読み込みに失敗したらシステムフォントで表示する。
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      {screen === 'ar' ? (
        <>
          <StatusBar style="light" />
          <ARScreen onBack={() => setScreen('home')} />
        </>
      ) : (
        <HomeScreen services={services} onOpenAR={() => setScreen('ar')} />
      )}
    </SafeAreaProvider>
  );
}
