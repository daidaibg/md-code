/// <reference types="vite/client" />

interface MonacoWorkerEnvironment {
  getWorker(workerId: string, label: string): Worker;
}

interface Window {
  MonacoEnvironment: MonacoWorkerEnvironment;
}

declare var MonacoEnvironment: MonacoWorkerEnvironment;


declare module '*.css?inline' {
  const css: string;
  export default css;
}

declare module 'monaco-editor/esm/vs/nls/lang/zh-cn.js';
