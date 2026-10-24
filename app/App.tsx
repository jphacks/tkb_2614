import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EnvironmentScreen } from './src/screens/EnvironmentScreen';
import { createAppServices } from './src/services/createAppServices';

export default function App() {
  const [services] = useState(createAppServices);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <EnvironmentScreen services={services} />
    </SafeAreaProvider>
  );
}
