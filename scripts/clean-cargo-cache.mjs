import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [resolve(rootDir, 'src-tauri', 'target')];

for (const target of targets) {
  rmSync(target, { recursive: true, force: true });
  console.log(`已清理：${target}`);
}
