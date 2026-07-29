import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const rootDir = resolve(import.meta.dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(args, cwd) {
  const result = spawnSync(npmCommand, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('[1/3] 构建 MD Code 主程序（不生成 NSIS/MSI）');
run(['run', 'tauri', '--', 'build', '--no-bundle'], rootDir);

console.log('[2/3] 构建自定义中文安装器（单个 EXE）');
run(['--prefix', 'installer', 'run', 'tauri', '--', 'build', '--no-bundle'], rootDir);

const source = resolve(
  rootDir,
  'installer',
  'src-tauri',
  'target',
  'release',
  'md-code-installer.exe'
);
if (!existsSync(source)) {
  throw new Error(`安装器构建完成但未找到输出文件：${source}`);
}

const releaseDir = resolve(rootDir, 'release');
const destination = resolve(releaseDir, 'MD Code_0.2.0_x64-setup.exe');
mkdirSync(releaseDir, { recursive: true });
copyFileSync(source, destination);

console.log(`[3/3] 已生成：${destination}`);
