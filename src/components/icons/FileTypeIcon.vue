<script setup lang="ts">
import { computed } from 'vue';
import { extensionFromFilename } from '@/editor/language/languageManager';
import type { SupportedLanguage } from '@/types/editor';

const props = defineProps<{
  language: SupportedLanguage;
  filename?: string;
}>();

const extension = computed(() => extensionFromFilename(props.filename ?? ''));
const shortLabel = computed(() => {
  switch (props.language) {
    case 'json': return '{}';
    case 'html': return '</>';
    case 'css': return extension.value === 'scss' ? 'S' : extension.value === 'less' ? 'L' : '#';
    case 'javascript': return extension.value === 'jsx' ? 'JSX' : 'JS';
    case 'typescript': return extension.value === 'tsx' ? 'TSX' : 'TS';
    case 'yaml': return 'YML';
    case 'xml': return extension.value === 'svg' ? 'SVG' : 'XML';
    case 'nginx': return 'NGX';
    case 'plaintext':
      if (extension.value === 'log') return 'LOG';
      if (extension.value === 'ini' || extension.value === 'conf') return 'INI';
      return 'TXT';
    default: return '';
  }
});
</script>

<template>
  <span
    class="file-type-icon"
    :class="[`type-${language}`, extension ? `extension-${extension}` : '']"
    aria-hidden="true"
  >
    <svg v-if="language === 'markdown'" viewBox="0 0 18 18">
      <rect x="1.25" y="2.25" width="15.5" height="13.5" rx="2" />
      <path d="M3.8 11.7V6.8l2.3 2.7 2.3-2.7v4.9M11.1 7.1v4.1m-1.5-1.4 1.5 1.5 1.5-1.5" />
    </svg>
    <span v-else class="glyph">{{ shortLabel }}</span>
  </span>
</template>

<style scoped lang="scss">
.file-type-icon {
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  display: grid;
  place-items: center;
  overflow: hidden;
  --file-icon-color: #607d8b;
  color: var(--file-icon-color);

  svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.35;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.glyph {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  border-radius: 2px;
  color: #fff;
  background: var(--file-icon-color);
  font-family: Consolas, 'Cascadia Mono', monospace;
  font-size: 6.5px;
  font-weight: 800;
  letter-spacing: -0.35px;
  line-height: 1;
  text-indent: -0.2px;

}

.type-markdown { --file-icon-color: #1976d2; }
.type-json { --file-icon-color: #b7791f; }
.type-html { --file-icon-color: #e34f26; }
.type-css { --file-icon-color: #1572b6; }
.type-javascript { --file-icon-color: #f7df1e; .glyph { color: #222; } }
.type-typescript { --file-icon-color: #3178c6; }
.type-yaml { --file-icon-color: #8e44ad; }
.type-xml { --file-icon-color: #d35400; }
.type-nginx { --file-icon-color: #009639; }
.type-plaintext { --file-icon-color: #718096; }

.extension-scss { --file-icon-color: #c6538c; }
.extension-less { --file-icon-color: #1d365d; }
.extension-svg { --file-icon-color: #e89b27; }
.extension-log { --file-icon-color: #607d8b; }
.extension-ini,
.extension-conf { --file-icon-color: #5c6bc0; }
</style>
