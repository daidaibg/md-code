import { computed, ref } from 'vue';
import { acceptHMRUpdate, defineStore } from 'pinia';
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
  const listOrder = ref<string[]>([]);
  const pinnedIds = ref<string[]>([]);
  let listStorageKey = '';
  function isPinned(id: string): boolean { return pinnedIds.value.includes(id); }
  const orderedNotes = computed(() => [...notes.value].sort((a, b) => {
    const pinned = Number(isPinned(b.id)) - Number(isPinned(a.id));
    if (pinned) return pinned;
    const ai = listOrder.value.indexOf(a.id);
    const bi = listOrder.value.indexOf(b.id);
    if (ai < 0 && bi < 0) return b.updatedAt - a.updatedAt;
    if (ai < 0) return -1;
    if (bi < 0) return 1;
    return ai - bi;
  }));
  function reloadListPreferences(): void {
    try {
      const value = JSON.parse(localStorage.getItem(listStorageKey) ?? '{}');
      listOrder.value = Array.isArray(value.order) ? value.order.filter((id: unknown) => typeof id === 'string') : [];
      pinnedIds.value = Array.isArray(value.pinned) ? value.pinned.filter((id: unknown) => typeof id === 'string') : [];
    } catch { listOrder.value = []; pinnedIds.value = []; }
  }
  function saveListPreferences(order: string[], pinned: string[]): void {
    try {
      localStorage.setItem(listStorageKey, JSON.stringify({ order, pinned }));
      listOrder.value = order;
      pinnedIds.value = pinned;
    } catch (reason) { error.value = `保存便签顺序失败：${String(reason)}`; }
  }
  function togglePinned(id: string): void {
    const pinned = isPinned(id) ? pinnedIds.value.filter(item => item !== id) : [...pinnedIds.value, id];
    saveListPreferences([id, ...orderedNotes.value.map(note => note.id).filter(item => item !== id)], pinned);
  }
  function moveNote(id: string, targetId: string, after: boolean): void {
    if (id === targetId || isPinned(id) !== isPinned(targetId)) return;
    const order = orderedNotes.value.map(note => note.id).filter(item => item !== id);
    const index = order.indexOf(targetId);
    if (index < 0) return;
    order.splice(index + Number(after), 0, id);
    saveListPreferences(order, [...pinnedIds.value]);
  }

  async function load(directory: string): Promise<void> {
    listStorageKey = `md-code:note-list:${directory.trim()}`;
    reloadListPreferences();
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

  return { notes, activeId, activeNote, orderedNotes, listOrder, pinnedIds, loading, error, noteTitle, load, create, updateContent, renameTitle, persist, remove, applyExternalSave, applyExternalDelete, isPinned, togglePinned, moveNote, reloadListPreferences };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNotesStore, import.meta.hot));
}
