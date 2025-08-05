import OpenAI from 'openai';
import { environment } from './environment';

if (!environment.openai.apiKey) {
  throw new Error('Missing OpenAI API key. Check OPENAI_API_KEY in .env');
}

export const DEFAULT_MODEL = environment.openai.model || 'gpt-4o-mini';

export const openai = new OpenAI({
  apiKey: environment.openai.apiKey,
  baseURL: environment.openai.baseUrl,
});