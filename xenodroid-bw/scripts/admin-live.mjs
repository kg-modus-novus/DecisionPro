import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bwRoot = path.resolve(here, '..');
const adminRoot = path.join(bwRoot, 'admin');

function run(cmd, args, cwd, name) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with ${code}`);
      process.exitCode = code;
    }
  });
  return child;
}

console.log('Starting XenoDroid BW admin API :5044 and Vite :5043 …');
const api = run('npx', ['tsx', 'src/cli.ts', 'admin-api'], bwRoot, 'admin-api');
const ui = run('npx', ['vite', '--port', '5043', '--strictPort'], adminRoot, 'admin-ui');

async function shutdown() {
  api.kill('SIGTERM');
  ui.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
