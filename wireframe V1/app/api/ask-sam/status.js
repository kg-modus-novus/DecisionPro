/**
 * Vercel serverless: GET /api/ask-sam/status
 */
import { handleAskSamRequest } from '../../server/askSamApi.js';

export default async function handler(req, res) {
  req.url = '/api/ask-sam/status';
  await handleAskSamRequest(req, res, process.env);
}
