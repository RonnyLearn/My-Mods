import './styles.css';
import { App } from './app';
import { DesktopPlatform } from './platform/desktop';
import { WebPlatform } from './platform/web';

// The same UI runs in the browser and in the Electron desktop app; only the platform layer differs.
const platform = window.neonDesktop ? new DesktopPlatform(window.neonDesktop) : new WebPlatform();
const app = new App(platform);
app.init();

// `?debug` exposes the app instance for automated tests and console tinkering.
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { neonkeys: app });
