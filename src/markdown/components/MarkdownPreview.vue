<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import DOMPurify from 'dompurify';
import '@vavt/markdown-theme/css/all.css';
import '@/markdown/themes/admonition.css';
import { isTauriRuntime } from '@/filesystem/fileSystemService';
import { createMarkdownEngine } from '@/markdown/core/createMarkdownEngine';
import { extractHeadings } from '@/markdown/toc/extractHeadings';
import { resolveCodeThemeCss } from '@/themes/codeThemeCss';
import { previewThemeClass } from '@/themes/themeRegistry';
import type { CodeThemeName, PreviewThemeName, ResolvedTheme, TocItem } from '@/types/editor';

type MermaidApi = typeof import('mermaid')['default'];

const props = defineProps<{
  source: string;
  documentPath: string | null;
  theme: ResolvedTheme;
  previewTheme: PreviewThemeName;
  codeTheme: CodeThemeName;
}>();

const emit = defineEmits<{ 'toc-change': [items: TocItem[]] }>();
const preview = ref<HTMLElement>();
const markdown = createMarkdownEngine();
let renderVersion = 0;
let mermaidPromise: Promise<MermaidApi> | undefined;
let codeThemeStyle: HTMLStyleElement | undefined;
let copyResetTimer: number | undefined;

const safePreviewUri = /^(?:(?:(?:f|ht)tps?|tel|callto|sms|file|asset|tauri):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/iu;
const renderedHtml = computed(() =>
  DOMPurify.sanitize(markdown.render(props.source), { ALLOWED_URI_REGEXP: safePreviewUri })
);
const tocItems = computed(() => extractHeadings(markdown, props.source));
const activeCodeCss = computed(() => resolveCodeThemeCss(props.codeTheme, props.theme));

function loadMermaid(): Promise<MermaidApi> {
  mermaidPromise ??= import('mermaid').then((module) => module.default);
  return mermaidPromise;
}

function parentDirectory(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('\\'), filePath.lastIndexOf('/'));
  return index >= 0 ? filePath.slice(0, index) : '';
}

function normalizeLocalPath(filePath: string): string {
  const separator = filePath.includes('\\') || /^[a-z]:/iu.test(filePath) ? '\\' : '/';
  const prefix = /^[a-z]:/iu.exec(filePath)?.[0] ?? (filePath.startsWith('/') ? '/' : '');
  const raw = filePath.replace(/^[a-z]:/iu, '').split(/[\\/]/u);
  const segments: string[] = [];
  for (const segment of raw) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return `${prefix}${prefix === '/' ? '' : separator}${segments.join(separator)}`;
}

function localPathFromSource(source: string): string | null {
  if (!source || /^(?:https?:|data:|blob:|asset:|tauri:)/iu.test(source)) return null;
  if (/^file:\/\//iu.test(source)) {
    try {
      const url = new URL(source);
      const decodedPath = decodeURIComponent(url.pathname);
      if (url.hostname) return `\\\\${url.hostname}${decodedPath.replaceAll('/', '\\')}`;
      if (/^\/[a-z]:\//iu.test(decodedPath)) return decodedPath.slice(1).replaceAll('/', '\\');
      return decodedPath;
    } catch {
      return null;
    }
  }
  if (/^[a-z]:[\\/]/iu.test(source) || source.startsWith('/')) return source;
  if (!props.documentPath) return null;
  return `${parentDirectory(props.documentPath)}\\${decodeURIComponent(source)}`;
}

function renderLocalImages(): void {
  if (!isTauriRuntime()) return;
  for (const image of preview.value?.querySelectorAll<HTMLImageElement>('img[src]') ?? []) {
    const localPath = localPathFromSource(image.getAttribute('src') ?? '');
    if (localPath) image.src = convertFileSrc(normalizeLocalPath(localPath));
  }
}

async function renderMermaidDiagrams(): Promise<void> {
  const version = ++renderVersion;
  await nextTick();
  const root = preview.value;
  if (!root) return;
  renderLocalImages();

  const diagrams = [...root.querySelectorAll<HTMLElement>('.md-mermaid')];
  if (diagrams.length === 0) return;

  const mermaid = await loadMermaid();
  if (version !== renderVersion) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: props.theme === 'dark' ? 'dark' : 'default'
  });

  for (const [index, diagram] of diagrams.entries()) {
    const source = diagram.querySelector('.md-mermaid-source')?.textContent ?? '';
    try {
      const result = await mermaid.render(`md-mermaid-${version}-${index}`, source);
      if (version !== renderVersion) return;
      diagram.innerHTML = result.svg;
      result.bindFunctions?.(diagram);
      diagram.removeAttribute('data-mermaid-pending');
    } catch (error) {
      if (version !== renderVersion) return;
      diagram.classList.add('md-mermaid-error');
      diagram.textContent = error instanceof Error ? error.message : 'Mermaid 渲染失败';
    }
  }
}

async function onPreviewClick(event: MouseEvent): Promise<void> {
  const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-copy-code]') : null;
  if (!target) return;
  const code = target.closest('.md-editor-code')?.querySelector('code')?.textContent ?? '';
  await navigator.clipboard.writeText(code);
  target.textContent = '已复制';
  if (copyResetTimer) window.clearTimeout(copyResetTimer);
  copyResetTimer = window.setTimeout(() => {
    target.textContent = '复制';
  }, 1200);
}

watch(tocItems, (items) => emit('toc-change', items), { immediate: true });
watch([renderedHtml, () => props.theme, () => props.documentPath], () => void renderMermaidDiagrams(), {
  immediate: true,
  flush: 'post'
});
watch(activeCodeCss, (css) => {
  if (codeThemeStyle) codeThemeStyle.textContent = css;
}, { immediate: true });

onMounted(() => {
  codeThemeStyle = document.createElement('style');
  codeThemeStyle.dataset.mdCodeHighlightTheme = 'active';
  codeThemeStyle.textContent = activeCodeCss.value;
  document.head.append(codeThemeStyle);
});

onBeforeUnmount(() => {
  codeThemeStyle?.remove();
  if (copyResetTimer) window.clearTimeout(copyResetTimer);
});

defineExpose({ getElement: () => preview.value });
</script>

<template>
  <div class="md-editor markdown-preview-host" :class="{ 'md-editor-dark': theme === 'dark' }">
    <div
      ref="preview"
      class="md-editor-preview"
      :class="previewThemeClass(previewTheme)"
      @click="onPreviewClick"
      v-html="renderedHtml"
    />
  </div>
</template>

<style scoped lang="scss">
.markdown-preview-host {
  --md-color: var(--preview-text);
  width: 100%;
  min-height: 100%;
  border: 0;
  color: var(--preview-text);
  background: var(--preview-bg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Segoe UI', system-ui,
    ui-sans-serif, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
}

.md-editor-preview {
  width: min(100%, 980px);
  min-height: 100%;
  display: flow-root;
  margin: 0 auto;
  padding: 28px clamp(24px, 4.5vw, 64px) 84px;
  word-break: break-word;
  font-size: 16px;
}

.md-editor-preview :deep(h1),
.md-editor-preview :deep(h2),
.md-editor-preview :deep(h3),
.md-editor-preview :deep(h4),
.md-editor-preview :deep(h5),
.md-editor-preview :deep(h6) {
  scroll-margin-top: 24px;
}

.md-editor-preview :deep(.md-editor-copy-button) {
  min-width: 34px;
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
  font-size: 12px;
  cursor: pointer;
}

.md-editor-preview :deep(.md-editor-copy-button:hover) {
  color: var(--md-theme-code-active-color);
}

.md-editor-preview :deep(.md-editor-code .md-editor-code-head) {
  position: relative;
  top: auto;
  z-index: 1;
}

.md-editor-preview :deep(.md-mermaid) {
  margin: 20px 0;
  overflow-x: auto;
  text-align: center;
}

.md-editor-preview :deep(.md-mermaid-source) {
  display: none;
}

.md-editor-preview :deep(.md-mermaid-error) {
  padding: 14px;
  border: 1px solid var(--danger);
  border-radius: 4px;
  color: var(--danger);
  text-align: left;
  white-space: pre-wrap;
}

@media (max-width: 720px) {
  .md-editor-preview {
    padding: 22px 18px 64px;
  }
}
</style>
