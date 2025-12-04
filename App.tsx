/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import MainScreen from './src/screens/MainScreen';

function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
        <MainScreen />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

export default App;
