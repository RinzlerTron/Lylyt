/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Suppress known warnings in dev mode
LogBox.ignoreLogs([
  'InteractionManager has been deprecated',
  'Require cycle:',
]);

AppRegistry.registerComponent('Lylyt', () => App);
