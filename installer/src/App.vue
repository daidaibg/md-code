<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import ToolbarIcon from '@/components/icons/ToolbarIcon.vue';
import logoUrl from '../../src-tauri/icons/icon.png';
import {
  chooseInstallDir,
  closeInstaller,
  defaultInstallDir,
  installApplication,
  launchInstalledApplication,
  minimizeInstaller
} from './installerApi';

type InstallerState = 'ready' | 'installing' | 'complete' | 'error';

const state = ref<InstallerState>('ready');
const installDir = ref('D:\\app\\MD Code');
const createDesktopShortcut = ref(true);
const launchAfterInstall = ref(true);
const customOptionsOpen = ref(true);
const progress = ref(0);
const progressMessage = ref('正在准备安装…');
const errorMessage = ref('');
const installButtonLabel = computed(() => (state.value === 'error' ? '重新安装' : '立即安装'));
const canClose = computed(() => state.value !== 'installing');

onMounted(async () => {
  installDir.value = await defaultInstallDir();
});

async function selectInstallDirectory(): Promise<void> {
  const selected = await chooseInstallDir(installDir.value);
  if (selected) installDir.value = selected;
}

async function startInstall(): Promise<void> {
  if (!installDir.value.trim()) {
    errorMessage.value = '请选择安装位置';
    state.value = 'error';
    return;
  }

  state.value = 'installing';
  progress.value = 0;
  progressMessage.value = '正在准备安装…';
  errorMessage.value = '';

  try {
    await installApplication(
      {
        installDir: installDir.value.trim(),
        createDesktopShortcut: createDesktopShortcut.value
      },
      (event) => {
        progress.value = Math.max(progress.value, Math.min(100, event.percent));
        progressMessage.value = event.message;
      }
    );
    progress.value = 100;
    state.value = 'complete';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
    state.value = 'error';
  }
}

async function finishInstall(): Promise<void> {
  if (launchAfterInstall.value) await launchInstalledApplication();
  await closeInstaller();
}

function requestClose(): void {
  if (canClose.value) void closeInstaller();
}
</script>

<template>
  <main class="installer-window">
    <header class="window-header" data-tauri-drag-region>
      <div class="window-controls">
        <button
          type="button"
          class="window-control"
          aria-label="最小化"
          title="最小化"
          @click="minimizeInstaller"
        >
          <ToolbarIcon name="minimize" />
        </button>
        <button
          type="button"
          class="window-control close-control"
          :class="{ disabled: !canClose }"
          :aria-disabled="!canClose"
          aria-label="关闭"
          title="关闭"
          @click="requestClose"
        >
          <ToolbarIcon name="close" />
        </button>
      </div>
    </header>

    <section v-if="state === 'ready' || state === 'error'" class="installer-page ready-page">
      <div class="brand-block">
        <img :src="logoUrl" class="app-logo" alt="MD Code Logo" />
        <h1>MD Code</h1>
        <p>轻巧、专注的 Markdown 文档编辑器</p>
      </div>

      <button type="button" class="primary-button install-button" @click="startInstall">
        {{ installButtonLabel }}
      </button>

      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

      <div class="options-panel" :class="{ collapsed: !customOptionsOpen }">
        <div v-if="customOptionsOpen" class="option-content">
          <label class="path-label" for="install-path">安装位置</label>
          <div class="path-control">
            <input id="install-path" v-model="installDir" type="text" spellcheck="false" />
            <button
              type="button"
              class="folder-button"
              aria-label="选择安装目录"
              title="选择安装目录"
              @click="selectInstallDirectory"
            >
              <ToolbarIcon name="open" />
            </button>
          </div>
          <label class="checkbox-row">
            <input v-model="createDesktopShortcut" type="checkbox" />
            <span>创建桌面快捷方式</span>
          </label>
        </div>
        <button
          type="button"
          class="text-button"
          :aria-expanded="customOptionsOpen"
          @click="customOptionsOpen = !customOptionsOpen"
        >
          {{ customOptionsOpen ? '收起自定义选项' : '自定义选项' }}
        </button>
      </div>
    </section>

    <section v-else-if="state === 'installing'" class="installer-page progress-page">
      <div class="brand-block compact">
        <img :src="logoUrl" class="app-logo" alt="MD Code Logo" />
        <h1>MD Code</h1>
      </div>

      <div class="progress-content" aria-live="polite">
        <div
          class="progress-track"
          role="progressbar"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="`已安装 ${progress}%`"
        >
          <div class="progress-value" :style="{ width: `${progress}%` }" />
        </div>
        <strong>已安装 {{ progress }}%</strong>
        <span>{{ progressMessage }}</span>
      </div>
    </section>

    <section v-else class="installer-page complete-page">
      <div class="success-mark">
        <img :src="logoUrl" class="app-logo" alt="MD Code Logo" />
      </div>
      <h1>MD Code</h1>
      <h2>安装成功</h2>
      <p>现在可以开始使用你的 Markdown 编辑器了</p>

      <label class="checkbox-row launch-checkbox">
        <input v-model="launchAfterInstall" type="checkbox" />
        <span>立即启动应用</span>
      </label>

      <button type="button" class="primary-button finish-button" @click="finishInstall">
        立即体验
      </button>
    </section>
  </main>
</template>
