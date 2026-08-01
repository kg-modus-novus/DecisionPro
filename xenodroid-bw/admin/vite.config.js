import path from 'node:path';
import os from 'node:os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const cacheDir = path.join(
  process.env.LOCALAPPDATA || os.tmpdir(),
  'decisionpro-xbw-admin-vite-cache',
);

export default defineConfig({
  plugins: [react()],
  cacheDir,
  server: { port: 5043, strictPort: true },
  preview: { port: 5043, strictPort: true },
});
