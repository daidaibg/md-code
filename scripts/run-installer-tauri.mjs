import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installerDir = resolve(rootDir, 'installer');
const tauriCli = resolve(rootDir, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
const command = process.argv.slice(2);

if (!existsSync(tauriCli)) {
  throw new Error('未找到 Tauri CLI，请先在项目根目录执行 npm install');
}
if (command.length === 0) command.push('dev');

const result = spawnSync(process.execPath, [tauriCli, ...command], {
  cwd: installerDir,
  stdio: 'inherit',
  windowsHide: true
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
