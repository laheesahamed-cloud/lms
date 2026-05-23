import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const tsNodeBin = process.platform === 'win32'
  ? join(root, 'backend', 'node_modules', '.bin', 'ts-node.cmd')
  : join(root, 'backend', 'node_modules', '.bin', 'ts-node');

if (!existsSync(tsNodeBin)) {
  console.error('Missing backend ts-node dependency; run npm install --prefix backend before SQL injection regression tests.');
  process.exit(1);
}

const result = spawnSync(tsNodeBin, [
  '--project',
  join(root, 'backend', 'tsconfig.json'),
  join(root, 'backend', 'test', 'sql-injection-regression.ts'),
], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
