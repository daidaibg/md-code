<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx, editorViewOptionsCtx, serializerCtx } from '@milkdown/kit/core';
import { $prose, $remark, $view, callCommand, insert, replaceAll } from '@milkdown/kit/utils';
import { Plugin } from '@milkdown/kit/prose/state';
import { codeBlockConfig } from '@milkdown/kit/component/code-block';
import { EditorView as CodeMirrorView } from '@codemirror/view';
import { undo as undoHistory, redo as redoHistory } from '@milkdown/kit/prose/history';
import { exitCode, selectAll as selectAllCommand } from '@milkdown/kit/prose/commands';
import {
  codeBlockSchema, hardbreakSchema, toggleStrongCommand, toggleEmphasisCommand, toggleInlineCodeCommand,
  wrapInHeadingCommand, wrapInBlockquoteCommand, wrapInBulletListCommand,
  wrapInOrderedListCommand, createCodeBlockCommand
} from '@milkdown/kit/preset/commonmark';
import { insertTableCommand, toggleStrikethroughCommand } from '@milkdown/kit/preset/gfm';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import ScrollArea from '@/components/scroll/ScrollArea.vue';
import Toolbar from '@/editor/components/Toolbar.vue';
import ImageUploader from '@/editor/components/ImageUploader.vue';
import { saveMarkdownImage } from '@/editor/images/saveMarkdownImage';
import { isTauriRuntime } from '@/filesystem/fileSystemService';
import { applyTextCommand } from '@/editor/utils/textCommands';
import { createNoteBlockDrag } from '@/notes/blockDrag';
import { scopeVisualCodeCss, createVisualCodeTheme } from '@/notes/visualCodeTheme';
import { resolveCodeThemeCss } from '@/themes/codeThemeCss';
import { previewThemeClass } from '@/themes/themeRegistry';
import MarkdownToc from '@/markdown/components/MarkdownToc.vue';
import '@vavt/markdown-theme/css/all.css';
import '@/markdown/themes/typography.scss';
import '@/markdown/themes/vuepress/index.scss';
import type { CodeThemeName, PreviewThemeName, EditorCommand, ResolvedTheme, TocItem } from '@/types/editor';

const props = defineProps<{
  source: string;
  documentPath: string | null;
  previewTheme: PreviewThemeName;
  codeTheme: CodeThemeName;
  theme: ResolvedTheme;
  tocOpen: boolean;
}>();
const emit = defineEmits<{
  'update:source': [source: string];
  'request-source': [];
  unavailable: [reason: string];
}>();
const host = ref<HTMLElement>();
const floatingLayer = ref<HTMLElement>();
let floatingObserver: MutationObserver | undefined;
function relocateFloatingElements(): void {
  const layer = floatingLayer.value;
  if (!layer) return;
  host.value?.querySelectorAll<HTMLElement>('.milkdown-toolbar, .milkdown-link-preview, .milkdown-link-edit').forEach(element => {
    layer.appendChild(element);
  });
}
const scrollViewport = ref<HTMLElement>();
const themeScope = `note-visual-${useId().replace(/[^a-z0-9_-]/giu, '-')}`;
const codeCss = computed(() => scopeVisualCodeCss(resolveCodeThemeCss(props.codeTheme, props.theme), `.${themeScope}`));
const headings = ref<TocItem[]>([]);
const activeHeading = ref<string | null>(null);
const headingPositions = new Map<string, number>();
let codeStyle: HTMLStyleElement | undefined;

function updateHeadings(): void {
  if (!instance || !ready.value) return;
  const items: TocItem[] = [];
  headingPositions.clear();
  instance.editor.action(ctx => ctx.get(editorViewCtx).state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const id = `visual-heading-${pos}`;
      items.push({ id, level: Number(node.attrs.level), text: node.textContent || '未命名标题' });
      headingPositions.set(id, pos);
    }
  }));
  headings.value = items;
  updateActiveHeading();
}

function headingElement(id: string): HTMLElement | undefined {
  const pos = headingPositions.get(id);
  const node = pos === undefined ? undefined : instance?.editor.action(ctx => ctx.get(editorViewCtx).nodeDOM(pos));
  return node instanceof HTMLElement ? node : undefined;
}

function updateActiveHeading(): void {
  const viewport = scrollViewport.value;
  if (!viewport) return;
  let active = headings.value[0]?.id ?? null;
  for (const item of headings.value) {
    const element = headingElement(item.id);
    if (element && element.getBoundingClientRect().top <= viewport.getBoundingClientRect().top + 72) active = item.id;
  }
  activeHeading.value = active;
}

function navigateHeading(id: string): void {
  const element = headingElement(id);
  const viewport = scrollViewport.value;
  if (!element || !viewport) return;
  viewport.scrollTo({ top: viewport.scrollTop + element.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 20, behavior: 'smooth' });
  activeHeading.value = id;
}

function applyPreviewTheme(): void {
  if (!ready.value || !instance) return;
  instance.editor.action(ctx => ctx.get(editorViewCtx).setProps({
    attributes: { class: `md-editor-preview ${previewThemeClass(props.previewTheme)}` }
  }));
  void nextTick(updateActiveHeading);
}
watch(() => props.previewTheme, applyPreviewTheme);
watch(codeCss, css => { if (codeStyle) codeStyle.textContent = css; });
const imageUploader = ref<{ open: (mode: 'upload' | 'crop') => void }>();
const ready = ref(false);
const message = ref('');
const sourceModeHint = ref('');
interface InputSuggestion { label: string; value: string }
const suggestionRoot = ref<HTMLElement>();
const suggestion = ref<{ kind: 'code' | 'hint'; text: string; from: number; to: number; left: number; top: number; height: number; items: InputSuggestion[] }>();
const suggestionIndex = ref(0);
let dismissedSuggestion = '';
const codeSuggestions: InputSuggestion[] = [
  { label: '纯文本', value: '' }, { label: 'JavaScript', value: 'js' },
  { label: 'TypeScript', value: 'ts' }, { label: 'JSON', value: 'json' },
  { label: 'HTML', value: 'html' }, { label: 'CSS', value: 'css' },
  { label: 'Python', value: 'python' }, { label: 'Rust', value: 'rust' },
  { label: 'Shell', value: 'bash' }, { label: 'SQL', value: 'sql' },
  { label: 'YAML', value: 'yaml' }, { label: 'Java', value: 'java' },
  { label: 'C++', value: 'cpp' }, { label: 'C#', value: 'csharp' }
];
const hintSuggestions = ['tip', 'note', 'info', 'warning', 'danger'].map(value => ({ label: `${value} 提示块标记`, value }));

const languageRoot = ref<HTMLElement>();
const languageSearch = ref<HTMLInputElement>();
const languageQuery = ref('');
const languageIndex = ref(0);
const languageMenu = ref<{ block: HTMLElement; trigger: HTMLElement; left: number; top: number; height: number; items: InputSuggestion[] }>();
const filteredLanguages = computed(() => languageMenu.value?.items.filter(item =>
  `${item.label} ${item.value}`.toLowerCase().includes(languageQuery.value.trim().toLowerCase())) ?? []);
watch(languageQuery, () => { languageIndex.value = 0; });

function closeLanguageMenu(): void { languageMenu.value = undefined; }
function openLanguageMenu(event: MouseEvent): void {
  const trigger = (event.target as HTMLElement).closest<HTMLElement>('.language-button');
  const block = trigger?.closest<HTMLElement>('.milkdown-code-block');
  if (!trigger || !block || !instance) return;
  event.preventDefault();
  event.stopPropagation();
  if (languageMenu.value?.trigger === trigger) { closeLanguageMenu(); return; }
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - 12;
  const above = rect.top - 12;
  const height = Math.max(80, Math.min(300, Math.max(below, above)));
  const items = instance.editor.action(ctx => ctx.get(codeBlockConfig.key).languages.map(item => ({
    label: item.name, value: item.alias[0] || item.name.toLowerCase()
  })));
  languageQuery.value = '';
  languageIndex.value = 0;
  languageMenu.value = { block, trigger, height, items: [{ label: '纯文本', value: '' }, ...items],
    left: Math.max(8, Math.min(rect.left, window.innerWidth - 308)),
    top: below >= height ? rect.bottom + 4 : Math.max(8, rect.top - height - 4) };
  void nextTick(() => languageSearch.value?.focus({ preventScroll: true }));
}
function selectLanguage(item: InputSuggestion): void {
  const menu = languageMenu.value;
  if (!menu || !instance) return;
  instance.editor.action(ctx => {
    const view = ctx.get(editorViewCtx);
    let position: number | undefined;
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'code_block' && view.nodeDOM(pos) === menu.block) position = pos;
    });
    if (position !== undefined) view.dispatch(view.state.tr.setNodeAttribute(position, 'language', item.value));
  });
  // Milkdown doesn't reconfigure its language parser for an empty/unknown
  // language. Refresh our preview tokenizer from the saved node attribute too.
  const editorDom = menu.block.querySelector<HTMLElement>('.cm-editor');
  if (editorDom) CodeMirrorView.findFromDOM(editorDom)?.dispatch({});
  closeLanguageMenu();
  menu.trigger.focus({ preventScroll: true });
}
function languageKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    const trigger = languageMenu.value?.trigger;
    closeLanguageMenu(); trigger?.focus({ preventScroll: true });
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const length = filteredLanguages.value.length;
    if (length) languageIndex.value = (languageIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + length) % length;
    void nextTick(() => languageRoot.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }));
  } else if (event.key === 'Enter') {
    const item = filteredLanguages.value[languageIndex.value];
    if (item) selectLanguage(item);
  } else return;
  event.preventDefault(); event.stopPropagation();
}
function onLanguageOutside(event: PointerEvent): void {
  if (!(event.target instanceof Node) || languageRoot.value?.contains(event.target) || languageMenu.value?.trigger.contains(event.target)) return;
  closeLanguageMenu();
}

function dismissSuggestions(): void {
  if (suggestion.value) dismissedSuggestion = `${suggestion.value.from}:${suggestion.value.text}`;
  suggestion.value = undefined;
}

function updateSuggestions(): void {
  if (!ready.value || !instance || disposed) return;
  instance.editor.action(ctx => {
    const view = ctx.get(editorViewCtx);
    const { selection } = view.state;
    const { $from } = selection;
    if (!view.hasFocus() || view.composing || !selection.empty || $from.parent.type.name !== 'paragraph' || $from.parentOffset !== $from.parent.content.size) {
      suggestion.value = undefined;
      return;
    }
    const text = $from.parent.textContent;
    const match = /^(?<marker>`{3}|~{3}|!{3}|！{3})\s*(?<query>[\w+#.-]*)$/u.exec(text);
    if (!match) { suggestion.value = undefined; dismissedSuggestion = ''; return; }
    const from = $from.start();
    if (dismissedSuggestion === `${from}:${text}`) return;
    const kind = match.groups?.marker?.includes('!') || match.groups?.marker?.includes('！') ? 'hint' : 'code';
    const query = (match.groups?.query ?? '').toLowerCase();
    // Mermaid remains an explicit source-mode operation, not a silently converted block.
    if (kind === 'code' && query === 'mermaid') { suggestion.value = undefined; return; }
    let items = (kind === 'code' ? codeSuggestions : hintSuggestions)
      .filter(item => !query || item.label.toLowerCase().includes(query) || item.value.includes(query));
    if (!items.length && kind === 'code') items = [{ label: `使用语言：${query}`, value: query }];
    if (!items.length) { suggestion.value = undefined; return; }
    const caret = view.coordsAtPos(selection.from);
    const width = Math.min(300, window.innerWidth - 16);
    const height = Math.max(33, Math.min(items.length * 33, 220, window.innerHeight - 24));
    if (suggestion.value?.text !== text || suggestion.value.from !== from) suggestionIndex.value = 0;
    suggestion.value = { kind, text, from, to: $from.end(), items, height,
      left: Math.max(8, Math.min(caret.left, window.innerWidth - width - 8)),
      top: Math.max(8, caret.bottom + height + 8 <= window.innerHeight ? caret.bottom + 6 : caret.top - height - 6) };
  });
}

function acceptSuggestion(index: number): void {
  const pending = suggestion.value;
  const item = pending?.items[index];
  if (!pending || !item || !instance) return;
  instance.editor.action(ctx => {
    const view = ctx.get(editorViewCtx);
    const { $from } = view.state.selection;
    if ($from.start() !== pending.from || $from.parent.textContent !== pending.text) { dismissSuggestions(); return; }
    suggestion.value = undefined;
    const tr = view.state.tr;
    if (pending.kind === 'code') {
      tr.delete(pending.from, pending.to).setBlockType(pending.from, pending.from, codeBlockSchema.type(ctx), { language: item.value });
    } else {
      tr.insertText(`!!! ${item.value} "标题"`, pending.from, pending.to);
    }
    view.dispatch(tr.scrollIntoView());
    view.focus();
  });
}

function onSuggestionOutside(event: PointerEvent): void {
  const target = event.target as Node;
  if (!suggestionRoot.value?.contains(target)) dismissSuggestions();
}
let instance: Crepe | undefined;
let disposed = false;
let applyingSource = false;
let lastSource = props.source;
let unsupportedReason = '';
const blockDrag = createNoteBlockDrag(
  () => ready.value ? instance?.editor.action(ctx => ctx.get(editorViewCtx)) : undefined,
  () => scrollViewport.value
);

// Unsupported extensions stay in the original Monaco editor instead of being stripped.
function assertSupported(source: string): void {
  if (/^\s*:::/mu.test(source) || /^\s*(`{3,}|~{3,})\s*mermaid\b/mu.test(source)) {
    throw new Error('当前便签含 Mermaid 或提示块，已保留在源码模式，可继续使用原来的编辑与预览。');
  }
  if (/^\s{0,3}\[[^\]]+\]:/mu.test(source) || /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/u.test(source)) {
    throw new Error('当前便签含引用定义或文档元数据，已保留在源码模式，避免转换原始定义。');
  }
}

interface MarkdownNode { type: string; children?: MarkdownNode[] }
function checkNodes(node: MarkdownNode): void {
  if (['html', 'footnoteDefinition', 'footnoteReference', 'yaml', 'toml',
    'containerDirective', 'leafDirective', 'textDirective'].includes(node.type)) {
    throw new Error('当前便签含尚未适配的扩展语法，已保留在源码模式，原文不会转换。');
  }
  node.children?.forEach(checkNodes);
}

function imageUrl(source: string): string {
  if (!isTauriRuntime() || /^(https?:|data:|blob:|asset:|tauri:)/iu.test(source)) return source;
  try {
    if (source.startsWith('file:')) {
      const url = new URL(source);
      const path = decodeURIComponent(url.pathname);
      return convertFileSrc(url.hostname ? `//${url.hostname}${path}` : path.replace(/^\/([a-z]:)/iu, '$1'));
    }
    if (/^(?:[a-z]:[\\/]|\/)/iu.test(source)) return convertFileSrc(decodeURIComponent(source));
    if (!props.documentPath) return source;
    const parent = props.documentPath.replace(/[^\\/]+$/u, '').replaceAll('\\', '/');
    const base = encodeURI(/^[a-z]:/iu.test(parent) ? `file:///${parent}` : `file://${parent}`).replaceAll('#', '%23');
    const url = new URL(source, base);
    return imageUrl(url.href);
  } catch { return source; }
}

function focus(): void { instance?.editor.action(ctx => ctx.get(editorViewCtx).focus()); }
function undo(): void { instance?.editor.action(ctx => { const view = ctx.get(editorViewCtx); undoHistory(view.state, view.dispatch); }); }
function redo(): void { instance?.editor.action(ctx => { const view = ctx.get(editorViewCtx); redoHistory(view.state, view.dispatch); }); }
function selectAll(): void { instance?.editor.action(ctx => { const view = ctx.get(editorViewCtx); selectAllCommand(view.state, view.dispatch); }); }
function insertMarkdown(markdown: string): void {
  if (!ready.value) return;
  instance?.editor.action(insert(markdown));
  focus();
}

function onEditorKeydown(event: KeyboardEvent): void {
  if (!ready.value || !instance || event.isComposing || event.defaultPrevented) return;
  const target = event.target as HTMLElement | null;
  // Language search and other popup inputs retain their own keyboard behavior.
  if (!target?.closest('.cm-content, .ProseMirror') || target.closest('input, textarea, button')) return;
  const modifier = event.ctrlKey || event.metaKey;
  if (suggestion.value && !modifier && !event.altKey && !event.shiftKey) {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') dismissSuggestions();
      else if (event.key === 'Enter' || event.key === 'Tab') acceptSuggestion(suggestionIndex.value);
      else {
        const count = suggestion.value.items.length;
        suggestionIndex.value = (suggestionIndex.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
        void nextTick(() => suggestionRoot.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }));
      }
      return;
    }
  }
  if (modifier) dismissSuggestions();
  if (modifier && event.key === 'Enter' && !event.shiftKey && !event.altKey) {
    const handled = instance.editor.action(ctx => {
      const view = ctx.get(editorViewCtx);
      const result = exitCode(view.state, view.dispatch);
      if (result) view.focus();
      return result;
    });
    if (handled) { event.preventDefault(); event.stopPropagation(); }
    return;
  }
  if (modifier && event.shiftKey && event.key.toLowerCase() === 'k' && !event.altKey) {
    event.preventDefault();
    event.stopPropagation();
    runCommand({ type: 'simple', command: 'code-block' });
    return;
  }
  if (event.key !== 'Enter' || modifier || event.shiftKey || event.altKey || target.closest('.cm-editor')) return;
  instance.editor.action(ctx => {
    const view = ctx.get(editorViewCtx);
    const { selection } = view.state;
    const { $from } = selection;
    if (!selection.empty || $from.parent.type.name !== 'paragraph' || $from.parentOffset !== $from.parent.content.size) return;
    const text = $from.parent.textContent;
    const fence = /^(?:`{3}|~{3})([\w+#.-]*)\s*$/u.exec(text);
    if (!fence) return;
    if (fence[1]?.toLowerCase() === 'mermaid') {
      sourceModeHint.value = 'Mermaid 请使用源码模式编写并预览，当前不会自动切换。';
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const from = $from.start();
    view.dispatch(view.state.tr.delete(from, $from.end())
      .setBlockType(from, from, codeBlockSchema.type(ctx), { language: fence[1] ?? '' })
      .scrollIntoView());
    view.focus();
  });
}

function runCommand(command: EditorCommand): void {
  if (!instance || !ready.value) return;
  if (command.type === 'mermaid' || command.type === 'admonition') {
    sourceModeHint.value = `${command.type === 'mermaid' ? 'Mermaid' : '提示块'}尚未适配可视化编辑。可手动切到源码，选中内容后再使用该按钮；当前内容未改动。`;
    return;
  }
  if (command.type === 'image' && command.action !== 'link') {
    imageUploader.value?.open(command.action);
    return;
  }
  if (command.type === 'heading') instance.editor.action(callCommand(wrapInHeadingCommand.key, command.level));
  else if (command.type === 'table') instance.editor.action(callCommand(insertTableCommand.key, { row: command.rows, col: command.columns }));
  else if (command.type === 'simple') {
    switch (command.command) {
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'bold': instance.editor.action(callCommand(toggleStrongCommand.key)); break;
      case 'italic': instance.editor.action(callCommand(toggleEmphasisCommand.key)); break;
      case 'strike': instance.editor.action(callCommand(toggleStrikethroughCommand.key)); break;
      case 'inline-code': instance.editor.action(callCommand(toggleInlineCodeCommand.key)); break;
      case 'quote': instance.editor.action(callCommand(wrapInBlockquoteCommand.key)); break;
      case 'unordered-list': instance.editor.action(callCommand(wrapInBulletListCommand.key)); break;
      case 'ordered-list': instance.editor.action(callCommand(wrapInOrderedListCommand.key)); break;
      case 'code-block': instance.editor.action(callCommand(createCodeBlockCommand.key)); break;
      default: insertMarkdown(applyTextCommand('', { start: 0, end: 0 }, command).value);
    }
  } else insertMarkdown(applyTextCommand('', { start: 0, end: 0 }, command).value);
  focus();
}

onMounted(async () => {
  if (!host.value) return;
  // Tooltip providers append beside the document and measure before their
  // asynchronous position update. Relocate synchronously in our plugin below;
  // the observer also catches providers that append from throttled callbacks.
  floatingObserver = new MutationObserver(relocateFloatingElements);
  floatingObserver.observe(host.value, { childList: true, subtree: true });
  document.addEventListener('pointerdown', onLanguageOutside, true);
  window.addEventListener('resize', closeLanguageMenu);
  window.addEventListener('blur', closeLanguageMenu);
  document.addEventListener('pointerdown', onSuggestionOutside, true);
  window.addEventListener('resize', dismissSuggestions);
  window.addEventListener('blur', dismissSuggestions);
  codeStyle = document.createElement('style');
  codeStyle.textContent = codeCss.value;
  document.head.appendChild(codeStyle);
  try {
    assertSupported(props.source);
    const crepe = new Crepe({
      root: host.value,
      defaultValue: props.source,
      featureConfigs: {
        [Crepe.Feature.BlockEdit]: {
          blockHandle: {
            root: floatingLayer.value,
            floatingUIOptions: { strategy: 'absolute' }
          }
        },
        [Crepe.Feature.CodeMirror]: {
          // Map editable syntax tokens to the same palette classes as Markdown preview.
          theme: createVisualCodeTheme(codeView => instance?.editor.action(ctx => {
            const view = ctx.get(editorViewCtx);
            let language: string | undefined;
            view.state.doc.descendants((node, pos) => {
              if (node.type.name !== 'code_block') return;
              const dom = view.nodeDOM(pos);
              if (dom instanceof HTMLElement && dom.contains(codeView.dom)) language = String(node.attrs.language ?? '');
            });
            return language;
          })),
          searchPlaceholder: '搜索语言，如 JavaScript、JSON、Python',
          noResultText: '未找到语言',
          copyText: '复制代码',
          renderLanguage: language => language || '纯文本',
          previewToggleText: previewOnly => previewOnly ? '编辑代码' : '隐藏代码',
          previewLabel: '预览',
          previewLoading: '正在渲染…'
        },
        [Crepe.Feature.Placeholder]: { text: '记录想法，或输入 / 插入内容…' },
        [Crepe.Feature.ImageBlock]: {
          onUpload: async file => {
            try { return (await saveMarkdownImage(file, props.documentPath)).source; }
            catch (error) { message.value = String(error); throw error; }
          },
          proxyDomURL: imageUrl,
          inlineUploadButton: '上传图片', blockUploadButton: '上传图片',
          blockCaptionPlaceholderText: '图片说明',
          inlineUploadPlaceholderText: '或粘贴图片链接', blockUploadPlaceholderText: '或粘贴图片链接'
        }
      }
    });
    instance = crepe;
    crepe.editor
      .config(ctx => ctx.update(editorViewOptionsCtx, options => ({
        ...options, attributes: { class: `md-editor-preview ${previewThemeClass(props.previewTheme)}` },
        // The nested editor owns its cursor scrolling; don't scroll it a second
        // time using ProseMirror's outer selection coordinates.
        handleScrollToSelection: view => {
          const active = document.activeElement;
          if (active instanceof HTMLElement && view.dom.contains(active) && active.closest('.cm-editor')) return true;
          return options.handleScrollToSelection?.(view) ?? false;
        }
      })))
      .use($remark('note-supported-markdown', () => () => (node: MarkdownNode) => {
        unsupportedReason = '';
        try { checkNodes(node); }
        catch (error) {
          unsupportedReason = error instanceof Error ? error.message : String(error);
          // Complete initialization with an empty, unpublished document so it can be
          // destroyed cleanly. Never save this fallback document over the source.
          node.children = [];
        }
      }))
      // Preserve source soft breaks, but display them as line breaks for notes.
      .use($view(hardbreakSchema.node, () => () => ({ dom: document.createElement('br') })))
      .use($prose(ctx => new Plugin({ view: () => {
        relocateFloatingElements();
        return { update: (view, previous) => {
          relocateFloatingElements();
          void nextTick(updateSuggestions);
          if (!ready.value || disposed || applyingSource || view.state.doc.eq(previous.doc)) return;
          if (unsupportedReason) { emit('unavailable', unsupportedReason); return; }
          // Synchronous publication avoids losing the last keystroke on tab/window close.
          const source = ctx.get(serializerCtx)(view.state.doc);
          lastSource = source;
          emit('update:source', source);
          updateHeadings();
        } };
      } })));
    await crepe.create();
    if (disposed) { await crepe.destroy(); return; }
    if (unsupportedReason) { await crepe.destroy(); throw new Error(unsupportedReason); }
    ready.value = true;
    applyPreviewTheme();
    updateHeadings();
    if (props.source !== lastSource) applyExternalSource(props.source);
  } catch (error) {
    ready.value = false;
    if (!disposed) emit('unavailable', error instanceof Error ? error.message : String(error));
  }
});

function applyExternalSource(source: string): void {
  if (!ready.value || !instance || source === lastSource) return;
  try {
    assertSupported(source);
    applyingSource = true;
    instance.editor.action(replaceAll(source, true));
    if (unsupportedReason) { emit('unavailable', unsupportedReason); return; }
    lastSource = source;
    updateHeadings();
  } catch (error) {
    emit('unavailable', String(error));
  } finally { applyingSource = false; }
}
watch(() => props.source, applyExternalSource);
onBeforeUnmount(() => {
  floatingObserver?.disconnect();
  document.removeEventListener('pointerdown', onLanguageOutside, true);
  window.removeEventListener('resize', closeLanguageMenu);
  window.removeEventListener('blur', closeLanguageMenu);
  dismissSuggestions();
  document.removeEventListener('pointerdown', onSuggestionOutside, true);
  window.removeEventListener('resize', dismissSuggestions);
  window.removeEventListener('blur', dismissSuggestions);
  blockDrag.destroy();
  codeStyle?.remove();
  disposed = true;
  if (ready.value) void instance?.destroy().catch(error => console.error('销毁便签可视化编辑器失败', error));
  ready.value = false;
});
defineExpose({ focus, undo, redo, selectAll, runCommand });
</script>

<template>
  <div class="note-visual-editor">
    <Toolbar mode="editor" :toc-open="false" :preview-theme="previewTheme" :code-theme="codeTheme" :show-view-tools="false" @command="runCommand" />
    <p v-if="message" class="visual-message" role="alert">{{ message }}</p>
    <div v-if="sourceModeHint" class="visual-message" role="status">
      {{ sourceModeHint }}
      <button type="button" @click="emit('request-source')">切换源码</button>
      <button type="button" @click="sourceModeHint = ''">继续可视化编辑</button>
    </div>
    <p v-if="!ready" class="visual-message">正在加载可视化编辑器…</p>
    <div class="visual-body" :class="{ 'with-toc': tocOpen }">
    <ScrollArea label="便签可视化编辑" class="visual-scroll" :horizontal="false" @viewport-change="scrollViewport = $event" @scroll="updateActiveHeading(); dismissSuggestions(); closeLanguageMenu()">
      <div ref="host" class="visual-host md-editor markdown-preview-host" :class="[themeScope, { 'md-editor-dark': theme === 'dark' }]" @click.capture="openLanguageMenu" @keydown.capture="onEditorKeydown" @mousedown="blockDrag.start" @dragstart.capture="blockDrag.preventNativeDrag" />
    </ScrollArea>
    <MarkdownToc v-if="tocOpen" class="visual-toc" :items="headings" :active-id="activeHeading" @navigate="navigateHeading" />
    </div>
    <ImageUploader ref="imageUploader" :document-path="documentPath" @insert="insertMarkdown" />
    <div class="visual-host visual-floating-layer" :class="{ 'md-editor-dark': theme === 'dark' }" @mousedown="blockDrag.start" @dragstart.capture="blockDrag.preventNativeDrag">
      <div ref="floatingLayer" class="milkdown" />
    </div>
    <Teleport to="body">
      <div v-if="languageMenu" ref="languageRoot" class="code-language-menu" :data-theme="theme" :style="{ left: `${languageMenu.left}px`, top: `${languageMenu.top}px`, maxHeight: `${languageMenu.height}px` }" @keydown="languageKeydown">
        <input ref="languageSearch" v-model="languageQuery" aria-label="搜索代码语言" placeholder="搜索语言，如 JavaScript、JSON" />
        <ScrollArea class="code-language-scroll" label="代码语言列表" :horizontal="false" :style="{ height: `${Math.min(Math.max(filteredLanguages.length, 1) * 33, languageMenu.height - 60)}px` }">
        <div class="code-language-options" role="listbox" aria-label="代码语言">
          <button v-for="(item, index) in filteredLanguages" :key="item.value" type="button" role="option" :aria-selected="index === languageIndex" @mouseenter="languageIndex = index" @mousedown.prevent @click="selectLanguage(item)">{{ item.label }}</button>
          <p v-if="!filteredLanguages.length">未找到语言</p>
        </div>
        </ScrollArea>
      </div>
      <div v-if="suggestion" ref="suggestionRoot" class="input-suggestions" :data-theme="theme" :style="{ left: `${suggestion.left}px`, top: `${suggestion.top}px` }" @mousedown.prevent>
        <ScrollArea label="Markdown 输入建议列表" :horizontal="false" :style="{ height: `${suggestion.height}px` }">
        <div class="suggestion-list" role="listbox" aria-label="Markdown 输入建议">
          <button v-for="(item, index) in suggestion.items" :key="item.value" type="button" role="option" :aria-selected="index === suggestionIndex" @mouseenter="suggestionIndex = index" @click="acceptSuggestion(index)">
            <span>{{ item.label }}</span><code>{{ item.value }}</code>
          </button>
        </div>
        </ScrollArea>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.note-visual-editor { position: relative; height: 100%; min-height: 0; display: flex; flex-direction: column; color: var(--text-primary); background: var(--editor-bg); }
.visual-scroll { flex: 1; min-height: 0; }
.visual-body { display: grid; grid-template-columns: minmax(0, 1fr); flex: 1; min-height: 0; min-width: 0; }
.visual-body.with-toc { grid-template-columns: minmax(0, 1fr) clamp(150px, 22%, 230px); }
.visual-host { --md-color: var(--preview-text); background: var(--preview-bg); min-width: 0; width: 100%; box-sizing: border-box; }
.visual-host :deep(.milkdown) { min-width: 0; max-width: 100%; }
.visual-host :deep(.milkdown .ProseMirror) { width: 100%; min-width: 0; box-sizing: border-box; }
/* The language menu is teleported; its unused inline placeholder must not
   contribute positioned overflow to the document viewport. */
.visual-host :deep(.milkdown-code-block .language-picker) { display: none; }
.visual-host :deep(.milkdown-code-block .codemirror-host),
.visual-host :deep(.milkdown-code-block .cm-editor) { min-width: 0; max-width: 100%; }
.visual-toc { min-height: 0; }
.visual-floating-layer { position: absolute; inset: 0; z-index: 30; pointer-events: none; background: transparent; overflow: clip; }
.visual-floating-layer > .milkdown { position: absolute; inset: 0; background: transparent; }
.visual-floating-layer :deep(.milkdown-toolbar),
.visual-floating-layer :deep(.milkdown-link-preview),
.visual-floating-layer :deep(.milkdown-link-edit),
.visual-floating-layer :deep(.milkdown-block-handle) { position: absolute; top: 0; left: 0; pointer-events: auto; }
.visual-floating-layer :deep(.milkdown-toolbar) { pointer-events: auto; border: 1px solid var(--border-color); color: var(--text-primary); box-shadow: 0 4px 14px #0002; }
.visual-floating-layer :deep(.milkdown-toolbar .toolbar-item svg) { color: var(--text-primary); fill: currentColor; }
.visual-floating-layer :deep(.milkdown-toolbar .toolbar-item.active svg),
.visual-floating-layer :deep(.milkdown-toolbar .toolbar-item:hover svg) { color: var(--accent); fill: currentColor; }
.visual-floating-layer :deep(.milkdown-block-handle) { transition: opacity 0.2s; }
.visual-floating-layer :deep(.milkdown-block-handle[data-show='false']) { pointer-events: none; }
.note-visual-editor:has(.milkdown-link-preview[data-show='true']) :deep(.milkdown-toolbar),
.note-visual-editor:has(.milkdown-link-edit[data-show='true']) :deep(.milkdown-toolbar) { display: none; }
.code-language-menu { position: fixed; z-index: 10030; display: flex; flex-direction: column; width: min(300px, calc(100vw - 16px)); padding: 8px; box-sizing: border-box; border: 1px solid var(--border-color); border-radius: 8px; background: var(--panel-bg); color: var(--text-primary); box-shadow: 0 6px 22px #0003; font-size: 13px; }
.code-language-menu input { flex: none; width: 100%; min-width: 0; box-sizing: border-box; padding: 8px; border: 1px solid var(--border-color); border-radius: 5px; background: var(--editor-bg); color: inherit; font: inherit; outline-color: var(--accent); }
.code-language-scroll { min-height: 0; margin-top: 6px; flex-shrink: 1; }
.code-language-options { padding-right: 14px; }
.code-language-options button { display: block; width: 100%; padding: 7px 9px; border: 0; border-radius: 4px; color: inherit; background: transparent; text-align: left; font: inherit; cursor: pointer; }
.code-language-options button[aria-selected='true'] { background: var(--control-hover); color: var(--accent); }
.input-suggestions { position: fixed; z-index: 10020; width: min(300px, calc(100vw - 16px)); overflow: hidden; border: 1px solid var(--border-color); border-radius: 7px; background: var(--panel-bg); color: var(--text-primary); box-shadow: 0 6px 22px #0003; font-size: 12px; }
.suggestion-list { padding-right: 14px; }
.suggestion-list button { display: flex; justify-content: space-between; align-items: center; width: 100%; min-height: 33px; padding: 6px 10px; border: 0; text-align: left; color: inherit; background: transparent; cursor: pointer; }
.suggestion-list button[aria-selected='true'], .suggestion-list button:hover { background: var(--control-hover); color: var(--accent); }
.suggestion-list code { font-size: 11px; opacity: .8; }
.visual-message { margin: 0; padding: 8px 16px; font-size: 12px; color: var(--text-secondary); background: var(--panel-bg); }
.visual-message button { margin: 4px 6px 0 0; padding: 4px 8px; border: 1px solid var(--border-color); border-radius: 4px; color: var(--accent); background: var(--control-hover); cursor: pointer; }
.visual-host :deep(.milkdown) {
  --crepe-color-background: var(--editor-bg);
  --crepe-color-on-background: var(--text-primary);
  --crepe-color-surface: var(--panel-bg);
  --crepe-color-surface-low: var(--control-hover);
  --crepe-color-on-surface: var(--text-primary);
  --crepe-color-on-surface-variant: var(--text-secondary);
  --crepe-color-outline: var(--border-color);
  --crepe-color-primary: var(--accent);
  --crepe-color-secondary: var(--control-hover);
  --crepe-color-on-secondary: var(--text-primary);
  --crepe-color-hover: var(--control-hover);
  --crepe-color-selected: color-mix(in srgb, var(--accent) 24%, var(--editor-bg));
  --crepe-color-inline-area: var(--panel-bg);
  --crepe-color-inline-code: var(--accent);
  --crepe-color-error: var(--danger);
  --crepe-font-default: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
  --crepe-font-title: var(--crepe-font-default);
  --crepe-font-code: Consolas, 'Courier New', monospace;
  --crepe-base-font-size: 16px;
}
.visual-host :deep(.milkdown .ProseMirror) { padding: 28px clamp(24px, 5vw, 64px) 100px; max-width: 960px; margin: auto; min-height: 320px; font-size: 16px; line-height: 1.6; overflow-wrap: anywhere; }
.visual-host :deep(.ProseMirror.md-editor-preview) { color: var(--md-theme-color, var(--preview-text)); background-color: var(--md-theme-bg-color, var(--preview-bg)); }
.visual-host :deep(.milkdown .ProseMirror)::selection,
.visual-host :deep(.milkdown .ProseMirror *)::selection { color: var(--text-primary); background: color-mix(in srgb, var(--accent) 28%, var(--editor-bg)); }
.visual-host :deep(.milkdown .ProseMirror .ProseMirror-selectednode) { color: var(--text-primary); background: color-mix(in srgb, var(--accent) 14%, var(--editor-bg)); outline: 1px solid color-mix(in srgb, var(--accent) 50%, transparent); border-radius: 3px; }
.visual-host :deep(.milkdown .ProseMirror .ProseMirror-selectednode *)::selection { color: inherit; background: transparent; }
.visual-host :deep(.milkdown-block-handle .operation-item:last-child) { cursor: grab; }
.visual-host :deep(.milkdown-block-handle .operation-item:last-child:active) { cursor: grabbing; }
.visual-host :deep(.note-block-dragging) { cursor: grabbing; user-select: none; }
.visual-host :deep(.milkdown-code-block) { position: relative; padding: 8px 14px 16px; margin: 20px 0; border: 0; border-radius: 7px; background: #282c34; color: #abb2bf; overflow-anchor: none; }
.visual-host :deep(.milkdown-code-block .tools) { min-height: 24px; justify-content: flex-end; gap: 12px; padding-left: 64px; margin-bottom: 12px; }
.visual-host :deep(.milkdown-code-block .tools)::before { content: ''; position: absolute; left: 16px; top: 17px; width: 11px; height: 11px; border-radius: 50%; background: #fc625d; box-shadow: 17px 0 #fdbc40, 34px 0 #35cd4b; }
.visual-host :deep(.milkdown-code-block .cm-editor) { color: #abb2bf; background: transparent; font-style: normal; }
.visual-host :deep(.milkdown-code-block .cm-scroller) { font-family: var(--markdown-font-mono); font-size: 13.6px; line-height: 1.45; overflow-anchor: none; }
.visual-host :deep(.milkdown-code-block .cm-content.hljs) { caret-color: #e6edf3; padding: 4px 0; background: transparent; color: #abb2bf; }
.visual-host :deep(.milkdown-code-block .cm-line) { padding: 0; }
/* CodeMirror draws its own selection. A second native selection overlay causes
   colour flicker; keep its text colours intact instead of the prose override. */
.visual-host :deep(.milkdown .ProseMirror .cm-content)::selection,
.visual-host :deep(.milkdown .ProseMirror .cm-content *)::selection { color: inherit; background: transparent; }
.visual-host :deep(.milkdown-code-block .milkdown-code-block-placeholder) { padding: 40px 0 4px; font: 13.6px/1.45 var(--markdown-font-mono); }
.visual-host :deep(.milkdown-code-block .cm-cursor) { border-left-color: #e6edf3; }
.visual-host :deep(.milkdown-code-block .cm-gutters) { display: none; }
.visual-host :deep(.milkdown-code-block .cm-activeLine), .visual-host :deep(.milkdown-code-block .cm-activeLineGutter) { background: transparent; }
.visual-host :deep(.milkdown-code-block .cm-selectionBackground) { background: #386a9b; }
.visual-host :deep(.milkdown-code-block .language-button) { opacity: 1; margin: 0; background: transparent; color: #abb2bf; font-weight: 400; }
.visual-host :deep(.milkdown-code-block:focus-within .tools-button-group button) { opacity: 1; }
.visual-host :deep(.milkdown-code-block .tools-button-group button) { opacity: 1; border-radius: 4px; font-weight: 400; background: transparent; color: #abb2bf; }
.visual-host :deep(.milkdown-code-block .tools-button-group button svg) { fill: currentColor; }
.visual-host :deep(.milkdown-code-block .language-list) { max-height: 240px; }
.visual-host :deep(.vuepress-official-theme .milkdown-code-block) { background: var(--vp-c-bg-alt); border-radius: 6px; margin: 12px 0; }
.visual-host :deep(.vuepress-official-theme .milkdown-code-block .tools)::before { display: none; }
.visual-host :deep(.vuepress-official-theme .milkdown-code-block .cm-content.hljs) { color: var(--vp-c-text); }
.visual-host :deep(.vuepress-official-theme .milkdown-code-block .cm-scroller) { font-size: 14px; line-height: 1.6; }
.visual-host :deep(.vuepress-official-theme .milkdown-code-block .language-button),
.visual-host :deep(.vuepress-official-theme .milkdown-code-block .tools-button-group button) { color: var(--vp-c-text-subtle); }
</style>
