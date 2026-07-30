import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageMetadata = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8'));
const tauriCli = resolve(rootDir, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');

function resolveNpmInvocation(args) {
  const npmExecPath = process.env.npm_execpath;
  const bundledNpmCli = resolve(
    dirname(process.execPath),
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js'
  );
  const npmCli = npmExecPath && existsSync(npmExecPath)
    ? npmExecPath
    : existsSync(bundledNpmCli)
      ? bundledNpmCli
      : undefined;

  if (npmCli) {
    return {
      command: process.execPath,
      args: [npmCli, ...args],
      shell: false
    };
  }

  return {
    command: 'npm',
    args,
    shell: process.platform === 'win32'
  };
}

function run(args, cwd) {
  const invocation = resolveNpmInvocation(args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
    shell: invocation.shell
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runTauri(args, cwd) {
  if (!existsSync(tauriCli)) {
    throw new Error('未找到 Tauri CLI，请先在项目根目录执行 npm install');
  }
  const result = spawnSync(process.execPath, [tauriCli, ...args], {
    cwd,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('[1/5] 清理旧的 NSIS/MSI 输出，避免误用传统安装包');
rmSync(resolve(rootDir, 'src-tauri', 'target', 'release', 'bundle'), {
  recursive: true,
  force: true
});

console.log('[2/5] 构建 MD Code 主程序（不生成 NSIS/MSI）');
run(['run', 'tauri', '--', 'build', '--no-bundle'], rootDir);

console.log('[3/5] 构建自定义中文安装器（单个 EXE）');
runTauri(['build', '--no-bundle'], resolve(rootDir, 'installer'));

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
const destination = resolve(
  releaseDir,
  `MD Code_${packageMetadata.version}_x64-setup.exe`
);
rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });
copyFileSync(source, destination);

console.log(`[4/5] 已生成自定义安装器：${destination}`);

console.log('[5/5] 清理 Rust/Vite 打包中间文件');
for (const generatedPath of [
  resolve(rootDir, 'src-tauri', 'target', 'release'),
  resolve(rootDir, 'installer', 'src-tauri', 'target', 'release'),
  resolve(rootDir, 'dist')
]) {
  rmSync(generatedPath, { recursive: true, force: true });
}

console.log(`交付文件（仅此一个）：${destination}`);
