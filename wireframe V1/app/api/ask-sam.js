/**
 * Vercel serverless: POST /api/ask-sam
 * Keys from Vercel env only — never expose to the browser.
 */
import { handleAskSamRequest } from '../server/askSamApi.js';

export default async function handler(req, res) {
  req.url = '/api/ask-sam';
  await handleAskSamRequest(req, res, process.env);
}
