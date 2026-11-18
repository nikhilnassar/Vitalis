import { registerRootComponent } from 'expo';
import { installGlobalHandler } from './src/errors';
import App from './App';

installGlobalHandler();
try {
  // Defines the background task before the app mounts. A failure here must never stop the app opening.
  require('./src/background');
} catch {}
registerRootComponent(App);
