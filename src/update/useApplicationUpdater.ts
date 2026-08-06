import { computed, ref } from 'vue';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { isTauriRuntime } from '@/filesystem/fileSystemService';

export type ApplicationUpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'installing';

export function useApplicationUpdater() {
  const status = ref<ApplicationUpdateStatus>('idle');
  const version = ref('');
  const downloadedBytes = ref(0);
  const contentLength = ref<number>();
  let pendingUpdate: Update | null = null;

  const progress = computed(() => {
    if (!contentLength.value) return undefined;
    return Math.min(100, Math.round((downloadedBytes.value / contentLength.value) * 100));
  });

  async function resetSilently(): Promise<void> {
    const update = pendingUpdate;
    pendingUpdate = null;
    status.value = 'idle';
    version.value = '';
    downloadedBytes.value = 0;
    contentLength.value = undefined;
    if (update) {
      try {
        await update.close();
      } catch {
        // Update checks are intentionally silent.
      }
    }
  }

  async function checkAndDownload(): Promise<void> {
    if (!isTauriRuntime() || status.value !== 'idle') return;
    status.value = 'checking';

    try {
      const update = await check({ timeout: 15_000 });
      if (!update) {
        status.value = 'idle';
        return;
      }

      pendingUpdate = update;
      version.value = update.version;
      status.value = 'downloading';

      await update.download(
        (event) => {
          if (event.event === 'Started') {
            downloadedBytes.value = 0;
            contentLength.value = event.data.contentLength;
          } else if (event.event === 'Progress') {
            downloadedBytes.value += event.data.chunkLength;
          } else {
            if (contentLength.value) downloadedBytes.value = contentLength.value;
          }
        },
        { timeout: 30 * 60_000 }
      );

      status.value = 'ready';
    } catch {
      await resetSilently();
    }
  }

  async function installAndRestart(): Promise<void> {
    if (!pendingUpdate || status.value !== 'ready') return;
    status.value = 'installing';
    try {
      await pendingUpdate.install();
      await relaunch();
    } catch {
      // Keep the downloaded update available so the user can retry.
      status.value = 'ready';
    }
  }

  return {
    status,
    version,
    progress,
    checkAndDownload,
    installAndRestart
  };
}
