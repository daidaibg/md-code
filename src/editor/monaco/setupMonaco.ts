import 'monaco-editor/esm/vs/nls/lang/zh-cn.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker.js?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker.js?worker';
import TypeScriptWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker.js?worker';
import * as monaco from 'monaco-editor';
import 'monaco-editor/min/vs/editor/editor.main.css';
import { registerNginxLanguage } from '@/editor/monaco/nginxLanguage';

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new JsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
    if (label === 'typescript' || label === 'javascript') return new TypeScriptWorker();
    return new EditorWorker();
  }
};

monaco.typescript.typescriptDefaults.setEagerModelSync(true);
monaco.typescript.javascriptDefaults.setEagerModelSync(true);
monaco.json.jsonDefaults.setDiagnosticsOptions({
  validate: true,
  allowComments: false,
  trailingCommas: 'error'
});
registerNginxLanguage(monaco);

export { monaco };
