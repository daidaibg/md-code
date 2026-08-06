import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageMetadata = JSON.parse(readFileSync(join(rootDirectory, 'package.json'), 'utf8'));
const version = String(packageMetadata.version ?? '').trim();
const tag = `v${version}`;
const repository = 'daidaibg/md-code';
const bundleDirectory = join(rootDirectory, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const installerPath = join(bundleDirectory, `MDCode_${version}_x64-setup.exe`);
const manifestPath = join(bundleDirectory, 'latest.json');
const buildScript = join(rootDirectory, 'scripts', 'build-release.mjs');

const buildResult = spawnSync(process.execPath, [buildScript], {
  cwd: rootDirectory,
  stdio: 'inherit',
  windowsHide: true,
  env: process.env
});
if (buildResult.error) throw buildResult.error;
if (buildResult.status !== 0) process.exit(buildResult.status ?? 1);

if (!existsSync(installerPath) || !existsSync(manifestPath)) {
  throw new Error('构建完成后未找到安装包或 latest.json。');
}

const publishResult = spawnSync(
  'gh',
  [
    'release',
    'create',
    tag,
    installerPath,
    manifestPath,
    '--repo',
    repository,
    '--title',
    `MD Code ${tag}`,
    '--generate-notes',
    '--latest'
  ],
  { cwd: rootDirectory, stdio: 'inherit', windowsHide: true }
);

if (publishResult.error?.code === 'ENOENT') {
  throw new Error('未找到 GitHub CLI（gh）。请安装后先执行 gh auth login。');
}
if (publishResult.error) throw publishResult.error;
if (publishResult.status !== 0) process.exit(publishResult.status ?? 1);

console.log(`发布完成：https://github.com/${repository}/releases/tag/${tag}`);

