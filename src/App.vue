<script setup lang="ts">
import NoteWindow from '@/notes/components/NoteWindow.vue';

const standaloneNotesWindow = Boolean(
  (window as Window & { __MD_CODE_NOTES_WINDOW__?: boolean }).__MD_CODE_NOTES_WINDOW__
);
</script>

<template>
  <NoteWindow v-if="standaloneNotesWindow" />
  <RouterView v-else />
</template>
