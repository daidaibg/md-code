import type { EditorMode, PreviewKind, SupportedLanguage } from '@/types/editor';

export interface LanguageDefinition {
  id: SupportedLanguage;
  label: string;
  extensions: string[];
  preview: PreviewKind;
  defaultMode: EditorMode;
}

const languageDefinitions: LanguageDefinition[] = [
  { id: 'markdown', label: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'], preview: 'markdown', defaultMode: 'preview' },
  { id: 'json', label: 'JSON', extensions: ['json', 'jsonc'], preview: 'json', defaultMode: 'editor' },
  { id: 'html', label: 'HTML', extensions: ['html', 'htm'], preview: 'html', defaultMode: 'editor' },
  { id: 'css', label: 'CSS', extensions: ['css', 'scss', 'less'], preview: 'none', defaultMode: 'editor' },
  { id: 'javascript', label: 'JavaScript', extensions: ['js', 'mjs', 'cjs', 'jsx'], preview: 'none', defaultMode: 'editor' },
  { id: 'typescript', label: 'TypeScript', extensions: ['ts', 'mts', 'cts', 'tsx'], preview: 'none', defaultMode: 'editor' },
  { id: 'yaml', label: 'YAML', extensions: ['yaml', 'yml'], preview: 'none', defaultMode: 'editor' },
  { id: 'xml', label: 'XML', extensions: ['xml', 'svg'], preview: 'none', defaultMode: 'editor' },
  { id: 'plaintext', label: 'Plain Text', extensions: ['txt', 'log', 'ini', 'conf'], preview: 'none', defaultMode: 'editor' }
];

const extensionMap = new Map<string, LanguageDefinition>();
for (const definition of languageDefinitions) {
  for (const extension of definition.extensions) extensionMap.set(extension, definition);
}

export function extensionFromFilename(filename: string): string {
  const clean = filename.split(/[\/]/u).pop() ?? filename;
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLocaleLowerCase() : '';
}

export function getLanguageDefinition(language: SupportedLanguage): LanguageDefinition {
  return languageDefinitions.find((item) => item.id === language) ?? languageDefinitions.at(-1)!;
}

export function detectLanguage(filename: string): SupportedLanguage {
  return extensionMap.get(extensionFromFilename(filename))?.id ?? 'plaintext';
}

export function defaultModeForLanguage(language: SupportedLanguage): EditorMode {
  return getLanguageDefinition(language).defaultMode;
}

export function previewKindForLanguage(language: SupportedLanguage): PreviewKind {
  return getLanguageDefinition(language).preview;
}

export function supportsPreview(language: SupportedLanguage): boolean {
  return previewKindForLanguage(language) !== 'none';
}

export function supportedFileExtensions(): string[] {
  return [...new Set(languageDefinitions.flatMap((item) => item.extensions))];
}

export function languageLabel(language: SupportedLanguage): string {
  return getLanguageDefinition(language).label;
}

export function listLanguages(): readonly LanguageDefinition[] {
  return languageDefinitions;
}
