import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageMetadata = JSON.parse(readFileSync(join(rootDirectory, 'package.json'), 'utf8'));
const version = String(packageMetadata.version ?? '').trim();
const repository = 'daidaibg/md-code';
const tag = `v${version}`;
const bundleDirectory = join(rootDirectory, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const privateKeyPath = join(rootDirectory, 'src-tauri', 'updater.key');
const tauriCliPath = join(rootDirectory, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const signingPrivateKey =
  process.env.TAURI_SIGNING_PRIVATE_KEY?.trim() ||
  (existsSync(privateKeyPath) ? readFileSync(privateKeyPath, 'utf8').trim() : '');

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json 中的版本不是有效 SemVer：${version || '(空)'}`);
}
if (!signingPrivateKey) {
  throw new Error(
    '缺少更新签名私钥。请恢复 src-tauri/updater.key，或设置 TAURI_SIGNING_PRIVATE_KEY。'
  );
}
if (!existsSync(tauriCliPath)) {
  throw new Error('未找到 Tauri CLI，请先执行 npm install。');
}

const buildResult = spawnSync(
  process.execPath,
  [tauriCliPath, 'build', '--config', JSON.stringify({ version })],
  {
    cwd: rootDirectory,
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      TAURI_SIGNING_PRIVATE_KEY: signingPrivateKey,
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD:
        process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? ''
    }
  }
);

if (buildResult.error) throw buildResult.error;
if (buildResult.status !== 0) process.exit(buildResult.status ?? 1);

mkdirSync(bundleDirectory, { recursive: true });
const updaterCandidates = readdirSync(bundleDirectory)
  .filter((name) => name.endsWith('-setup.exe') && existsSync(join(bundleDirectory, `${name}.sig`)))
  .map((name) => ({ name, modified: statSync(join(bundleDirectory, name)).mtimeMs }))
  .sort((left, right) => right.modified - left.modified);

if (!updaterCandidates.length) {
  throw new Error(`没有在 ${bundleDirectory} 找到已签名的 NSIS 安装包。`);
}

const sourceName = updaterCandidates[0].name;
const sourceInstaller = join(bundleDirectory, sourceName);
const sourceSignature = `${sourceInstaller}.sig`;
const releaseName = `MDCode_${version}_x64-setup.exe`;
const releaseInstaller = join(bundleDirectory, releaseName);
const releaseSignature = `${releaseInstaller}.sig`;

if (sourceInstaller !== releaseInstaller) copyFileSync(sourceInstaller, releaseInstaller);
if (sourceSignature !== releaseSignature) copyFileSync(sourceSignature, releaseSignature);

const manifest = {
  version,
  notes: `MD Code ${version}`,
  pub_date: new Date().toISOString(),
  url: `https://github.com/${repository}/releases/download/${tag}/${releaseName}`,
  signature: readFileSync(releaseSignature, 'utf8').trim()
};
const manifestPath = join(bundleDirectory, 'latest.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`安装包：${releaseInstaller}`);
console.log(`更新清单：${manifestPath}`);
