<script setup lang="ts">
import type { ToolbarIconName } from '@/types/editor';

defineProps<{ name: ToolbarIconName }>();
</script>

<template>
  <svg
    class="toolbar-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'undo'">
      <path d="M9 7 4 12l5 5" />
      <path d="M5 12h9a6 6 0 0 1 6 6" />
    </template>
    <template v-else-if="name === 'redo'">
      <path d="m15 7 5 5-5 5" />
      <path d="M19 12h-9a6 6 0 0 0-6 6" />
    </template>
    <template v-else-if="name === 'heading'">
      <path d="M5 5v14M15 5v14M5 12h10" />
      <path d="m18 10 2-2v8" />
    </template>
    <template v-else-if="name === 'bold'">
      <path d="M7 5h5a4 4 0 0 1 0 8H7z" />
      <path d="M7 13h6a3 3 0 0 1 0 6H7z" />
    </template>
    <template v-else-if="name === 'italic'">
      <path d="M10 5h7M7 19h7M14 5 10 19" />
    </template>
    <template v-else-if="name === 'strike'">
      <path d="M16 6.5A5.5 5.5 0 0 0 12 5c-2.5 0-4 1.2-4 3 0 1.5 1 2.4 3 3M8 17.5A6 6 0 0 0 12.5 19c2.5 0 4.5-1.1 4.5-3 0-1.3-.8-2.2-2.4-2.8" />
      <path d="M4 12h16" />
    </template>
    <template v-else-if="name === 'quote'">
      <path d="M6 9h4v5H6l-1 3M14 9h4v5h-4l-1 3" />
    </template>
    <template v-else-if="name === 'unordered-list'">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="18" r="1" fill="currentColor" stroke="none" />
    </template>
    <template v-else-if="name === 'ordered-list'">
      <path d="M10 6h10M10 12h10M10 18h10M4 5h2v3M4 12c.4-.7 2-1 2-2 0-.7-.5-1-1-1-.6 0-1 .3-1.2.7M4 16h2l-2 3h2" />
    </template>
    <template v-else-if="name === 'task-list'">
      <rect x="4" y="4" width="5" height="5" rx="1" />
      <rect x="4" y="15" width="5" height="5" rx="1" />
      <path d="m5.5 6.5 1 1 2-2M12 6.5h8M12 17.5h8" />
    </template>
    <template v-else-if="name === 'inline-code'">
      <path d="m9 7-5 5 5 5M15 7l5 5-5 5" />
    </template>
    <template v-else-if="name === 'code-block'">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m9 9-3 3 3 3M15 9l3 3-3 3" />
    </template>
    <template v-else-if="name === 'link'">
      <path d="m9.5 14.5 5-5M7.2 17.8l-1 .9a3.5 3.5 0 0 1-5-5l3.3-3.3a3.5 3.5 0 0 1 5 0M16.8 6.2l1-.9a3.5 3.5 0 0 1 5 5l-3.3 3.3a3.5 3.5 0 0 1-5 0" />
    </template>
    <template v-else-if="name === 'image'">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m4 17 5-5 3 3 2-2 6 6" />
    </template>
    <template v-else-if="name === 'table'">
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
    </template>
    <template v-else-if="name === 'mermaid'">
      <path d="M4 19V5l5 4 3-3 3 3 5-4v14" />
      <path d="M4 19h16M8 16h8" />
    </template>
    <template v-else-if="name === 'admonition'">
      <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M12 8v4M12 14.5h.01" />
    </template>
    <template v-else-if="name === 'formula'">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M15 7H9l3 5-3 5h6" />
    </template>
    <template v-else-if="name === 'emoji'">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 10h.01M15.5 10h.01M8 14c1 2 2.3 3 4 3s3-1 4-3" />
    </template>
    <template v-else-if="name === 'preview'">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </template>
    <template v-else-if="name === 'split'">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16M7 9h2M7 13h2M15 9h2M15 13h2" />
    </template>
    <template v-else-if="name === 'editor'">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10M7 12h7M7 16h9" />
    </template>
    <template v-else-if="name === 'toc'">
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h1M4 12h1M4 18h1" />
    </template>
    <template v-else-if="name === 'new-file'">
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5M9 14h6M12 11v6" />
    </template>
    <template v-else-if="name === 'open'">
      <path d="M3 7h7l2 2h9l-3 10H5z" />
      <path d="M5 7V5h6l2 2h6v2" />
    </template>
    <template v-else-if="name === 'save'">
      <path d="M5 3h12l3 3v15H4V4z" />
      <path d="M8 3v6h8V3M8 21v-7h8v7" />
    </template>
    <template v-else-if="name === 'save-as'">
      <path d="M5 3h11l3 3v6M8 3v6h7V3M8 20H4V4" />
      <path d="m13 18 5-5 3 3-5 5-4 1z" />
    </template>
    <template v-else-if="name === 'minimize'">
      <path d="M6 12h12" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="m7 7 10 10M17 7 7 17" />
    </template>
    <template v-else-if="name === 'file'">
      <path d="M6 3h8l4 4v14H6zM14 3v5h5" />
    </template>
    <template v-else-if="name === 'recent'">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2M4 5v4h4" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </template>
    <template v-else-if="name === 'sun'">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </template>
    <template v-else-if="name === 'moon'">
      <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z" />
    </template>
  </svg>
</template>

<style scoped>
.toolbar-icon {
  width: 20px;
  height: 20px;
  display: block;
}
</style>
