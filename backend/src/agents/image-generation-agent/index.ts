import { CustomAgent } from '../custom-agent';
import { generateAiImage } from './tools/generateAiImage';
import { ImageGenerationResult } from './schemas';
import * as fs from 'fs';
import * as path from 'path';

// Load prompt from markdown file
const promptPath = path.join(__dirname, 'prompt.md');
const promptContent = fs.readFileSync(promptPath, 'utf-8');

export const imageGenerationAgent = new CustomAgent({
  name: 'AI Image Generation Agent',
  instructions: promptContent,
  // tools: [generateAiImage], // 暂时注释，使用内置图像生成
  outputType: ImageGenerationResult,
  modelSettings: {
    temperature: 0.7,
    maxTokens: 1000,
    imageEnabled: true // 启用图像生成
  },
  capabilities: {
    text: true,
    voice: false,
    image: true // 支持图像生成
  }
});