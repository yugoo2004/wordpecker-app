import { Router } from 'express';
import { run } from '@openai/agents';
import { languageValidationAgent } from '../../agents';
import { LanguageValidationResultType } from '../../agents/language-validation-agent/schemas';

const router = Router();

// 本地语言识别降级函数
function validateLanguageLocally(language: string): LanguageValidationResultType {
  const normalizedInput = language.toLowerCase().trim();
  
  // 中文识别规则
  const chinesePatterns = [
    /^(中文|chinese|mandarin|中国话|国语|普通话)$/i,
    /^(简体中文|simplified chinese|简体)$/i,
    /^(繁体中文|traditional chinese|繁体)$/i,
    /^(mandarin chinese)$/i
  ];
  
  // 检查是否是中文相关输入
  for (const pattern of chinesePatterns) {
    if (pattern.test(normalizedInput)) {
      const parameters = [];
      
      // 检测简体中文
      if (/简体|simplified/i.test(normalizedInput)) {
        parameters.push({
          type: 'learning_focus' as const,
          value: 'simplified',
          description: 'Simplified Chinese characters'
        });
      }
      
      // 检测繁体中文
      if (/繁体|traditional/i.test(normalizedInput)) {
        parameters.push({
          type: 'learning_focus' as const,
          value: 'traditional',
          description: 'Traditional Chinese characters'
        });
      }
      
      return {
        isValid: true,
        languageCode: 'zh',
        standardizedName: 'Chinese',
        parameters: parameters.length > 0 ? parameters : null,
        explanation: null
      };
    }
  }
  
  // 其他常见语言的本地识别
  const commonLanguages: Record<string, { code: string; name: string; patterns: RegExp[] }> = {
    english: {
      code: 'en',
      name: 'English', 
      patterns: [/^(english|英语|英文)$/i]
    },
    japanese: {
      code: 'ja',
      name: 'Japanese',
      patterns: [/^(japanese|日语|日文|にほんご|nihongo)$/i]
    },
    korean: {
      code: 'ko', 
      name: 'Korean',
      patterns: [/^(korean|韩语|한국어|hangugeo)$/i]
    },
    spanish: {
      code: 'es',
      name: 'Spanish',
      patterns: [/^(spanish|西班牙语|español)$/i]
    },
    french: {
      code: 'fr',
      name: 'French', 
      patterns: [/^(french|法语|français)$/i]
    },
    german: {
      code: 'de',
      name: 'German',
      patterns: [/^(german|德语|deutsch)$/i]
    },
    russian: {
      code: 'ru',
      name: 'Russian',
      patterns: [/^(russian|俄语|русский)$/i]
    },
    arabic: {
      code: 'ar',
      name: 'Arabic',
      patterns: [/^(arabic|阿拉伯语|العربية)$/i]
    },
    hindi: {
      code: 'hi',
      name: 'Hindi',
      patterns: [/^(hindi|印地语|हिन्दी)$/i]
    }
  };
  
  // 检查其他常见语言
  for (const [, langInfo] of Object.entries(commonLanguages)) {
    for (const pattern of langInfo.patterns) {
      if (pattern.test(normalizedInput)) {
        return {
          isValid: true,
          languageCode: langInfo.code,
          standardizedName: langInfo.name,
          parameters: null,
          explanation: null
        };
      }
    }
  }
  
  // 如果都不匹配，返回无效
  return {
    isValid: false,
    languageCode: null,
    standardizedName: null,
    parameters: null,
    explanation: `"${language}" is not recognized as a valid language. Please try using standard language names like "Chinese", "English", "简体中文", etc.`
  };
}

router.post('/validate', async (req, res) => {
  try {
    const { language } = req.body;

    if (!language || typeof language !== 'string') {
      return res.status(400).json({ 
        error: 'Language name is required and must be a string' 
      });
    }

    try {
      // 首先尝试使用AI服务
      const result = await run(languageValidationAgent as any, language.trim());
      const validationResult = result.finalOutput as LanguageValidationResultType;
      res.json(validationResult);
    } catch (aiError) {
      // AI服务失败时，使用本地降级逻辑
      console.warn('AI language validation failed, using local fallback:', aiError);
      const localResult = validateLanguageLocally(language.trim());
      res.json(localResult);
    }
  } catch (error) {
    console.error('Error validating language:', error);
    res.status(500).json({ 
      error: 'Failed to validate language' 
    });
  }
});

export default router;