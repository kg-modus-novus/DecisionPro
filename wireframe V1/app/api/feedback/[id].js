/**
 * Vercel serverless: GET/PATCH /api/feedback/:id
 */
import { handleFeedbackRequest } from '../../server/feedbackApi.js';

export default async function handler(req, res) {
  const id = req.query?.id;
  req.url = id ? `/api/feedback/${encodeURIComponent(id)}` : '/api/feedback';
  await handleFeedbackRequest(req, res, process.env);
}
