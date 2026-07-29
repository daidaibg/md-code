import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const sourceDirectory = fileURLToPath(new URL('./src', import.meta.url));
const monacoEsmDirectory = fileURLToPath(
  new URL('./node_modules/monaco-editor/esm/vs', import.meta.url)
);
const monacoMinDirectory = fileURLToPath(
  new URL('./node_modules/monaco-editor/min/vs', import.meta.url)
);

export default defineConfig({
  plugins: [vue()],
  optimizeDeps: {
    exclude: ['monaco-editor']
  },
  server: {
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  resolve: {
    alias: [
      { find: '@', replacement: sourceDirectory },
      { find: /^monaco-editor\/esm\/vs/, replacement: monacoEsmDirectory },
      { find: /^monaco-editor\/min\/vs/, replacement: monacoMinDirectory }
    ]
  }
});
