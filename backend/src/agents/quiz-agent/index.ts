import { CustomAgent } from '../custom-agent';
import { QuizResult } from './schemas';
import * as fs from 'fs';
import * as path from 'path';

// Load prompt from markdown file
const promptPath = path.join(__dirname, 'prompt.md');
const promptContent = fs.readFileSync(promptPath, 'utf-8');

export const quizAgent = new CustomAgent({
  name: 'Quiz Agent',
  instructions: promptContent,
  outputType: QuizResult,
  modelSettings: {
    temperature: 0.7,
    maxTokens: 2000
  },
  capabilities: {
    text: true,
    voice: false,
    image: false
  }
});