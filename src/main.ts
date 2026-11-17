import { mount } from 'svelte';
import { createApp } from './commands/app';
import { installControl } from './control/control';
import { createRealTimeDriver } from './time/real-time-driver';
import App from './ui/App.svelte';

const target = document.getElementById('app');
if (target === null) throw new Error('index.html has no #app element');

// The running site has a live clock: wall time goes into the player clock once per frame.
// The first move of the clock by a command (a test, the control channel) stops that for good,
// so wall time never mixes into a scripted run.
const live: { stop?: () => void } = {};
const app = createApp({ onManualClock: () => live.stop?.() });
const driver = createRealTimeDriver(app.clock);
live.stop = () => {
  driver.stop();
};
driver.start();

// The control channel exists in the dev server and in the e2e build (`vite build --mode e2e`).
// In the production build this condition is the constant `false` and the bundler drops the code.
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') installControl(window, app);

mount(App, { target, props: { app } });
