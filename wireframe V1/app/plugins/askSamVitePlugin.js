import { loadEnv } from 'vite';
import { handleAskSamRequest, matchesAskSamPath } from '../server/askSamApi.js';

/**
 * Vite plugin: serves Ask Sam API on the same port as the wireframe (5020).
 */
export function askSamApiPlugin() {
  return {
    name: 'decisionpro-ask-sam-api',
    configureServer(server) {
      const env = {
        ...process.env,
        ...loadEnv(server.config.mode, server.config.root, ''),
      };

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (!matchesAskSamPath(path)) {
          next();
          return;
        }
        try {
          await handleAskSamRequest(req, res, env);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: String(err.message || err) }));
        }
      });
    },
    configurePreviewServer(server) {
      const env = {
        ...process.env,
        ...loadEnv('production', server.config.root, ''),
      };
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (!matchesAskSamPath(path)) {
          next();
          return;
        }
        try {
          await handleAskSamRequest(req, res, env);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: String(err.message || err) }));
        }
      });
    },
  };
}
