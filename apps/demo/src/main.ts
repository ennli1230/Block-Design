import { createApp } from 'vue';
import { resetWorkspaceCache } from './workspace-reset';
import '@blockdesign/editor/style.css';
import 'grapesjs/dist/css/grapes.min.css';
import './demo.css';

async function start() {
  await resetWorkspaceCache(localStorage);
  const { default: App } = await import('./App.vue');
  createApp(App).mount('#app');
}
void start();
