import { Roboto_500Medium, Roboto_600SemiBold, useFonts } from '@expo-google-fonts/roboto';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import { createAppServices } from './src/services/createAppServices';

export default function App() {
  const [services] = useState(createAppServices);
  const [fontsLoaded] = useFonts({ Roboto_500Medium, Roboto_600SemiBold });

  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <HomeScreen services={services} />
    </SafeAreaProvider>
  );
}
