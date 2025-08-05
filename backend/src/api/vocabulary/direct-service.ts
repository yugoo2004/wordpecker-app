import { openai, DEFAULT_MODEL } from '../../config/openai';
import { VocabularyWordType } from '../../agents/vocabulary-agent/schemas';

export class DirectVocabularyService {
  async generateWords(count: number, difficulty: string, context: string, baseLanguage: string, targetLanguage: string, excludeWords: string[]): Promise<VocabularyWordType[]> {
    const excludeText = excludeWords.length > 0 ? `Exclude these words: ${excludeWords.join(', ')}.` : '';
    
    const prompt = `Generate ${count} ${difficulty}-level vocabulary words for the context "${context}". 
Generate words in ${targetLanguage} with definitions in ${baseLanguage}. ${excludeText}

Please respond with a JSON object in this exact format:
{
  "words": [
    {
      "word": "example",
      "meaning": "definition in ${baseLanguage}",
      "example": "example sentence in ${targetLanguage}",
      "difficulty_level": "${difficulty}",
      "context": "${context}"
    }
  ]
}

Make sure each word is relevant to the context and at the specified difficulty level.`;

    try {
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a vocabulary expert. Generate vocabulary words according to the user\'s requirements. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 3000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      // Try to parse JSON response
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse JSON from response');
        }
      }

      if (!result.words || !Array.isArray(result.words)) {
        throw new Error('Invalid response format: missing words array');
      }

      return result.words;
    } catch (error) {
      console.error('Error generating vocabulary words:', error);
      throw new Error(`Failed to generate vocabulary words: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getWordDetails(word: string, context: string, baseLanguage: string, targetLanguage: string): Promise<VocabularyWordType> {
    const prompt = `Provide detailed information about the word "${word}" in the context of "${context}". 
The word is in ${targetLanguage} and the definition should be in ${baseLanguage}. 
The example sentence must be in ${targetLanguage}.

Please respond with a JSON object in this exact format:
{
  "word": "${word}",
  "meaning": "detailed definition in ${baseLanguage}",
  "example": "example sentence in ${targetLanguage}",
  "difficulty_level": "beginner|intermediate|advanced",
  "context": "${context}"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a vocabulary expert. Provide detailed word information according to the user\'s requirements. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      // Try to parse JSON response
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        // If JSON parsing fails, try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse JSON from response');
        }
      }

      return result;
    } catch (error) {
      console.error('Error getting word details:', error);
      throw new Error(`Failed to get word details: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const directVocabularyService = new DirectVocabularyService();