<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import ImageUploader from '@/editor/components/ImageUploader.vue';
import Toolbar from '@/editor/components/Toolbar.vue';
import { PaneResizeManager } from '@/editor/layout/PaneResizeManager';
import MonacoEditor from '@/editor/monaco/MonacoEditor.vue';
import { previewKindForLanguage, supportsPreview } from '@/editor/language/languageManager';
import MarkdownPreview from '@/markdown/components/MarkdownPreview.vue';
import MarkdownToc from '@/markdown/components/MarkdownToc.vue';
import type {
  CodeThemeName,
  CursorPosition,
  EditorCommand,
  EditorDocument,
  EditorMode,
  PreviewThemeName,
  ResolvedTheme,
  TextSelection,
  TocItem
} from '@/types/editor';

interface MonacoEditorApi {
  focus: () => void;
  focusSelection: (selection: TextSelection) => Promise<void>;
  showFind: (replace?: boolean) => void;
  undo: () => void;
  redo: () => void;
  selectAll: () => void;
  formatDocument: () => void;
  runCommand: (command: EditorCommand) => boolean;
  insertText: (text: string) => void;
  setScrollRatio: (ratio: number) => void;
  layout: () => void;
}

interface ImageUploaderApi {
  open: (mode?: 'upload' | 'crop') => void;
}

const PANE_HANDLE_WIDTH = 7;
const MIN_EDITOR_PANE_WIDTH = 240;
const MIN_PREVIEW_PANE_WIDTH = 240;
const MIN_TOC_WIDTH = 180;
const MAX_TOC_WIDTH = 480;

const props = defineProps<{
  document: EditorDocument;
  theme: ResolvedTheme;
  previewTheme: PreviewThemeName;
  codeTheme: CodeThemeName;
}>();

const emit = defineEmits<{
  'update:content': [content: string];
  'update:mode': [mode: EditorMode];
  'update:cursor': [cursor: CursorPosition];
  'update:previewTheme': [theme: PreviewThemeName];
  'update:codeTheme': [theme: CodeThemeName];
}>();

const monacoEditor = ref<MonacoEditorApi>();
const imageUploader = ref<ImageUploaderApi>();
const editorStage = ref<HTMLElement>();
const editorPane = ref<HTMLElement>();
const previewScroll = ref<HTMLElement>();
const tocItems = ref<TocItem[]>([]);
const tocOpen = ref(true);
const activeTocId = ref<string | null>(null);
const editorPaneWidth = ref<number | null>(null);
const tocPaneWidth = ref(230);
let scrollSource: 'editor' | 'preview' | null = null;
const resizeTarget = ref<'editor-preview' | 'toc' | null>(null);
let layoutFrame = 0;
let stageResizeObserver: ResizeObserver | undefined;

const previewKind = computed(() => previewKindForLanguage(props.document.language));
const previewSupported = computed(() => supportsPreview(props.document.language));
const effectiveMode = computed<EditorMode>(() =>
  previewSupported.value ? props.document.mode : 'editor'
);
const showEditor = computed(() => effectiveMode.value !== 'preview');
const showPreview = computed(() => effectiveMode.value !== 'editor' && previewSupported.value);
const showToolbar = computed(() => props.document.language === 'markdown');
const showToc = computed(
  () => showPreview.value && previewKind.value === 'markdown' && tocOpen.value
);
const stageStyle = computed(() => {
  const columns: string[] = [];
  if (showEditor.value) {
    columns.push(
      showPreview.value && editorPaneWidth.value !== null
        ? `minmax(240px, ${editorPaneWidth.value}px)`
        : 'minmax(240px, 1fr)'
    );
  }
  if (showEditor.value && showPreview.value) columns.push(`${PANE_HANDLE_WIDTH}px`);
  if (showPreview.value) columns.push('minmax(240px, 1fr)');
  if (showToc.value) columns.push(`${PANE_HANDLE_WIDTH}px`, `${tocPaneWidth.value}px`);
  return { gridTemplateColumns: columns.join(' ') };
});

const formattedJson = computed(() => {
  if (previewKind.value !== 'json') return '';
  try {
    return JSON.stringify(JSON.parse(props.document.content), null, 2);
  } catch (error) {
    return error instanceof Error ? `JSON 解析错误：${error.message}` : 'JSON 解析错误';
  }
});

const htmlSource = computed(() =>
  previewKind.value === 'html' ? props.document.content : '<!doctype html><html><body></body></html>'
);

function updateMode(mode: EditorMode): void {
  if (!previewSupported.value && mode !== 'editor') return;
  emit('update:mode', mode);
  void nextTick(() => monacoEditor.value?.layout());
}

async function ensureEditor(): Promise<MonacoEditorApi | undefined> {
  if (!showEditor.value) {
    emit('update:mode', 'split');
    await nextTick();
  }
  return monacoEditor.value;
}

async function runCommand(command: EditorCommand): Promise<void> {
  const editor = await ensureEditor();
  if (!editor) return;
  if (command.type === 'image' && command.action !== 'link') {
    imageUploader.value?.open(command.action);
    return;
  }
  editor.runCommand(command);
}

function insertUploadedImage(markdown: string): void {
  monacoEditor.value?.insertText(markdown);
}

function setPreviewScrollRatio(ratio: number): void {
  const element = previewScroll.value;
  if (!element || scrollSource === 'preview') return;
  const range = element.scrollHeight - element.clientHeight;
  scrollSource = 'editor';
  element.scrollTop = Math.max(0, Math.min(1, ratio)) * Math.max(0, range);
  requestAnimationFrame(() => {
    if (scrollSource === 'editor') scrollSource = null;
  });
}

function onPreviewScroll(): void {
  const element = previewScroll.value;
  if (!element || scrollSource === 'editor') return;
  const range = element.scrollHeight - element.clientHeight;
  const ratio = range > 0 ? element.scrollTop / range : 0;
  scrollSource = 'preview';
  monacoEditor.value?.setScrollRatio(ratio);
  updateActiveHeading(element);
  requestAnimationFrame(() => {
    if (scrollSource === 'preview') scrollSource = null;
  });
}

function updateActiveHeading(root: HTMLElement): void {
  if (previewKind.value !== 'markdown') return;
  const headings = [...root.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')];
  const rootTop = root.getBoundingClientRect().top;
  let active: HTMLElement | undefined;
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top - rootTop <= 72) active = heading;
    else break;
  }
  activeTocId.value = active?.id ?? headings[0]?.id ?? null;
}

function navigateToHeading(id: string): void {
  const root = previewScroll.value;
  const heading = root?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  if (!root || !heading) return;
  activeTocId.value = id;
  root.scrollTo({ top: heading.offsetTop - 18, behavior: 'smooth' });
}

function scheduleEditorLayout(): void {
  if (layoutFrame) return;
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = 0;
    monacoEditor.value?.layout();
  });
}

function setResizeActive(target: 'editor-preview' | 'toc', active: boolean): void {
  if (active) {
    resizeTarget.value = target;
    document.body.classList.add('pane-resizing');
  } else if (resizeTarget.value === target) {
    resizeTarget.value = null;
    document.body.classList.remove('pane-resizing');
  }
}

const editorPreviewResizeManager = new PaneResizeManager({
  edge: 'start',
  getContainer: () => editorStage.value,
  getCurrentSize: () =>
    editorPaneWidth.value ?? editorPane.value?.getBoundingClientRect().width ?? 320,
  getBounds: () => {
    const stageWidth = editorStage.value?.getBoundingClientRect().width ?? 0;
    const tocSpace = showToc.value ? tocPaneWidth.value + PANE_HANDLE_WIDTH : 0;
    return {
      min: MIN_EDITOR_PANE_WIDTH,
      max: stageWidth - tocSpace - PANE_HANDLE_WIDTH - MIN_PREVIEW_PANE_WIDTH
    };
  },
  onResize: (size) => {
    editorPaneWidth.value = size;
    scheduleEditorLayout();
  },
  onActiveChange: (active) => setResizeActive('editor-preview', active)
});

const tocResizeManager = new PaneResizeManager({
  edge: 'end',
  getContainer: () => editorStage.value,
  getCurrentSize: () => tocPaneWidth.value,
  getBounds: () => {
    const stageWidth = editorStage.value?.getBoundingClientRect().width ?? 0;
    const editorSpace =
      showEditor.value && showPreview.value
        ? (editorPaneWidth.value ?? editorPane.value?.getBoundingClientRect().width ?? 0) +
          PANE_HANDLE_WIDTH
        : 0;
    return {
      min: MIN_TOC_WIDTH,
      max: Math.min(
        MAX_TOC_WIDTH,
        stageWidth - editorSpace - PANE_HANDLE_WIDTH - MIN_PREVIEW_PANE_WIDTH
      )
    };
  },
  onResize: (size) => {
    tocPaneWidth.value = size;
    scheduleEditorLayout();
  },
  onActiveChange: (active) => setResizeActive('toc', active)
});

function constrainPaneSizes(): void {
  tocResizeManager.constrain();
  editorPreviewResizeManager.constrain();
}

async function focusSelection(selection: TextSelection): Promise<void> {
  const editor = await ensureEditor();
  await editor?.focusSelection(selection);
}

async function showFind(replace = false): Promise<void> {
  const editor = await ensureEditor();
  editor?.showFind(replace);
}

async function undo(): Promise<void> {
  (await ensureEditor())?.undo();
}

async function redo(): Promise<void> {
  (await ensureEditor())?.redo();
}

async function selectAll(): Promise<void> {
  (await ensureEditor())?.selectAll();
}

async function formatDocument(): Promise<void> {
  (await ensureEditor())?.formatDocument();
}

async function focus(): Promise<void> {
  (await ensureEditor())?.focus();
}

watch([showToc, showPreview], () => void nextTick(constrainPaneSizes));

onMounted(() => {
  if (!editorStage.value) return;
  stageResizeObserver = new ResizeObserver(constrainPaneSizes);
  stageResizeObserver.observe(editorStage.value);
});

onBeforeUnmount(() => {
  stageResizeObserver?.disconnect();
  editorPreviewResizeManager.destroy();
  tocResizeManager.destroy();
  document.body.classList.remove('pane-resizing');
  if (layoutFrame) cancelAnimationFrame(layoutFrame);
});

defineExpose({ focus, focusSelection, showFind, undo, redo, selectAll, formatDocument });
</script>

<template>
  <section class="document-editor" :class="{ 'has-toolbar': showToolbar }">
    <Toolbar
      v-if="showToolbar"
      :mode="effectiveMode"
      :toc-open="tocOpen"
      :preview-theme="previewTheme"
      :code-theme="codeTheme"
      @command="runCommand"
      @update:mode="updateMode"
      @update:preview-theme="emit('update:previewTheme', $event)"
      @update:code-theme="emit('update:codeTheme', $event)"
      @toggle-toc="tocOpen = !tocOpen"
    />

    <div
      ref="editorStage"
      class="editor-stage"
      :class="`mode-${effectiveMode}`"
      :style="stageStyle"
    >
      <div v-if="showEditor" ref="editorPane" class="editor-pane">
        <MonacoEditor
          ref="monacoEditor"
          :document-id="document.id"
          :filename="document.filename"
          :model-value="document.content"
          :language="document.language"
          :theme="theme"
          :cursor="document.cursor"
          @update:model-value="emit('update:content', $event)"
          @cursor-change="emit('update:cursor', $event)"
          @scroll-ratio="setPreviewScrollRatio"
        />
      </div>

      <div
        v-if="showEditor && showPreview"
        class="pane-resizer primary"
        :class="{ active: resizeTarget === 'editor-preview' }"
        role="separator"
        aria-label="调整编辑区和预览区宽度"
        aria-orientation="vertical"
        tabindex="0"
        @pointerdown="editorPreviewResizeManager.start($event)"
        @keydown.left.prevent="editorPreviewResizeManager.resizeBy(-24)"
        @keydown.right.prevent="editorPreviewResizeManager.resizeBy(24)"
      />

      <div v-if="showPreview" ref="previewScroll" class="preview-pane" @scroll.passive="onPreviewScroll">
        <MarkdownPreview
          v-if="previewKind === 'markdown'"
          :source="document.content"
          :document-path="document.path"
          :theme="theme"
          :preview-theme="previewTheme"
          :code-theme="codeTheme"
          @toc-change="tocItems = $event"
        />
        <iframe
          v-else-if="previewKind === 'html'"
          class="html-preview"
          title="HTML 预览"
          sandbox=""
          :srcdoc="htmlSource"
        />
        <pre v-else-if="previewKind === 'json'" class="json-preview"><code>{{ formattedJson }}</code></pre>
      </div>

      <div
        v-if="showToc"
        class="pane-resizer"
        :class="{ active: resizeTarget === 'toc' }"
        role="separator"
        aria-label="调整预览区和目录宽度"
        aria-orientation="vertical"
        tabindex="0"
        @pointerdown="tocResizeManager.start($event)"
        @keydown.left.prevent="tocResizeManager.resizeBy(24)"
        @keydown.right.prevent="tocResizeManager.resizeBy(-24)"
      />

      <MarkdownToc
        v-if="showToc"
        class="toc-pane"
        :items="tocItems"
        :active-id="activeTocId"
        @navigate="navigateToHeading"
      />
    </div>

    <ImageUploader ref="imageUploader" :document-path="document.path" @insert="insertUploadedImage" />
  </section>
</template>

<style scoped lang="scss">
.document-editor {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  background: var(--editor-bg);
}

.document-editor.has-toolbar {
  grid-template-rows: auto minmax(0, 1fr);
}

.editor-stage {
  position: relative;
  min-width: 0;
  min-height: 0;
  z-index: 0;
  display: grid;
  overflow: hidden;
  isolation: isolate;
  background: var(--panel-bg);
}

.editor-pane,
.preview-pane {
  min-width: 0;
  min-height: 0;
}

.editor-pane {
  overflow: hidden;
  background: var(--editor-bg);
}

.preview-pane {
  overflow: auto;
  background: var(--preview-canvas-bg);
}

.toc-pane {
  width: 100%;
  min-width: 0;
}

.pane-resizer {
  position: relative;
  z-index: 8;
  width: 7px;
  min-width: 7px;
  height: 100%;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
  user-select: none;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 3px;
    width: 1px;
    opacity: 0;
    background: color-mix(in srgb, var(--accent) 82%, transparent);
    transition:
      opacity 0.12s ease,
      background-color 0.12s ease;
  }

  &.primary::after {
    opacity: 1;
    background: color-mix(in srgb, var(--border-color) 88%, transparent);
  }

  &:hover::after,
  &:focus-visible::after,
  &.active::after {
    opacity: 1;
    background: color-mix(in srgb, var(--accent) 82%, transparent);
  }

  &:focus-visible {
    outline: none;
  }
}

.html-preview {
  width: 100%;
  height: 100%;
  display: block;
  border: 0;
  background: #fff;
}

.json-preview {
  min-height: 100%;
  margin: 0;
  padding: 26px 30px 70px;
  color: var(--preview-text);
  background: var(--preview-bg);
  font: 13px/1.65 var(--font-mono);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

:global(body.pane-resizing),
:global(body.pane-resizing *) {
  cursor: col-resize !important;
  user-select: none !important;
}
</style>

