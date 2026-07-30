import { onBeforeUnmount, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isSupportedTextPath, isTauriRuntime } from '@/filesystem/fileSystemService';

const OPEN_FILES_EVENT = 'md-code://open-files';
const WINDOW_SIZE_STORAGE_KEY = 'md-code:window-size-v1';
const MIN_WINDOW_WIDTH = 900;
const MIN_WINDOW_HEIGHT = 600;
const MAX_WINDOW_WIDTH = 7680;
const MAX_WINDOW_HEIGHT = 4320;

interface PersistedWindowSize {
  width: number;
  height: number;
}

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
  let unlistenResize: (() => void) | undefined;
  let resizeSaveTimer = 0;
  let pendingWindowSize: PersistedWindowSize | undefined;
  let allowClose = false;
  let disposed = false;
  let openQueue = Promise.resolve();

  function normalizeWindowSize(value: unknown): PersistedWindowSize | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const width = Number((value as Partial<PersistedWindowSize>).width);
    const height = Number((value as Partial<PersistedWindowSize>).height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
    return {
      width: Math.round(Math.min(MAX_WINDOW_WIDTH, Math.max(MIN_WINDOW_WIDTH, width))),
      height: Math.round(Math.min(MAX_WINDOW_HEIGHT, Math.max(MIN_WINDOW_HEIGHT, height)))
    };
  }

  function readWindowSize(): PersistedWindowSize | undefined {
    try {
      return normalizeWindowSize(
        JSON.parse(window.localStorage.getItem(WINDOW_SIZE_STORAGE_KEY) ?? 'null')
      );
    } catch {
      return undefined;
    }
  }

  function saveWindowSize(size: PersistedWindowSize): void {
    try {
      window.localStorage.setItem(WINDOW_SIZE_STORAGE_KEY, JSON.stringify(size));
    } catch {
      // Window sizing is a convenience; storage failures must not affect the editor.
    }
  }

  function flushWindowSize(): void {
    if (!pendingWindowSize) return;
    saveWindowSize(pendingWindowSize);
    pendingWindowSize = undefined;
  }

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
      const [{ LogicalSize }, { getCurrentWindow }] = await Promise.all([
        import('@tauri-apps/api/dpi'),
        import('@tauri-apps/api/window')
      ]);
      if (disposed) return;

      const appWindow = getCurrentWindow();
      const savedWindowSize = readWindowSize();
      if (savedWindowSize) {
        try {
          await appWindow.setSize(new LogicalSize(savedWindowSize.width, savedWindowSize.height));
        } catch {
          // Keep the size declared in tauri.conf.json when a saved size cannot be restored.
        }
      }

      unlistenResize = await appWindow.onResized((event) => {
        window.clearTimeout(resizeSaveTimer);
        resizeSaveTimer = window.setTimeout(() => {
          void (async () => {
            try {
              if (await appWindow.isMaximized()) return;
              const scaleFactor = await appWindow.scaleFactor();
              pendingWindowSize = normalizeWindowSize({
                width: event.payload.width / scaleFactor,
                height: event.payload.height / scaleFactor
              });
              flushWindowSize();
            } catch {
              // Ignore transient window API failures while the app is closing.
            }
          })();
        }, 240);
      });
      unlistenOpenFiles = await listen<string[]>(OPEN_FILES_EVENT, (event) => {
        enqueuePaths(event.payload);
      });
      unlistenClose = await appWindow.onCloseRequested(async (event) => {
        if (allowClose) return;
        event.preventDefault();
        if (options.isCloseConfirmationPending()) {
          return;
        }

        const exitApplication = async (): Promise<void> => {
          allowClose = true;
          try {
            await invoke('exit_application');
          } catch {
            allowClose = false;
          }
        };

        if (!options.hasModifiedDocuments()) {
          await exitApplication();
          return;
        }

        options.requestCloseAll(exitApplication);
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
    unlistenResize?.();
    window.clearTimeout(resizeSaveTimer);
    flushWindowSize();
  });
}
