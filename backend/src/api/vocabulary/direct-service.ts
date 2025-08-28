import { createChatCompletion } from '../../config/ai-service';
import { logger } from '../../config/logger';
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
      const response = await createChatCompletion([
        {
          role: 'system',
          content: 'You are a vocabulary expert. Generate vocabulary words according to the user\'s requirements. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.8,
        max_tokens: 3000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from AI service');
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
      
      // 降级到本地词汇生成
      logger.warn('AI词汇生成失败，使用备用词汇模板', { error: error instanceof Error ? error.message : String(error) });
      return await this.generateFallbackWords(count, difficulty, context, baseLanguage, targetLanguage, excludeWords);
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
      const response = await createChatCompletion([
        {
          role: 'system',
          content: 'You are a vocabulary expert. Provide detailed word information according to the user\'s requirements. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from AI service');
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
      
      // 降级到基本词汇信息
      logger.warn('AI词汇详情获取失败，使用默认详情', { word, error: error instanceof Error ? error.message : String(error) });
      return {
        word,
        meaning: `A ${targetLanguage} word related to ${context}`,
        example: `Example sentence with ${word} in ${targetLanguage}.`,
        difficulty_level: 'intermediate',
        context
      };
    }
  }

  /**
   * 降级词汇生成（使用预设模板）
   */
  private async generateFallbackWords(
    count: number, 
    difficulty: string, 
    context: string, 
    baseLanguage: string, 
    targetLanguage: string, 
    excludeWords: string[]
  ): Promise<VocabularyWordType[]> {
    logger.info('AI服务不可用，使用本地词汇模板');
    
    // 根据上下文匹配预设词汇
    const fallbackWords = this.getFallbackVocabulary(context, targetLanguage, baseLanguage);
    
    // 过滤排除的词汇
    const filteredWords = fallbackWords.filter(word => 
      !excludeWords.some(excluded => excluded.toLowerCase() === word.word.toLowerCase())
    );
    
    // 根据难度过滤
    const difficultyFilteredWords = filteredWords.filter(word => 
      word.difficulty_level === difficulty
    );
    
    // 如果按难度过滤后不够，使用所有词汇
    const wordsToUse = difficultyFilteredWords.length >= count ? difficultyFilteredWords : filteredWords;
    
    // 返回指定数量的词汇
    return wordsToUse.slice(0, count).map(word => ({
      ...word,
      context,
      meaning: word.meaning || `Basic ${targetLanguage} word`,
      example: word.example || `Example sentence with ${word.word}.`
    }));
  }

  /**
   * 获取备用词汇库
   */
  private getFallbackVocabulary(context: string, targetLanguage: string, baseLanguage: string): VocabularyWordType[] {
    // 基本的备用词汇库，根据上下文匹配
    const vocabularyBank: Record<string, VocabularyWordType[]> = {
      technology: [
        { word: 'computer', meaning: '计算机', example: 'I use my computer for work.', difficulty_level: 'basic', context: 'technology' },
        { word: 'software', meaning: '软件', example: 'This software is very useful.', difficulty_level: 'intermediate', context: 'technology' },
        { word: 'algorithm', meaning: '算法', example: 'The algorithm processes data efficiently.', difficulty_level: 'advanced', context: 'technology' },
        { word: 'database', meaning: '数据库', example: 'We store information in the database.', difficulty_level: 'intermediate', context: 'technology' },
        { word: 'network', meaning: '网络', example: 'The network connection is stable.', difficulty_level: 'basic', context: 'technology' }
      ],
      business: [
        { word: 'meeting', meaning: '会议', example: 'We have a meeting at 3 PM.', difficulty_level: 'basic', context: 'business' },
        { word: 'strategy', meaning: '策略', example: 'Our business strategy is working well.', difficulty_level: 'intermediate', context: 'business' },
        { word: 'revenue', meaning: '收入', example: 'The company\'s revenue increased this year.', difficulty_level: 'advanced', context: 'business' },
        { word: 'customer', meaning: '客户', example: 'Customer satisfaction is important.', difficulty_level: 'basic', context: 'business' },
        { word: 'investment', meaning: '投资', example: 'They made a smart investment.', difficulty_level: 'intermediate', context: 'business' }
      ],
      education: [
        { word: 'student', meaning: '学生', example: 'The student is studying hard.', difficulty_level: 'basic', context: 'education' },
        { word: 'curriculum', meaning: '课程', example: 'The curriculum includes many subjects.', difficulty_level: 'intermediate', context: 'education' },
        { word: 'scholarship', meaning: '奖学金', example: 'She received a scholarship for her studies.', difficulty_level: 'advanced', context: 'education' },
        { word: 'teacher', meaning: '教师', example: 'The teacher explains the lesson clearly.', difficulty_level: 'basic', context: 'education' },
        { word: 'research', meaning: '研究', example: 'Academic research requires patience.', difficulty_level: 'intermediate', context: 'education' }
      ]
    };
    
    // 尝试匹配上下文
    const contextLower = context.toLowerCase();
    for (const [key, words] of Object.entries(vocabularyBank)) {
      if (contextLower.includes(key) || key.includes(contextLower)) {
        return words;
      }
    }
    
    // 如果没有匹配，返回通用词汇
    return [
      { word: 'important', meaning: '重要的', example: 'This is an important topic.', difficulty_level: 'basic', context: 'general' },
      { word: 'understand', meaning: '理解', example: 'I understand the concept.', difficulty_level: 'basic', context: 'general' },
      { word: 'experience', meaning: '经验', example: 'She has valuable experience.', difficulty_level: 'intermediate', context: 'general' },
      { word: 'development', meaning: '发展', example: 'Development takes time and effort.', difficulty_level: 'intermediate', context: 'general' },
      { word: 'opportunity', meaning: '机会', example: 'This is a great opportunity.', difficulty_level: 'advanced', context: 'general' }
    ];
  }
}

export const directVocabularyService = new DirectVocabularyService();