import { mount } from 'svelte';
import App from './ui/App.svelte';

const target = document.getElementById('app');
if (target === null) throw new Error('index.html has no #app element');

mount(App, { target });
