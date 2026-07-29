<script setup lang="ts">
import ToolbarIcon from '@/components/icons/ToolbarIcon.vue';
import CodeThemeDropdown from '@/themes/components/CodeThemeDropdown.vue';
import PreviewThemeDropdown from '@/themes/components/PreviewThemeDropdown.vue';
import AdmonitionDropdown from './toolbar/AdmonitionDropdown.vue';
import EmojiDropdown from './toolbar/EmojiDropdown.vue';
import FormulaDropdown from './toolbar/FormulaDropdown.vue';
import HeadingDropdown from './toolbar/HeadingDropdown.vue';
import ImageDropdown from './toolbar/ImageDropdown.vue';
import MermaidDropdown from './toolbar/MermaidDropdown.vue';
import TableGridPicker from './toolbar/TableGridPicker.vue';
import type {
  AdmonitionKind,
  CodeThemeName,
  EditorCommand,
  EditorMode,
  MermaidDiagramType,
  PreviewThemeName,
  SimpleToolbarCommand,
  ToolbarIconName
} from '@/types/editor';

interface SimpleTool {
  command: SimpleToolbarCommand;
  icon: ToolbarIconName;
  title: string;
  divider?: boolean;
}

const props = defineProps<{
  mode: EditorMode;
  tocOpen: boolean;
  previewTheme: PreviewThemeName;
  codeTheme: CodeThemeName;
}>();

const emit = defineEmits<{
  command: [command: EditorCommand];
  'update:mode': [mode: EditorMode];
  'update:previewTheme': [theme: PreviewThemeName];
  'update:codeTheme': [theme: CodeThemeName];
  'toggle-toc': [];
}>();

const firstTools: SimpleTool[] = [
  { command: 'undo', icon: 'undo', title: '撤销' },
  { command: 'redo', icon: 'redo', title: '重做', divider: true }
];

const formatTools: SimpleTool[] = [
  { command: 'bold', icon: 'bold', title: '粗体 Ctrl+B' },
  { command: 'italic', icon: 'italic', title: '斜体 Ctrl+I' },
  { command: 'strike', icon: 'strike', title: '删除线', divider: true },
  { command: 'quote', icon: 'quote', title: '引用' },
  { command: 'unordered-list', icon: 'unordered-list', title: '无序列表' },
  { command: 'ordered-list', icon: 'ordered-list', title: '有序列表' },
  { command: 'task-list', icon: 'task-list', title: '任务列表', divider: true },
  { command: 'inline-code', icon: 'inline-code', title: '行内代码' },
  { command: 'code-block', icon: 'code-block', title: '代码块' },
  { command: 'link', icon: 'link', title: '链接' }
];

function simple(command: SimpleToolbarCommand): void {
  emit('command', { type: 'simple', command });
}

function heading(level: 1 | 2 | 3 | 4 | 5 | 6): void {
  emit('command', { type: 'heading', level });
}

function image(action: 'link' | 'upload' | 'crop'): void {
  emit('command', { type: 'image', action });
}

function table(rows: number, columns: number): void {
  emit('command', { type: 'table', rows, columns });
}

function formula(mode: 'inline' | 'block'): void {
  emit('command', { type: 'formula', mode });
}

function mermaid(diagram: MermaidDiagramType): void {
  emit('command', { type: 'mermaid', diagram });
}

function admonition(kind: AdmonitionKind): void {
  emit('command', { type: 'admonition', kind });
}
</script>

<template>
  <div class="toolbar" role="toolbar" aria-label="Markdown 工具栏">
    <div v-if="mode !== 'preview'" class="editing-tools">
      <template v-for="tool in firstTools" :key="tool.command">
        <button
          type="button"
          class="tool-button"
          :title="tool.title"
          :aria-label="tool.title"
          @click="simple(tool.command)"
        >
          <ToolbarIcon :name="tool.icon" />
        </button>
        <span v-if="tool.divider" class="divider" aria-hidden="true" />
      </template>

      <HeadingDropdown @select="heading" />

      <template v-for="tool in formatTools" :key="tool.command">
        <button
          type="button"
          class="tool-button"
          :title="tool.title"
          :aria-label="tool.title"
          @click="simple(tool.command)"
        >
          <ToolbarIcon :name="tool.icon" />
        </button>
        <span v-if="tool.divider" class="divider" aria-hidden="true" />
      </template>

      <ImageDropdown @select="image" />
      <TableGridPicker @select="table" />
      <AdmonitionDropdown @select="admonition" />
      <MermaidDropdown @select="mermaid" />
      <FormulaDropdown @select="formula" />
      <EmojiDropdown @select="emit('command', { type: 'emoji', value: $event })" />
    </div>

    <div v-else class="preview-message">阅读模式</div>

    <div class="view-tools">
      <PreviewThemeDropdown
        :model-value="previewTheme"
        @update:model-value="emit('update:previewTheme', $event)"
      />
      <CodeThemeDropdown
        :model-value="codeTheme"
        @update:model-value="emit('update:codeTheme', $event)"
      />
      <span class="divider" aria-hidden="true" />
      <button
        v-if="mode !== 'editor'"
        type="button"
        class="tool-button"
        :class="{ active: tocOpen }"
        title="显示或隐藏目录"
        aria-label="显示或隐藏目录"
        :aria-pressed="tocOpen"
        @click="emit('toggle-toc')"
      >
        <ToolbarIcon name="toc" />
      </button>
      <button
        type="button"
        class="tool-button"
        :class="{ active: mode === 'preview' }"
        title="仅预览"
        aria-label="切换到仅预览"
        @click="emit('update:mode', 'preview')"
      >
        <ToolbarIcon name="preview" />
      </button>
      <button
        type="button"
        class="tool-button"
        :class="{ active: mode === 'split' }"
        title="编辑与预览"
        aria-label="切换到编辑与预览"
        @click="emit('update:mode', 'split')"
      >
        <ToolbarIcon name="split" />
      </button>
      <button
        type="button"
        class="tool-button"
        :class="{ active: mode === 'editor' }"
        title="仅编辑"
        aria-label="切换到仅编辑"
        @click="emit('update:mode', 'editor')"
      >
        <ToolbarIcon name="editor" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.toolbar {
  position: relative;
  z-index: 20;
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border-color);
  background: var(--panel-bg);
}

.editing-tools,
.view-tools {
  display: flex;
  align-items: center;
  gap: 2px;
}

.editing-tools {
  min-width: 0;
  flex: 1 1 auto;
  flex-wrap: wrap;
}

.view-tools {
  margin-left: auto;
  padding-left: 8px;
  flex: 0 0 auto;
}

.preview-message {
  padding-left: 8px;
  color: var(--text-muted);
  font-size: 11px;
  letter-spacing: 0.05em;
}

.tool-button {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  color: var(--text-secondary);
  background: transparent;
  cursor: default;

  &:hover,
  &:focus-visible,
  &.active {
    color: var(--text-primary);
    background: var(--control-hover);
    outline: none;
  }

  &.active {
    box-shadow: inset 0 -2px 0 var(--accent);
  }
}

.divider {
  width: 1px;
  height: 20px;
  margin: 0 3px;
  flex: 0 0 auto;
  background: var(--border-color);
}

@media (max-width: 1080px) {
  .toolbar {
    align-items: flex-start;
    flex-wrap: wrap;
    overflow: visible;
  }

  .editing-tools {
    order: 2;
    flex-basis: 100%;
  }

  .view-tools {
    max-width: 100%;
    padding-left: 0;
    flex-wrap: wrap;
  }
}
</style>
