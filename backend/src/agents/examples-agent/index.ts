import { CustomAgent } from '../custom-agent';
import { ExamplesResult } from './schemas';
import * as fs from 'fs';
import * as path from 'path';

// Load prompt from markdown file
const promptPath = path.join(__dirname, 'prompt.md');
const promptContent = fs.readFileSync(promptPath, 'utf-8');

export const examplesAgent = new CustomAgent({
  name: 'Examples Agent',
  instructions: promptContent,
  outputType: ExamplesResult,
  modelSettings: {
    temperature: 0.7,
    maxTokens: 800,
    voiceEnabled: true // 默认启用语音输出
  },
  capabilities: {
    text: true,
    voice: true, // 支持语音输出例句
    image: false
  }
});