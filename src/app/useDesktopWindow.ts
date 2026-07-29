import { onBeforeUnmount, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isSupportedTextPath, isTauriRuntime } from '@/filesystem/fileSystemService';

const OPEN_FILES_EVENT = 'md-code://open-files';

interface DesktopWindowOptions {
  hasModifiedDocuments: () => boolean;
  isCloseConfirmationPending: () => boolean;
  requestCloseAll: (completion: () => void | Promise<void>) => boolean;
  openPath: (path: string) => Promise<void>;
}

export function useDesktopWindow(options: DesktopWindowOptions): void {
  let unlistenClose: (() => void) | undefined;
  let unlistenDrop: (() => void) | undefined;
  let unlistenOpenFiles: (() => void) | undefined;
  let allowClose = false;
  let disposed = false;
  let openQueue = Promise.resolve();

  function enqueuePaths(paths: string[]): void {
    const supportedPaths = [...new Set(paths.filter(isSupportedTextPath))];
    openQueue = openQueue.then(async () => {
      for (const path of supportedPaths) {
        if (disposed) return;
        await options.openPath(path);
      }
    });
  }

  onMounted(() => {
    if (!isTauriRuntime()) return;

    void (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      if (disposed) return;

      const appWindow = getCurrentWindow();
      unlistenOpenFiles = await listen<string[]>(OPEN_FILES_EVENT, (event) => {
        enqueuePaths(event.payload);
      });
      unlistenClose = await appWindow.onCloseRequested((event) => {
        if (allowClose) return;
        if (options.isCloseConfirmationPending()) {
          event.preventDefault();
          return;
        }
        if (!options.hasModifiedDocuments()) return;

        event.preventDefault();
        options.requestCloseAll(async () => {
          allowClose = true;
          await appWindow.destroy();
        });
      });

      unlistenDrop = await appWindow.onDragDropEvent((event) => {
        if (event.payload.type !== 'drop') return;
        enqueuePaths(event.payload.paths);
      });

      enqueuePaths(await invoke<string[]>('initial_open_paths'));
    })();
  });

  onBeforeUnmount(() => {
    disposed = true;
    unlistenClose?.();
    unlistenDrop?.();
    unlistenOpenFiles?.();
  });
}
