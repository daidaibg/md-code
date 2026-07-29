import type { CodeThemeName, PreviewThemeName } from '@/types/editor';

export interface PreviewThemeDefinition {
  id: PreviewThemeName;
  label: string;
  className: string;
}

export interface CodeThemeDefinition {
  id: CodeThemeName;
  label: string;
  className: string;
}

const previewThemes = new Map<PreviewThemeName, PreviewThemeDefinition>();
const codeThemes = new Map<CodeThemeName, CodeThemeDefinition>();

export function registerPreviewTheme(theme: PreviewThemeDefinition): void {
  previewThemes.set(theme.id, theme);
}

export function registerCodeTheme(theme: CodeThemeDefinition): void {
  codeThemes.set(theme.id, theme);
}

export function listPreviewThemes(): PreviewThemeDefinition[] {
  return [...previewThemes.values()];
}

export function listCodeThemes(): CodeThemeDefinition[] {
  return [...codeThemes.values()];
}

export function previewThemeClass(id: PreviewThemeName): string {
  return previewThemes.get(id)?.className ?? previewThemes.get('default')?.className ?? '';
}

export function codeThemeClass(id: CodeThemeName): string {
  return codeThemes.get(id)?.className ?? codeThemes.get('github')?.className ?? '';
}

[
  ['default', '默认', 'default-theme'],
  ['github', 'GitHub', 'github-theme'],
  ['vuepress', 'VuePress', 'vuepress-theme'],
  ['mk-cute', 'MK Cute', 'mk-cute-theme'],
  ['smart-blue', 'Smart Blue', 'smart-blue-theme'],
  ['cyanosis', 'Cyanosis', 'cyanosis-theme']
].forEach(([id, label, className]) => registerPreviewTheme({ id, label, className }));

[
  ['atom', 'Atom', 'code-theme-atom'],
  ['a11y', 'A11y', 'code-theme-a11y'],
  ['github', 'GitHub', 'code-theme-github'],
  ['gradient', 'Gradient', 'code-theme-gradient'],
  ['kimbie', 'Kimbie', 'code-theme-kimbie'],
  ['paraiso', 'Paraiso', 'code-theme-paraiso'],
  ['qtcreator', 'Qt Creator', 'code-theme-qtcreator'],
  ['stackoverflow', 'Stack Overflow', 'code-theme-stackoverflow']
].forEach(([id, label, className]) => registerCodeTheme({ id, label, className }));
