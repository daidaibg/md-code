<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { executeMarkdownCommand } from '@/editor/commands/markdownCommandLayer';
import { getOrCreateModel } from '@/editor/monaco/modelRegistry';
import { monaco } from '@/editor/monaco/setupMonaco';
import type {
  CursorPosition,
  EditorCommand,
  ResolvedTheme,
  SupportedLanguage,
  TextSelection
} from '@/types/editor';

const props = defineProps<{
  documentId: string;
  filename: string;
  modelValue: string;
  language: SupportedLanguage;
  theme: ResolvedTheme;
  cursor: CursorPosition;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'cursor-change': [cursor: CursorPosition];
  'scroll-ratio': [ratio: number];
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

function editorTheme(): string {
  return props.theme === 'dark' ? 'vs-dark' : 'vs';
}

function currentScrollRatio(): number {
  if (!editor) return 0;
  const range = editor.getScrollHeight() - editor.getLayoutInfo().height;
  return range > 0 ? editor.getScrollTop() / range : 0;
}

onMounted(() => {
  if (!container.value) return;

  model = getOrCreateModel({
    documentId: props.documentId,
    filename: props.filename,
    content: props.modelValue,
    language: props.language
  });

  editor = monaco.editor.create(container.value, {
    model,
    theme: editorTheme(),
    automaticLayout: false,
    fontFamily: 'Cascadia Code, JetBrains Mono, Consolas, monospace',
    fontLigatures: true,
    fontSize: 14,
    lineHeight: 22,
    minimap: { enabled: false },
    wordWrap: props.language === 'markdown' ? 'on' : 'off',
    renderWhitespace: 'selection',
    renderLineHighlight: 'line',
    smoothScrolling: true,
    scrollBeyondLastLine: false,
    padding: { top: 18, bottom: 30 },
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: true,
    bracketPairColorization: { enabled: true },
    guides: { bracketPairs: true, indentation: true },
    stickyScroll: { enabled: false },
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

  scrollDisposable = editor.onDidScrollChange(() => {
    if (!applyingExternalScroll) emit('scroll-ratio', currentScrollRatio());
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
    editor?.updateOptions({ wordWrap: language === 'markdown' ? 'on' : 'off' });
  }
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

function setScrollRatio(ratio: number): void {
  if (!editor) return;
  const range = editor.getScrollHeight() - editor.getLayoutInfo().height;
  applyingExternalScroll = true;
  editor.setScrollTop(Math.max(0, Math.min(1, ratio)) * Math.max(0, range));
  requestAnimationFrame(() => {
    applyingExternalScroll = false;
  });
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
  setScrollRatio,
  layout
});
</script>

<template>
  <div ref="container" class="monaco-editor-host" />
</template>

<style scoped>
.monaco-editor-host {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--editor-bg);
}
</style>