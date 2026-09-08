import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from '@/filesystem/fileSystemService';

export interface StoredNote {
  id: string;
  name: string;
  customName: boolean;
  content: string;
  updatedAt: number;
}

export interface NotesChange {
  sourceId: string;
  directory: string;
  type: 'save' | 'delete';
  note?: StoredNote;
  id: string;
}

export const NOTES_CHANGED_EVENT = 'md-code://notes-changed';

const browserNotes = new Map<string, StoredNote>();

function customDirectory(value: string): string | null {
  return value.trim() || null;
}

export async function resolveNotesDirectory(directory: string): Promise<string> {
  if (!isTauriRuntime()) return '浏览器预览模式（不写入磁盘）';
  return invoke<string>('resolve_notes_directory', { customDirectory: customDirectory(directory) });
}

export async function loadStoredNotes(directory: string): Promise<StoredNote[]> {
  if (!isTauriRuntime()) return [...browserNotes.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  return invoke<StoredNote[]>('load_notes', { customDirectory: customDirectory(directory) });
}

export async function saveStoredNote(directory: string, note: StoredNote): Promise<void> {
  if (!isTauriRuntime()) {
    browserNotes.set(note.id, { ...note });
    return;
  }
  await invoke('save_note', {
    customDirectory: customDirectory(directory),
    id: note.id,
    name: note.name,
    customName: note.customName,
    content: note.content
  });
}

export async function deleteStoredNote(directory: string, id: string): Promise<void> {
  if (!isTauriRuntime()) {
    browserNotes.delete(id);
    return;
  }
  await invoke('delete_note', { customDirectory: customDirectory(directory), id });
}

export async function openDetachedNotesWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('open_notes_window');
}

export async function openSettingsInMainWindow(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke('open_main_settings');
}

export async function broadcastNotesChange(change: NotesChange): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { emit } = await import('@tauri-apps/api/event');
    await emit(NOTES_CHANGED_EVENT, change);
  } catch {
    // Cross-window refresh is auxiliary; a saved note must not look failed if broadcasting fails.
  }
}
