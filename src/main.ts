import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { installEditorSessionPersistence, restoreEditorSession } from '@/document/sessionPersistence';
import { router } from '@/router';
import './themes/global.scss';
import 'katex/dist/katex.min.css';

const pinia = createPinia();
restoreEditorSession(pinia);

// WebView/浏览器原生菜单不属于应用交互；保留事件传播供 Monaco 和 Tab 自定义菜单处理。
document.addEventListener('contextmenu', (event) => event.preventDefault(), { capture: true });

createApp(App).use(pinia).use(router).mount('#app');
installEditorSessionPersistence(pinia);
