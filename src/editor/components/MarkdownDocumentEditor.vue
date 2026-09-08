<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue';
import DocumentEditor from './DocumentEditor.vue';
import EditorViewControls from './EditorViewControls.vue';
import MarkdownEditorHeader from './MarkdownEditorHeader.vue';
import type { MonacoSettings } from '@/store/settings';
import type { CodeThemeName, CursorPosition, EditorCommand, EditorDocument, EditorMode, PreviewThemeName, ResolvedTheme, TextSelection } from '@/types/editor';

const VisualEditor = defineAsyncComponent(() => import('@/notes/components/NoteVisualEditor.vue'));
const props = defineProps<{
  document: EditorDocument; theme: ResolvedTheme; previewTheme: PreviewThemeName;
  codeTheme: CodeThemeName; editorSettings: MonacoSettings;
}>();
const emit = defineEmits<{
  'update:content': [content: string]; 'update:mode': [mode: EditorMode];
  'update:cursor': [cursor: CursorPosition]; 'update:previewTheme': [theme: PreviewThemeName];
  'update:codeTheme': [theme: CodeThemeName];
}>();
const visual = ref(true);
const preview = ref(false);
const toc = ref(true);
const message = ref('');
const sourceEditor = ref<InstanceType<typeof DocumentEditor>>();
const visualEditor = ref<{ focus(): void; undo(): void; redo(): void; selectAll(): void; runCommand(command: EditorCommand): void }>();
const mode = computed<EditorMode>(() => visual.value ? preview.value ? 'preview' : 'editor' : props.document.mode);
const sourceDocument = computed(() => ({ ...props.document, mode: mode.value }));
function setVisual(value: boolean): void {
  visual.value = value;
  preview.value = false;
  message.value = '';
  emit('update:mode', 'editor');
}
function setMode(value: EditorMode): void {
  if (visual.value && value !== 'split') preview.value = value === 'preview';
  else { visual.value = false; preview.value = false; }
  emit('update:mode', value);
}
watch(() => props.document.mode, value => {
  if (value === 'split') { visual.value = false; preview.value = false; }
  else if (visual.value) preview.value = value === 'preview';
});
function unavailable(reason: string): void { setVisual(false); message.value = reason; }
async function ensureSource() {
  setVisual(false);
  await nextTick();
  return sourceEditor.value;
}
async function focus() { if (visual.value && !preview.value) visualEditor.value?.focus(); else await sourceEditor.value?.focus(); }
async function undo() { if (visual.value && !preview.value) visualEditor.value?.undo(); else await sourceEditor.value?.undo(); }
async function redo() { if (visual.value && !preview.value) visualEditor.value?.redo(); else await sourceEditor.value?.redo(); }
async function selectAll() { if (visual.value && !preview.value) visualEditor.value?.selectAll(); else await sourceEditor.value?.selectAll(); }
async function showFind(replace = false) { await (await ensureSource())?.showFind(replace); }
async function focusSelection(selection: TextSelection) { await (await ensureSource())?.focusSelection(selection); }
async function formatDocument() { await (await ensureSource())?.formatDocument(); }
async function runCommand(command: EditorCommand) {
  if (visual.value && !preview.value) visualEditor.value?.runCommand(command);
  else await sourceEditor.value?.runCommand(command);
}
defineExpose({ focus, undo, redo, selectAll, showFind, focusSelection, formatDocument, runCommand });
</script>

<template>
  <section class="markdown-document-editor">
    <MarkdownEditorHeader>
      <EditorViewControls show-editor-switch :visual="visual" :mode="mode" :toc-open="toc" :preview-theme="previewTheme" :code-theme="codeTheme"
        @update:visual="setVisual" @update:mode="setMode" @toggle-toc="toc = !toc"
        @update:preview-theme="emit('update:previewTheme', $event)" @update:code-theme="emit('update:codeTheme', $event)" />
    </MarkdownEditorHeader>
    <p v-if="message" class="markdown-message" role="status">{{ message }}</p>
    <div class="markdown-content">
      <VisualEditor v-if="visual && !preview" ref="visualEditor" :source="document.content" :document-path="document.path"
        :theme="theme" :toc-open="toc" :preview-theme="previewTheme" :code-theme="codeTheme"
        @update:source="emit('update:content', $event)" @request-source="setVisual(false)" @unavailable="unavailable" />
      <DocumentEditor v-else ref="sourceEditor" :document="sourceDocument" :theme="theme" :preview-theme="previewTheme"
        :code-theme="codeTheme" :editor-settings="editorSettings" external-view-controls :external-toc-open="toc" break-on-newline
        @update:content="emit('update:content', $event)" @update:cursor="emit('update:cursor', $event)" @update:mode="setMode"
        @update:preview-theme="emit('update:previewTheme', $event)" @update:code-theme="emit('update:codeTheme', $event)" @toggle-toc="toc = !toc" />
    </div>
  </section>
</template>

<style scoped>
.markdown-document-editor { height: 100%; min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--editor-bg); }
.markdown-content { flex: 1; min-height: 0; min-width: 0; }
.markdown-message { margin: 0; padding: 8px 12px; color: var(--text-secondary); font-size: 12px; }
</style>
