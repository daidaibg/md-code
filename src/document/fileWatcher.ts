import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isTauriRuntime } from '@/filesystem/fileSystemService';

const FILE_SYSTEM_CHANGED_EVENT = 'md-code://file-system-changed';
const CHANGE_DEBOUNCE_MS = 160;

export interface FileSystemChange {
  paths: string[];
  kind: string;
}

export interface FileWatcherController {
  sync: (openedFiles: string[], workspaceDirectory: string | null) => Promise<void>;
  dispose: () => void;
}

export async function createFileWatcher(
  onChange: (change: FileSystemChange) => void | Promise<void>
): Promise<FileWatcherController> {
  if (!isTauriRuntime()) {
    return {
      sync: async () => undefined,
      dispose: () => undefined
    };
  }

  const pendingChanges = new Map<string, string>();
  let timer = 0;
  let disposed = false;
  let syncQueue = Promise.resolve();

  function flush(): void {
    timer = 0;
    if (disposed || pendingChanges.size === 0) return;
    const entries = [...pendingChanges.entries()];
    pendingChanges.clear();
    void onChange({
      paths: entries.map(([path]) => path),
      kind: entries.map(([, kind]) => kind).join(', ')
    });
  }

  const unlisten: UnlistenFn = await listen<FileSystemChange>(
    FILE_SYSTEM_CHANGED_EVENT,
    (event) => {
      for (const path of event.payload.paths) {
        pendingChanges.set(path, event.payload.kind);
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, CHANGE_DEBOUNCE_MS);
    }
  );

  return {
    sync(openedFiles, workspaceDirectory) {
      syncQueue = syncQueue.catch(() => undefined).then(async () => {
        if (disposed) return;
        await invoke('sync_file_watcher', {
          openedFiles,
          workspaceDirectory
        });
      });
      return syncQueue;
    },
    dispose() {
      disposed = true;
      window.clearTimeout(timer);
      pendingChanges.clear();
      unlisten();
    }
  };
}
