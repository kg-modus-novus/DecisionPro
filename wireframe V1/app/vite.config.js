import path from 'node:path';
import os from 'node:os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { askSamApiPlugin } from './plugins/askSamVitePlugin.js';
import { feedbackApiPlugin } from './plugins/feedbackVitePlugin.js';

// Keep Vite dep cache off Dropbox — Dropbox file locks cause EBUSY and a blank app.
const cacheDir = path.join(
  process.env.LOCALAPPDATA || os.tmpdir(),
  'decisionpro-wireframe-vite-cache',
);

// Relative base keeps custom-domain demo.DecisionPro.io and github.io/DecisionPro working.
const pagesBase = process.env.GITHUB_PAGES === 'true' ? './' : '/';

const repoRoot = path.resolve(__dirname, '../..');

export default defineConfig({
  base: pagesBase,
  plugins: [react(), askSamApiPlugin(), feedbackApiPlugin()],
  cacheDir,
  server: {
    port: 5040,
    strictPort: true,
    fs: {
      // PSA preview imports curated REAL fixtures from xenodroid-bw.
      allow: [repoRoot],
    },
  },
  preview: {
    port: 5040,
    strictPort: true,
  },
  test: {
    environment: 'node',
  },
  publicDir: 'public',
});
