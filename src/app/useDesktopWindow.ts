import { onBeforeUnmount, onMounted, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { isSupportedTextPath, isTauriRuntime } from '@/filesystem/fileSystemService';

const OPEN_FILES_EVENT = 'md-code://open-files';
const WINDOW_STATE_STORAGE_KEY = 'md-code:window-state-v2';
const LEGACY_WINDOW_SIZE_STORAGE_KEY = 'md-code:window-size-v1';
const MIN_WINDOW_WIDTH = 900;
const MIN_WINDOW_HEIGHT = 600;
const MAX_WINDOW_WIDTH = 7680;
const MAX_WINDOW_HEIGHT = 4320;

interface PersistedWindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

interface DesktopWindowOptions {
  shouldPersistWindowState: () => boolean;
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
  let unlistenMove: (() => void) | undefined;
  let stopPersistSettingWatch: (() => void) | undefined;
  let resizeSaveTimer = 0;
  let moveSaveTimer = 0;
  let savedWindowState: PersistedWindowState | undefined;
  let pendingWindowState: Partial<PersistedWindowState> | undefined;
  let allowClose = false;
  let disposed = false;
  let openQueue = Promise.resolve();

  function normalizeWindowState(value: unknown): PersistedWindowState | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const state = value as Partial<PersistedWindowState>;
    const width = Number(state.width);
    const height = Number(state.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
    const x = Number(state.x);
    const y = Number(state.y);
    return {
      width: Math.round(Math.min(MAX_WINDOW_WIDTH, Math.max(MIN_WINDOW_WIDTH, width))),
      height: Math.round(Math.min(MAX_WINDOW_HEIGHT, Math.max(MIN_WINDOW_HEIGHT, height))),
      x: Number.isFinite(x) ? Math.round(x) : undefined,
      y: Number.isFinite(y) ? Math.round(y) : undefined
    };
  }

  function readWindowState(): PersistedWindowState | undefined {
    try {
      const current = window.localStorage.getItem(WINDOW_STATE_STORAGE_KEY);
      return normalizeWindowState(
        JSON.parse(
          current ?? window.localStorage.getItem(LEGACY_WINDOW_SIZE_STORAGE_KEY) ?? 'null'
        )
      );
    } catch {
      return undefined;
    }
  }

  function saveWindowState(state: PersistedWindowState): void {
    try {
      window.localStorage.setItem(WINDOW_STATE_STORAGE_KEY, JSON.stringify(state));
      window.localStorage.removeItem(LEGACY_WINDOW_SIZE_STORAGE_KEY);
    } catch {
      // Window placement is a convenience; storage failures must not affect the editor.
    }
  }

  function clearSavedWindowState(): void {
    pendingWindowState = undefined;
    savedWindowState = undefined;
    try {
      window.localStorage.removeItem(WINDOW_STATE_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_WINDOW_SIZE_STORAGE_KEY);
    } catch {
      // Ignore unavailable storage while changing a convenience setting.
    }
  }

  function flushWindowState(): void {
    if (!pendingWindowState || !options.shouldPersistWindowState()) return;
    const normalized = normalizeWindowState({
      ...savedWindowState,
      ...pendingWindowState
    });
    if (!normalized) return;
    pendingWindowState = undefined;
    savedWindowState = normalized;
    saveWindowState(normalized);
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
      const [
        { LogicalSize, PhysicalPosition },
        { availableMonitors, getCurrentWindow }
      ] = await Promise.all([
        import('@tauri-apps/api/dpi'),
        import('@tauri-apps/api/window')
      ]);
      if (disposed) return;

      const appWindow = getCurrentWindow();
      savedWindowState = options.shouldPersistWindowState() ? readWindowState() : undefined;
      if (savedWindowState) {
        try {
          await appWindow.setSize(
            new LogicalSize(savedWindowState.width, savedWindowState.height)
          );
          const restoredX = savedWindowState.x;
          const restoredY = savedWindowState.y;
          if (restoredX !== undefined && restoredY !== undefined) {
            const monitors = await availableMonitors();
            const visible = monitors.some((monitor) => {
              const left = monitor.position.x;
              const top = monitor.position.y;
              const right = left + monitor.size.width;
              const bottom = top + monitor.size.height;
              return (
                restoredX < right - 80 &&
                restoredX + 80 > left &&
                restoredY < bottom - 40 &&
                restoredY + 40 > top
              );
            });
            if (visible) {
              await appWindow.setPosition(
                new PhysicalPosition(restoredX, restoredY)
              );
            }
          }
        } catch {
          // Keep the position and size declared in tauri.conf.json if restoration fails.
        }
      }
      if (!savedWindowState && options.shouldPersistWindowState()) {
        try {
          const [size, position, scaleFactor] = await Promise.all([
            appWindow.outerSize(),
            appWindow.outerPosition(),
            appWindow.scaleFactor()
          ]);
          savedWindowState = normalizeWindowState({
            width: size.width / scaleFactor,
            height: size.height / scaleFactor,
            x: position.x,
            y: position.y
          });
        } catch {
          // The first successful move or resize event can establish the initial state instead.
        }
      }

      unlistenResize = await appWindow.onResized((event) => {
        window.clearTimeout(resizeSaveTimer);
        resizeSaveTimer = window.setTimeout(() => {
          void (async () => {
            try {
              if (!options.shouldPersistWindowState() || (await appWindow.isMaximized())) return;
              const scaleFactor = await appWindow.scaleFactor();
              pendingWindowState = {
                ...pendingWindowState,
                width: event.payload.width / scaleFactor,
                height: event.payload.height / scaleFactor
              };
              flushWindowState();
            } catch {
              // Ignore transient window API failures while the app is closing.
            }
          })();
        }, 240);
      });
      unlistenMove = await appWindow.onMoved((event) => {
        if (!options.shouldPersistWindowState()) return;
        window.clearTimeout(moveSaveTimer);
        moveSaveTimer = window.setTimeout(() => {
          void (async () => {
            try {
              if (await appWindow.isMaximized()) return;
              pendingWindowState = {
                ...pendingWindowState,
                x: event.payload.x,
                y: event.payload.y
              };
              flushWindowState();
            } catch {
              // Ignore transient window API failures while the app is closing.
            }
          })();
        }, 240);
      });
      stopPersistSettingWatch = watch(options.shouldPersistWindowState, (enabled) => {
        if (!enabled) {
          window.clearTimeout(resizeSaveTimer);
          window.clearTimeout(moveSaveTimer);
          clearSavedWindowState();
          return;
        }
        void (async () => {
          try {
            if (await appWindow.isMaximized()) return;
            const [size, position, scaleFactor] = await Promise.all([
              appWindow.outerSize(),
              appWindow.outerPosition(),
              appWindow.scaleFactor()
            ]);
            pendingWindowState = {
              width: size.width / scaleFactor,
              height: size.height / scaleFactor,
              x: position.x,
              y: position.y
            };
            flushWindowState();
          } catch {
            // Ignore transient window API failures while changing the setting.
          }
        })();
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
    unlistenMove?.();
    stopPersistSettingWatch?.();
    window.clearTimeout(resizeSaveTimer);
    window.clearTimeout(moveSaveTimer);
    flushWindowState();
  });
}
