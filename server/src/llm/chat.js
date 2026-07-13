import Groq from 'groq-sdk';
import { env } from '../config/env.js';

/**
 * Generates an LLM completion using Groq.
 * 
 * @param {string} systemPrompt 
 * @param {string} userQuery 
 * @returns {Promise<string>} Generated text response
 */
export async function generateCompletion(systemPrompt, userQuery) {
  if (!env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is missing in server/.env');
  }

  const groq = new Groq({ apiKey: env.GROQ_API_KEY });
  const chatResult = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: String(userQuery) },
    ],
  });
  return chatResult.choices[0]?.message?.content ?? '';
}
