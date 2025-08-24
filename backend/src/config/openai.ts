import OpenAI from 'openai';
import { environment } from './environment';
import { createChatCompletion } from './ai-service';

if (!environment.openai.apiKey) {
  throw new Error('Missing OpenAI API key. Check OPENAI_API_KEY in .env');
}

export const DEFAULT_MODEL = environment.openai.model || 'gpt-4o-mini';

// 向后兼容的 OpenAI 客户端（使用 Moonshot）
export const openai = new OpenAI({
  apiKey: environment.openai.apiKey,
  baseURL: environment.openai.baseUrl,
});

// 推荐使用的冗余 AI 服务
export { createChatCompletion };

// 便捷的聊天完成函数，使用冗余机制
export async function createChatCompletionWithFallback(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {}
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  return createChatCompletion(messages, options);
}