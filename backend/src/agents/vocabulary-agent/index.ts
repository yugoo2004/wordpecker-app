import { CustomAgent } from '../custom-agent';
import { VocabularyResult } from './schemas';
import * as fs from 'fs';
import * as path from 'path';

// Load prompt from markdown file
const promptPath = path.join(__dirname, 'prompt.md');
const promptContent = fs.readFileSync(promptPath, 'utf-8');

export const vocabularyAgent = new CustomAgent({
  name: 'Vocabulary Agent',
  instructions: promptContent,
  outputType: VocabularyResult,
  modelSettings: {
    temperature: 0.8,
    maxTokens: 3000
  }
});