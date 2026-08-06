import { computed, ref } from 'vue';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { isTauriRuntime } from '@/filesystem/fileSystemService';

export type ApplicationUpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'up-to-date'
  | 'failed';

export function useApplicationUpdater() {
  const status = ref<ApplicationUpdateStatus>('idle');
  const version = ref('');
  const downloadedBytes = ref(0);
  const contentLength = ref<number>();
  const manualCheckVisible = ref(false);
  let pendingUpdate: Update | null = null;
  let feedbackTimer = 0;

  const progress = computed(() => {
    if (!contentLength.value) return undefined;
    return Math.min(100, Math.round((downloadedBytes.value / contentLength.value) * 100));
  });

  function clearFeedbackTimer(): void {
    window.clearTimeout(feedbackTimer);
    feedbackTimer = 0;
  }

  function showManualResult(result: 'up-to-date' | 'failed'): void {
    clearFeedbackTimer();
    manualCheckVisible.value = true;
    status.value = result;
    feedbackTimer = window.setTimeout(() => {
      if (status.value === result) status.value = 'idle';
      manualCheckVisible.value = false;
    }, 3_000);
  }

  async function clearPendingUpdate(): Promise<void> {
    const update = pendingUpdate;
    pendingUpdate = null;
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

  async function checkAndDownload(manual = false): Promise<void> {
    if (!isTauriRuntime()) return;
    if (!manual && !import.meta.env.PROD) return;
    if (status.value === 'checking') {
      if (manual) manualCheckVisible.value = true;
      return;
    }
    if (!['idle', 'up-to-date', 'failed'].includes(status.value)) return;

    clearFeedbackTimer();
    manualCheckVisible.value = manual;
    status.value = 'checking';

    try {
      const update = await check({ timeout: 15_000 });
      if (!update) {
        if (manualCheckVisible.value) showManualResult('up-to-date');
        else status.value = 'idle';
        return;
      }

      pendingUpdate = update;
      version.value = update.version;
      manualCheckVisible.value = false;
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
      await clearPendingUpdate();
      if (manualCheckVisible.value) showManualResult('failed');
      else status.value = 'idle';
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
    manualCheckVisible,
    checkAndDownload,
    installAndRestart
  };
}
