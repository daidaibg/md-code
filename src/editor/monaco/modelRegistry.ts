import { monaco } from './setupMonaco';
import type { SupportedLanguage } from '@/types/editor';

interface MonacoModelRegistryGlobal {
  __mdCodeMonacoModels?: Map<string, monaco.editor.ITextModel>;
}

// Vite 热更新会重新执行当前模块，但 Monaco 自己创建的 model 不会随模块一起销毁。
// 将注册表保存在 globalThis，避免开发环境中用相同 URI 重复创建 model，
// 从而导致编辑器重新挂载失败、左侧编辑区空白。
const modelRegistryGlobal = globalThis as typeof globalThis & MonacoModelRegistryGlobal;
const models =
  modelRegistryGlobal.__mdCodeMonacoModels ??
  (modelRegistryGlobal.__mdCodeMonacoModels = new Map<string, monaco.editor.ITextModel>());

function safePathSegment(value: string): string {
  return encodeURIComponent(value.replaceAll('\\', '/'));
}

export function getOrCreateModel(input: {
  documentId: string;
  filename: string;
  content: string;
  language: SupportedLanguage;
}): monaco.editor.ITextModel {
  const uri = monaco.Uri.parse(
    'inmemory://md-code/' + safePathSegment(input.documentId) + '/' + safePathSegment(input.filename)
  );
  const registered = models.get(input.documentId);
  const existing =
    registered && !registered.isDisposed() ? registered : monaco.editor.getModel(uri) ?? undefined;
  if (existing) {
    models.set(input.documentId, existing);
    if (existing.getLanguageId() !== input.language) monaco.editor.setModelLanguage(existing, input.language);
    return existing;
  }

  const model = monaco.editor.createModel(input.content, input.language, uri);
  models.set(input.documentId, model);
  return model;
}

export function disposeDocumentModel(documentId: string): void {
  const model = models.get(documentId);
  if (model && !model.isDisposed()) model.dispose();
  models.delete(documentId);
}
