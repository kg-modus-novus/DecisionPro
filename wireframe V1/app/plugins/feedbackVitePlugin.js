import { loadEnv } from 'vite';
import { handleFeedbackRequest, matchesFeedbackPath } from '../server/feedbackApi.js';

/**
 * Vite plugin: serves Feedback API on the same port as the wireframe (5040).
 */
export function feedbackApiPlugin() {
  return {
    name: 'decisionpro-feedback-api',
    configureServer(server) {
      const env = {
        ...process.env,
        ...loadEnv(server.config.mode, server.config.root, ''),
      };

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (!matchesFeedbackPath(path)) {
          next();
          return;
        }
        try {
          await handleFeedbackRequest(req, res, env);
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
        if (!matchesFeedbackPath(path)) {
          next();
          return;
        }
        try {
          await handleFeedbackRequest(req, res, env);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: String(err.message || err) }));
        }
      });
    },
  };
}
