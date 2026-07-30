const tauri = window.__TAURI__;
const isTauriRuntime = Boolean(tauri?.core?.invoke);

const elements = {
  readyPage: document.querySelector('#ready-page'),
  progressPage: document.querySelector('#progress-page'),
  completePage: document.querySelector('#complete-page'),
  minimizeButton: document.querySelector('#minimize-button'),
  closeButton: document.querySelector('#close-button'),
  installButton: document.querySelector('#install-button'),
  finishButton: document.querySelector('#finish-button'),
  folderButton: document.querySelector('#folder-button'),
  optionsButton: document.querySelector('#options-button'),
  optionsPanel: document.querySelector('#options-panel'),
  optionContent: document.querySelector('#option-content'),
  installPath: document.querySelector('#install-path'),
  desktopShortcut: document.querySelector('#desktop-shortcut'),
  launchAfterInstall: document.querySelector('#launch-after-install'),
  errorMessage: document.querySelector('#error-message'),
  progressTrack: document.querySelector('#progress-track'),
  progressValue: document.querySelector('#progress-value'),
  progressPercent: document.querySelector('#progress-percent'),
  progressMessage: document.querySelector('#progress-message')
};

let installerState = 'ready';
let progress = 0;
let optionsOpen = true;

function setState(nextState) {
  installerState = nextState;
  elements.readyPage.hidden = nextState !== 'ready' && nextState !== 'error';
  elements.progressPage.hidden = nextState !== 'installing';
  elements.completePage.hidden = nextState !== 'complete';
  elements.installButton.textContent = nextState === 'error' ? '重新安装' : '立即安装';
  elements.closeButton.classList.toggle('disabled', nextState === 'installing');
  elements.closeButton.setAttribute('aria-disabled', String(nextState === 'installing'));
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = !message;
}

function updateProgress(nextProgress, message) {
  progress = Math.max(progress, Math.min(100, Number(nextProgress) || 0));
  elements.progressValue.style.width = `${progress}%`;
  elements.progressPercent.textContent = `已安装 ${progress}%`;
  elements.progressMessage.textContent = message;
  elements.progressTrack.setAttribute('aria-valuenow', String(progress));
  elements.progressTrack.setAttribute('aria-label', `已安装 ${progress}%`);
}

async function defaultInstallDir() {
  if (!isTauriRuntime) return 'D:\\app\\MD Code';
  return tauri.core.invoke('get_default_install_dir');
}

async function chooseInstallDir() {
  if (!isTauriRuntime) return;
  const selected = await tauri.core.invoke('choose_install_dir', {
    currentPath: elements.installPath.value
  });
  if (typeof selected === 'string') elements.installPath.value = selected;
}

async function runMockInstall(onProgress) {
  const steps = [
    [4, '正在准备安装…'],
    [11, '正在创建安装目录…'],
    [25, '正在复制应用文件…'],
    [43, '正在复制应用文件…'],
    [62, '正在复制应用文件…'],
    [78, '正在配置应用…'],
    [89, '正在创建快捷方式…'],
    [96, '正在写入卸载信息…'],
    [100, '安装完成']
  ];
  for (const [percent, message] of steps) {
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    onProgress({ percent, message });
  }
}

async function installApplication(options, onProgress) {
  if (!isTauriRuntime) return runMockInstall(onProgress);
  const unlisten = await tauri.event.listen('installer://progress', (event) => {
    onProgress(event.payload);
  });
  try {
    return await tauri.core.invoke('install_application', { options });
  } finally {
    unlisten();
  }
}

async function startInstall() {
  const installDir = elements.installPath.value.trim();
  if (!installDir) {
    showError('请选择安装位置');
    setState('error');
    return;
  }

  progress = 0;
  updateProgress(0, '正在准备安装…');
  showError('');
  setState('installing');

  try {
    await installApplication(
      {
        installDir,
        createDesktopShortcut: elements.desktopShortcut.checked
      },
      ({ percent, message }) => updateProgress(percent, message)
    );
    updateProgress(100, '安装完成');
    setState('complete');
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
    setState('error');
  }
}

async function closeInstaller() {
  if (!isTauriRuntime) return;
  await tauri.window.getCurrentWindow().close();
}

elements.minimizeButton.addEventListener('click', async () => {
  if (isTauriRuntime) await tauri.window.getCurrentWindow().minimize();
});
elements.closeButton.addEventListener('click', () => {
  if (installerState !== 'installing') void closeInstaller();
});
elements.folderButton.addEventListener('click', () => void chooseInstallDir());
elements.installButton.addEventListener('click', () => void startInstall());
elements.finishButton.addEventListener('click', async () => {
  if (elements.launchAfterInstall.checked && isTauriRuntime) {
    await tauri.core.invoke('launch_installed_application');
  }
  await closeInstaller();
});
elements.optionsButton.addEventListener('click', () => {
  optionsOpen = !optionsOpen;
  elements.optionContent.hidden = !optionsOpen;
  elements.optionsPanel.classList.toggle('collapsed', !optionsOpen);
  elements.optionsButton.textContent = optionsOpen ? '收起自定义选项' : '自定义选项';
  elements.optionsButton.setAttribute('aria-expanded', String(optionsOpen));
});

defaultInstallDir()
  .then((path) => {
    elements.installPath.value = path;
  })
  .catch((error) => {
    showError(error instanceof Error ? error.message : String(error));
    setState('error');
  });
