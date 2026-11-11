import { registerRootComponent } from 'expo';
import './src/background'; // defines the background task before the app mounts
import { installGlobalHandler } from './src/errors';
import App from './App';

installGlobalHandler();
registerRootComponent(App);
