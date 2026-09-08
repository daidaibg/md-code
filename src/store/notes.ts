import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { deleteStoredNote, loadStoredNotes, saveStoredNote, type StoredNote } from '@/notes/noteService';

export interface Note extends StoredNote {}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function contentName(content: string): string {
  const firstContentLine = content.split(/\r?\n/u).find(line => line.trim());
  return firstContentLine?.replace(/^#{1,6}\s+/u, '').trim().slice(0, 60) || '新便签';
}

function noteTitle(note: Note): string {
  return note.name.trim() || contentName(note.content);
}

export const useNotesStore = defineStore('notes', () => {
  const notes = ref<Note[]>([]);
  const activeId = ref<string | null>(null);
  const loading = ref(false);
  const error = ref('');
  const activeNote = computed(() => notes.value.find(note => note.id === activeId.value) ?? null);
  const orderedNotes = computed(() => [...notes.value].sort((a, b) => b.updatedAt - a.updatedAt));

  async function load(directory: string): Promise<void> {
    loading.value = true;
    error.value = '';
    try {
      notes.value = await loadStoredNotes(directory);
      activeId.value = notes.value.some(note => note.id === activeId.value) ? activeId.value : notes.value[0]?.id ?? null;
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : String(reason);
    } finally {
      loading.value = false;
    }
  }

  async function create(directory: string): Promise<boolean> {
    const note: Note = {
      id: createId(),
      name: '新便签',
      customName: false,
      content: '# 新便签\n\n',
      updatedAt: Date.now()
    };
    notes.value.unshift(note);
    activeId.value = note.id;
    return persist(directory, note);
  }

  function updateContent(content: string): Note | null {
    const note = activeNote.value;
    if (!note || note.content === content) return null;
    note.content = content;
    if (!note.customName) note.name = contentName(content);
    note.updatedAt = Date.now();
    return note;
  }

  function renameTitle(id: string, title: string): Note | null {
    const note = notes.value.find(item => item.id === id);
    const normalized = title.trim().replace(/\s+/gu, ' ').slice(0, 60);
    if (!note || !normalized) return null;
    note.name = normalized;
    note.customName = true;
    note.updatedAt = Date.now();
    return note;
  }

  async function persist(directory: string, note: Note): Promise<boolean> {
    error.value = '';
    try {
      await saveStoredNote(directory, note);
      return true;
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : String(reason);
      return false;
    }
  }

  async function remove(directory: string, id: string): Promise<boolean> {
    error.value = '';
    try {
      await deleteStoredNote(directory, id);
      const index = notes.value.findIndex(note => note.id === id);
      if (index >= 0) notes.value.splice(index, 1);
      if (activeId.value === id) activeId.value = notes.value[Math.min(index, notes.value.length - 1)]?.id ?? null;
      return true;
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : String(reason);
      return false;
    }
  }

  function applyExternalSave(note: Note): void {
    const existing = notes.value.find(item => item.id === note.id);
    if (existing) Object.assign(existing, note);
    else notes.value.push({ ...note });
    activeId.value ??= note.id;
  }

  function applyExternalDelete(id: string): void {
    const index = notes.value.findIndex(note => note.id === id);
    if (index < 0) return;
    notes.value.splice(index, 1);
    if (activeId.value === id) activeId.value = notes.value[Math.min(index, notes.value.length - 1)]?.id ?? null;
  }

  return { notes, activeId, activeNote, orderedNotes, loading, error, noteTitle, load, create, updateContent, renameTitle, persist, remove, applyExternalSave, applyExternalDelete };
});
