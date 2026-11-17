import { mount } from 'svelte';
import { createApp } from './commands/app';
import { installControl } from './control/control';
import App from './ui/App.svelte';

const target = document.getElementById('app');
if (target === null) throw new Error('index.html has no #app element');

const app = createApp();

// The control channel exists in the dev server and in the e2e build (`vite build --mode e2e`).
// In the production build this condition is the constant `false` and the bundler drops the code.
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') installControl(window, app);

mount(App, { target, props: { app } });
