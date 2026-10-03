import { registerRootComponent } from 'expo';

import Root from './src/Root';

// registerRootComponent calls AppRegistry.registerComponent('main', () => Root);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately. Root picks the theme, then loads App.
registerRootComponent(Root);
