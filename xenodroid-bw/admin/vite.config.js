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
  server: {
    port: 5043,
    strictPort: true,
    proxy: {
      // Feedback queue lives on the wireframe API (Ask Sam host / :5040).
      '/api/feedback': {
        target: 'http://127.0.0.1:5040',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:5044',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5043,
    strictPort: true,
    proxy: {
      '/api/feedback': {
        target: 'http://127.0.0.1:5040',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://127.0.0.1:5044',
        changeOrigin: true,
      },
    },
  },
});
