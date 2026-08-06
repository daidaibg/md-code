import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tauriDirectory = resolve(rootDirectory, 'src-tauri');
const debugDirectory = resolve(tauriDirectory, 'target', 'debug');
const previousDevelopmentData = resolve(debugDirectory, 'data');
const developmentData = resolve(tauriDirectory, '.dev-data');
const maximumDebugBytes = 6 * 1024 * 1024 * 1024;
const forceCleanup = process.argv.includes('--force');

function assertInside(parent, target) {
  const resolvedRelative = relative(parent, target);
  if (!resolvedRelative || resolvedRelative.startsWith('..') || resolve(parent, resolvedRelative) !== target) {
    throw new Error(`拒绝操作工作区外路径：${target}`);
  }
}

function directorySize(directory) {
  if (!existsSync(directory)) return 0;
  let total = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = resolve(directory, entry.name);
    try {
      if (entry.isDirectory()) total += directorySize(entryPath);
      else if (entry.isFile()) total += statSync(entryPath).size;
    } catch {
      // Cargo or WebView may briefly replace a file while the size is being calculated.
    }
  }
  return total;
}

function formatGigabytes(bytes) {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function migrateDevelopmentData() {
  if (!existsSync(previousDevelopmentData) || existsSync(developmentData)) return true;
  try {
    mkdirSync(dirname(developmentData), { recursive: true });
    renameSync(previousDevelopmentData, developmentData);
    console.log(`已迁移开发数据：${developmentData}`);
    return true;
  } catch (error) {
    console.warn(`无法迁移开发数据，已跳过自动清理：${error instanceof Error ? error.message : error}`);
    return false;
  }
}

assertInside(rootDirectory, tauriDirectory);
assertInside(tauriDirectory, debugDirectory);
assertInside(tauriDirectory, developmentData);

if (!migrateDevelopmentData()) process.exit(0);

const debugBytes = directorySize(debugDirectory);
if (!forceCleanup && debugBytes <= maximumDebugBytes) {
  console.log(`Cargo Debug 缓存 ${formatGigabytes(debugBytes)}，未超过 6 GB。`);
  process.exit(0);
}

console.log(
  forceCleanup
    ? `正在手动清理 Cargo Debug 缓存（${formatGigabytes(debugBytes)}）...`
    : `Cargo Debug 缓存已超过 6 GB（${formatGigabytes(debugBytes)}），正在自动清理...`
);
const cargoCommand = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
const result = spawnSync(
  cargoCommand,
  ['clean', '--profile', 'dev', '--manifest-path', resolve(tauriDirectory, 'Cargo.toml')],
  { cwd: rootDirectory, stdio: 'inherit', windowsHide: true }
);

if (result.error || result.status !== 0) {
  console.warn(`Cargo Debug 缓存清理失败，继续启动开发环境：${result.error?.message ?? `退出码 ${result.status}`}`);
  process.exit(0);
}

console.log('Cargo Debug 缓存清理完成；Release 打包缓存和开发数据均已保留。');
