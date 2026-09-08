<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { executeMarkdownCommand } from '@/editor/commands/markdownCommandLayer';
import { saveMarkdownImage } from '@/editor/images/saveMarkdownImage';
import { showDesktopMessage } from '@/filesystem/fileSystemService';
import { getOrCreateModel } from '@/editor/monaco/modelRegistry';
import { monaco } from '@/editor/monaco/setupMonaco';
import type { ContentScrollPosition } from '@/editor/scroll/contentScroll';
import type { MonacoSettings } from '@/store/settings';
import type {
  CursorPosition,
  EditorCommand,
  ResolvedTheme,
  SupportedLanguage,
  TextSelection
} from '@/types/editor';

const props = defineProps<{
  documentId: string;
  documentPath?: string | null;
  filename: string;
  modelValue: string;
  language: SupportedLanguage;
  theme: ResolvedTheme;
  cursor: CursorPosition;
  settings: MonacoSettings;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'cursor-change': [cursor: CursorPosition];
  'content-scroll': [];
}>();

const container = ref<HTMLDivElement>();
let editor: monaco.editor.IStandaloneCodeEditor | undefined;
let model: monaco.editor.ITextModel | undefined;
let resizeObserver: ResizeObserver | undefined;
let contentDisposable: monaco.IDisposable | undefined;
let cursorDisposable: monaco.IDisposable | undefined;
let scrollDisposable: monaco.IDisposable | undefined;
let applyingExternalValue = false;
let applyingExternalScroll = false;
let expectedScrollTop: number | null = null;

function onPaste(event: ClipboardEvent): void {
  if (props.language !== 'markdown' || !editor?.hasTextFocus() || !model) return;
  const files = [...(event.clipboardData?.items ?? [])]
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile()).filter((file): file is File => file !== null);
  if (!files.length) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const targetEditor = editor;
  const targetModel = model;
  const selection = targetEditor.getSelection();
  if (!selection) return;
  const path = props.documentPath ?? null;
  // Track the paste location while disk I/O is pending, even if the user keeps typing.
  const markers = targetModel.deltaDecorations([], [{ range: selection, options: {
    stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
  } }]);
  void (async () => {
    try {
      const images = await Promise.all(files.map(file => saveMarkdownImage(file, path)));
      if (editor !== targetEditor || targetModel.isDisposed()) return;
      const range = targetModel.getDecorationRange(markers[0]!);
      if (!range) return;
      targetEditor.pushUndoStop();
      targetEditor.executeEdits('paste-images', [{ range, text: images.map(image => image.markdown).join('\n'), forceMoveMarkers: true }]);
      targetEditor.pushUndoStop();
    } catch (error) {
      await showDesktopMessage(String(error), '粘贴图片失败');
    } finally {
      if (!targetModel.isDisposed()) targetModel.deltaDecorations(markers, []);
    }
  })();
}

function editorTheme(): string {
  return props.theme === 'dark' ? 'vs-dark' : 'vs';
}

function resolvedWordWrap(): 'on' | 'off' {
  if (props.settings.wordWrap === 'language') {
    return props.language === 'markdown' ? 'on' : 'off';
  }
  return props.settings.wordWrap;
}

function settingsOptions(): monaco.editor.IEditorOptions & monaco.editor.IGlobalEditorOptions {
  return {
    fontLigatures: props.settings.fontLigatures,
    fontSize: props.settings.fontSize,
    lineHeight: props.settings.lineHeight,
    minimap: { enabled: props.settings.minimap },
    wordWrap: resolvedWordWrap(),
    renderWhitespace: props.settings.renderWhitespace,
    smoothScrolling: props.settings.smoothScrolling,
    scrollBeyondLastLine: props.settings.scrollBeyondLastLine,
    tabSize: props.settings.tabSize,
    detectIndentation: props.settings.detectIndentation,
    stickyScroll: { enabled: props.settings.stickyScroll }
  };
}

function getScrollPosition(): ContentScrollPosition {
  if (!editor || !model) return { line: 1, edge: 'start' };
  const top = editor.getScrollTop();
  const max = Math.max(0, editor.getScrollHeight() - editor.getLayoutInfo().height);
  // Use Monaco's rendered line positions: word wrap, folding and font settings
  // mean logical lines do not share a constant pixel height.
  // Visible ranges skip folded lines; searching equal line offsets would pick
  // the last hidden source line instead of the visible fold header.
  const line = editor.getVisibleRanges()[0]?.startLineNumber ?? 1;
  const start = editor.getTopForLineNumber(line);
  const end = editor.getBottomForLineNumber(line);
  return {
    line: line + Math.max(0, Math.min(1, (top - start) / Math.max(1, end - start))),
    edge: top <= 1 ? 'start' : max > 1 && top >= max - 1 ? 'end' : undefined
  };
}

onMounted(() => {
  if (!container.value) return;

  model = getOrCreateModel({
    documentId: props.documentId,
    filename: props.filename,
    content: props.modelValue,
    language: props.language
  });
  // A cached source model may be older than edits made in the visual note editor.
  // Synchronize before subscribing, without writing the stale model back to the store.
  if (model.getValue() !== props.modelValue) model.setValue(props.modelValue);

  editor = monaco.editor.create(container.value, {
    model,
    theme: editorTheme(),
    automaticLayout: false,
    fontFamily: 'Cascadia Code, JetBrains Mono, Consolas, monospace',
    ...settingsOptions(),
    renderLineHighlight: 'line',
    padding: { top: 18, bottom: 30 },
    insertSpaces: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    overviewRulerBorder: false,
    fixedOverflowWidgets: true
  });

  editor.setPosition({
    lineNumber: Math.max(1, props.cursor.lineNumber),
    column: Math.max(1, props.cursor.column)
  });

  contentDisposable = model.onDidChangeContent(() => {
    if (!applyingExternalValue) emit('update:modelValue', model?.getValue() ?? '');
  });

  cursorDisposable = editor.onDidChangeCursorPosition((event: monaco.editor.ICursorPositionChangedEvent) => {
    emit('cursor-change', {
      lineNumber: event.position.lineNumber,
      column: event.position.column
    });
  });

  scrollDisposable = editor.onDidScrollChange(event => {
    if (!event.scrollTopChanged || applyingExternalScroll) return;
    if (expectedScrollTop !== null && Math.abs(event.scrollTop - expectedScrollTop) <= 1) return;
    expectedScrollTop = null;
    emit('content-scroll');
  });

  resizeObserver = new ResizeObserver(() => editor?.layout());
  resizeObserver.observe(container.value);
  void nextTick(() => editor?.layout());
});

watch(
  () => props.modelValue,
  (value) => {
    if (!model || model.getValue() === value) return;
    applyingExternalValue = true;
    model.setValue(value);
    applyingExternalValue = false;
  }
);

watch(
  () => props.language,
  (language) => {
    if (!model) return;
    monaco.editor.setModelLanguage(model, language);
    editor?.updateOptions({ wordWrap: resolvedWordWrap() });
  }
);

watch(
  () => props.settings,
  () => editor?.updateOptions(settingsOptions()),
  { deep: true }
);

watch(
  () => props.theme,
  () => monaco.editor.setTheme(editorTheme())
);

function focus(): void {
  editor?.focus();
}

function showFind(replace = false): void {
  editor?.focus();
  editor?.trigger(
    'application-menu',
    replace ? 'editor.action.startFindReplaceAction' : 'actions.find',
    null
  );
}

function undo(): void {
  editor?.trigger('application-menu', 'undo', null);
}

function redo(): void {
  editor?.trigger('application-menu', 'redo', null);
}

function selectAll(): void {
  editor?.trigger('application-menu', 'editor.action.selectAll', null);
}

function formatDocument(): void {
  void editor?.getAction('editor.action.formatDocument')?.run();
}

function runCommand(command: EditorCommand): boolean {
  return editor ? executeMarkdownCommand(editor, command) : false;
}

function insertText(text: string): void {
  if (!editor || !model) return;
  const selection = editor.getSelection();
  if (!selection) return;
  editor.executeEdits('insert-text', [{ range: selection, text, forceMoveMarkers: true }]);
  editor.focus();
}

async function focusSelection(selection: TextSelection): Promise<void> {
  if (!editor || !model) return;
  const start = model.getPositionAt(selection.start);
  const end = model.getPositionAt(selection.end);
  editor.setSelection({
    startLineNumber: start.lineNumber,
    startColumn: start.column,
    endLineNumber: end.lineNumber,
    endColumn: end.column
  });
  editor.revealPositionInCenter(start);
  await nextTick();
  editor.focus();
}

function scrollToSourcePosition(position: ContentScrollPosition): void {
  if (!editor || !model) return;
  const line = Math.max(1, Math.min(model.getLineCount(), Math.floor(position.line)));
  const start = editor.getTopForLineNumber(line);
  const height = editor.getBottomForLineNumber(line) - start;
  const max = Math.max(0, editor.getScrollHeight() - editor.getLayoutInfo().height);
  const top = position.edge === 'start' ? 0 : position.edge === 'end' ? max
    : start + Math.max(0, Math.min(1, position.line - line)) * height;
  applyingExternalScroll = true;
  try {
    editor.setScrollTop(Math.max(0, Math.min(max, top)), monaco.editor.ScrollType.Immediate);
    expectedScrollTop = editor.getScrollTop();
  } finally {
    applyingExternalScroll = false;
  }
}

function layout(): void {
  editor?.layout();
}

onBeforeUnmount(() => {
  contentDisposable?.dispose();
  cursorDisposable?.dispose();
  scrollDisposable?.dispose();
  resizeObserver?.disconnect();
  editor?.dispose();
  editor = undefined;
});

defineExpose({
  focus,
  focusSelection,
  showFind,
  undo,
  redo,
  selectAll,
  formatDocument,
  runCommand,
  insertText,
  getScrollPosition,
  scrollToSourcePosition,
  layout
});
</script>

<template>
  <div ref="container" class="monaco-editor-host" @paste.capture="onPaste" />
</template>

<style scoped>
.monaco-editor-host {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: visible;
  background: var(--editor-bg);
}

</style>
