/**
 * Vercel serverless: /api/feedback and /api/feedback/:id
 */
import { handleFeedbackRequest } from '../server/feedbackApi.js';

export default async function handler(req, res) {
  const url = new URL(req.url || '/api/feedback', 'http://localhost');
  // Preserve path + query for the shared handler.
  req.url = `${url.pathname}${url.search}`;
  await handleFeedbackRequest(req, res, process.env);
}
