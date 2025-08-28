import { CustomAgent } from '../custom-agent';
import { DefinitionResult } from './schemas';
import * as fs from 'fs';
import * as path from 'path';

// Load prompt from markdown file
const promptPath = path.join(__dirname, 'prompt.md');
const promptContent = fs.readFileSync(promptPath, 'utf-8');

export const definitionAgent = new CustomAgent({
  name: 'Definition Agent',
  instructions: promptContent,
  outputType: DefinitionResult,
  modelSettings: {
    temperature: 0.5,
    maxTokens: 200
  },
  capabilities: {
    text: true,
    voice: true, // 支持语音输出定义
    image: false
  }
});