import { run } from '@openai/agents';
import { runCustomAgent } from '../../agents/custom-agent';
import { 
  definitionAgent, 
  validationAgent, 
  examplesAgent, 
  similarWordsAgent, 
  readingAgent 
} from '../../agents';
import { DefinitionResultType } from '../../agents/definition-agent/schemas';
import { ValidationResultType } from '../../agents/validation-agent/schemas';
import { ExamplesResultType, SentenceExampleType } from '../../agents/examples-agent/schemas';
import { SimilarWordsResultType } from '../../agents/similar-words-agent/schemas';
import { ReadingResultType } from '../../agents/reading-agent/schemas';

export class WordAgentService {
  async generateDefinition(word: string, context: string, baseLanguage: string, targetLanguage: string): Promise<string> {
    try {
      const prompt = `Generate a clear definition for the word "${word}" in the context of "${context}". The word is in ${targetLanguage} and the definition should be in ${baseLanguage}.`;
      const response = await definitionAgent.run(prompt);
      const result = response.finalOutput as DefinitionResultType;
      return result.definition;
    } catch (error) {
      console.warn('定义生成失败，使用默认定义', error);
      return `A ${targetLanguage} word related to ${context}`;
    }
  }

  async validateAnswer(userAnswer: string, correctAnswer: string, context: string, baseLanguage: string, targetLanguage: string): Promise<ValidationResultType> {
    const prompt = `Validate if the user's answer "${userAnswer}" is correct for the expected answer "${correctAnswer}". Context: ${context || 'General language exercise'}. User speaks ${baseLanguage} and is learning ${targetLanguage}.`;
    const result = await run(validationAgent, prompt);
    return result.finalOutput as ValidationResultType;
  }

  async generateExamples(word: string, meaning: string, context: string, baseLanguage: string, targetLanguage: string): Promise<SentenceExampleType[]> {
    try {
      const prompt = `Generate 3-5 sentence examples for the word "${word}" with meaning "${meaning}" in the context of "${context}". Examples should be in ${targetLanguage} with explanations in ${baseLanguage}.`;
      const response = await examplesAgent.run(prompt);
      const result = response.finalOutput as ExamplesResultType;
      return result.examples;
    } catch (error) {
      console.warn('例句生成失败，使用默认例句', error);
      return [
        {
          sentence: `This is an example sentence with ${word}.`,
          translation: `Basic example using the word ${word} in context.`,
          context_note: `Example showing ${word} in a typical ${context} context.`
        }
      ];
    }
  }

  async generateSimilarWords(word: string, meaning: string, context: string, baseLanguage: string, targetLanguage: string): Promise<SimilarWordsResultType> {
    try {
      const prompt = `Find similar words and synonyms for the word "${word}" with meaning "${meaning}" in the context of "${context}". Find words in ${targetLanguage} with definitions in ${baseLanguage}.`;
      const similarWords = await run(similarWordsAgent, prompt);
      return similarWords.finalOutput as SimilarWordsResultType;
    } catch (error) {
      console.warn('相似词生成失败，返回空结果', error);
      return {
        synonyms: [],
        interchangeable_words: []
      };
    }
  }

  async generateLightReading(words: Array<{value: string, meaning: string}>, context: string, baseLanguage: string, targetLanguage: string): Promise<ReadingResultType> {
    try {
      const prompt = `Create an intermediate-level reading passage in ${targetLanguage} that incorporates these vocabulary words: ${words.map(w => `${w.value} (${w.meaning})`).join(', ')}. Context: "${context}". The passage should be suitable for ${baseLanguage} speakers learning ${targetLanguage}.`;
      const reading = await run(readingAgent, prompt);
      return reading.finalOutput as ReadingResultType;
    } catch (error) {
      console.warn('轻松阅读生成失败，使用模板文本', error);
      const wordList = words.map(w => w.value).join(', ');
      return {
        title: `Reading about ${context}`,
        text: `This is a simple reading passage about ${context}. It includes the following vocabulary words: ${wordList}. These words are important for understanding the topic of ${context}. Practice using these words in your own sentences to improve your ${targetLanguage} skills.`,
        highlighted_words: words.map((w, index) => ({
          word: w.value,
          definition: w.meaning,
          position: index
        })),
        word_count: 50,
        difficulty_level: 'intermediate',
        theme: context
      };
    }
  }
}

export const wordAgentService = new WordAgentService();