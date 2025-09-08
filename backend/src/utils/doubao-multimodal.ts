import { logger } from '../config/logger';

/**
 * 豆包1.6多模态消息格式处理工具
 * 提供消息转换、验证和构建功能
 */

// 多模态消息内容接口
export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

// 多模态消息接口
export interface MultiModalMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent[];
}

// 传统文本消息接口
export interface TextMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 图像分析请求接口
export interface ImageAnalysisRequest {
  imageUrl: string;
  prompt?: string;
  targetLanguage?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  analysisType?: 'description' | 'vocabulary' | 'quiz' | 'learning';
  options?: {
    detail?: 'low' | 'high' | 'auto';
    temperature?: number;
    max_tokens?: number;
    wordCount?: number;
    includeExamples?: boolean;
    includePronunciation?: boolean;
  };
}

// 词汇生成结果接口
export interface VocabularyItem {
  word: string;
  definition: string;
  partOfSpeech: string;
  difficulty: string;
  examples?: string[];
  pronunciation?: string;
  context: string;
}

// 图像分析结果接口
export interface ImageAnalysisResult {
  description: string;
  vocabulary?: VocabularyItem[];
  confidence?: number;
  tags?: string[];
  scene?: string;
  objects?: string[];
}

/**
 * 豆包多模态消息构建器
 */
export class DoubaoMessageBuilder {
  /**
   * 构建文本消息
   */
  static buildTextMessage(role: 'system' | 'user' | 'assistant', text: string): MultiModalMessage {
    return {
      role,
      content: [{
        type: 'text',
        text
      }]
    };
  }

  /**
   * 构建图像分析消息
   */
  static buildImageAnalysisMessage(
    imageUrl: string,
    prompt: string,
    detail: 'low' | 'high' | 'auto' = 'auto'
  ): MultiModalMessage {
    return {
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: imageUrl,
            detail
          }
        },
        {
          type: 'text',
          text: prompt
        }
      ]
    };
  }

  /**
   * 构建词汇学习图像分析消息
   */
  static buildVocabularyAnalysisMessage(request: ImageAnalysisRequest): MultiModalMessage {
    const {
      imageUrl,
      targetLanguage = 'english',
      difficulty = 'intermediate',
      options = {}
    } = request;

    const wordCount = options.wordCount || 10;
    const includeExamples = options.includeExamples ?? true;
    const includePronunciation = options.includePronunciation ?? false;

    const prompt = `请分析这张图片，生成${wordCount}个与图片内容相关的${targetLanguage}词汇。

难度级别：${difficulty}

请以以下 JSON 格式返回：
{
  "description": "图片描述",
  "vocabulary": [
    {
      "word": "单词",
      "definition": "定义",
      "partOfSpeech": "词性",
      "difficulty": "${difficulty}",
      ${includeExamples ? '"examples": ["Example sentence 1", "Example sentence 2"],' : ''}
      ${includePronunciation ? '"pronunciation": "/pronunciation/",' : ''}
      "context": "在图片中的上下文"
    }
  ]
}`;

    return this.buildImageAnalysisMessage(imageUrl, prompt, options.detail);
  }

  /**
   * 构建测验题目生成消息
   */
  static buildQuizGenerationMessage(
    imageUrl: string,
    vocabulary: string[],
    questionCount: number = 5
  ): MultiModalMessage {
    const prompt = `基于这张图片和以下词汇，生成${questionCount}道英语学习测验题：

词汇列表：${vocabulary.join(', ')}

请以以下 JSON 格式返回：
{
  "questions": [
    {
      "type": "multiple_choice",
      "question": "题目内容",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "explanation": "解释",
      "vocabulary": "相关词汇"
    }
  ]
}`;

    return this.buildImageAnalysisMessage(imageUrl, prompt);
  }

  /**
   * 构建场景描述消息
   */
  static buildSceneDescriptionMessage(
    imageUrl: string,
    targetLanguage: string = 'english',
    style: 'simple' | 'detailed' | 'educational' = 'educational'
  ): MultiModalMessage {
    const prompts = {
      simple: `请用简单的${targetLanguage}描述这张图片的主要内容。`,
      detailed: `请详细描述这张图片，包括场景、对象、活动和氛围，使用${targetLanguage}。`,
      educational: `请用${targetLanguage}详细描述这张图片，重点关注教育价值，适合语言学习者理解。`
    };

    return this.buildImageAnalysisMessage(imageUrl, prompts[style]);
  }

  /**
   * 从传统消息转换为多模态消息
   */
  static convertTextMessagesToMultiModal(messages: TextMessage[]): MultiModalMessage[] {
    return messages.map(msg => this.buildTextMessage(msg.role, msg.content));
  }

  /**
   * 验证多模态消息格式
   */
  static validateMultiModalMessage(message: any): message is MultiModalMessage {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (!['system', 'user', 'assistant'].includes(message.role)) {
      return false;
    }

    if (!Array.isArray(message.content)) {
      return false;
    }

    return message.content.every((content: any) => {
      if (!content || typeof content !== 'object') {
        return false;
      }

      if (!['text', 'image_url'].includes(content.type)) {
        return false;
      }

      if (content.type === 'text') {
        return typeof content.text === 'string';
      }

      if (content.type === 'image_url') {
        return content.image_url && 
               typeof content.image_url.url === 'string' &&
               (!content.image_url.detail || ['low', 'high', 'auto'].includes(content.image_url.detail));
      }

      return false;
    });
  }

  /**
   * 验证图像URL格式
   */
  static validateImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * 提取消息中的图像URL
   */
  static extractImageUrls(messages: MultiModalMessage[]): string[] {
    const imageUrls: string[] = [];

    for (const message of messages) {
      for (const content of message.content) {
        if (content.type === 'image_url' && content.image_url?.url) {
          imageUrls.push(content.image_url.url);
        }
      }
    }

    return imageUrls;
  }

  /**
   * 提取消息中的文本内容
   */
  static extractTextContent(messages: MultiModalMessage[]): string {
    const textParts: string[] = [];

    for (const message of messages) {
      for (const content of message.content) {
        if (content.type === 'text' && content.text) {
          textParts.push(content.text);
        }
      }
    }

    return textParts.join(' ');
  }

  /**
   * 统计消息复杂度（用于预估token使用）
   */
  static calculateMessageComplexity(messages: MultiModalMessage[]): {
    textLength: number;
    imageCount: number;
    estimatedTokens: number;
  } {
    let textLength = 0;
    let imageCount = 0;

    for (const message of messages) {
      for (const content of message.content) {
        if (content.type === 'text' && content.text) {
          textLength += content.text.length;
        } else if (content.type === 'image_url') {
          imageCount++;
        }
      }
    }

    // 粗略估算token数量：文本按4个字符=1token，图像按1000tokens计算
    const estimatedTokens = Math.ceil(textLength / 4) + (imageCount * 1000);

    return {
      textLength,
      imageCount,
      estimatedTokens
    };
  }
}

/**
 * 豆包响应解析器
 */
export class DoubaoResponseParser {
  /**
   * 解析词汇分析响应
   */
  static parseVocabularyResponse(responseContent: string): ImageAnalysisResult | null {
    try {
      // 尝试提取JSON内容
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('响应中未找到JSON格式内容');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // 验证必需字段
      if (!parsed.description) {
        throw new Error('响应中缺少description字段');
      }

      return {
        description: parsed.description,
        vocabulary: parsed.vocabulary || [],
        confidence: parsed.confidence,
        tags: parsed.tags,
        scene: parsed.scene,
        objects: parsed.objects
      };

    } catch (error: any) {
      logger.error('词汇分析响应解析失败', {
        error: (error instanceof Error ? error.message : String(error)),
        responseContent: responseContent.substring(0, 200) + '...'
      });
      
      // 尝试基础解析
      return {
        description: responseContent,
        vocabulary: []
      };
    }
  }

  /**
   * 解析测验生成响应
   */
  static parseQuizResponse(responseContent: string): any | null {
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('响应中未找到JSON格式内容');
      }

      return JSON.parse(jsonMatch[0]);

    } catch (error: any) {
      logger.error('测验生成响应解析失败', {
        error: (error instanceof Error ? error.message : String(error)),
        responseContent: responseContent.substring(0, 200) + '...'
      });
      return null;
    }
  }

  /**
   * 清理和标准化响应内容
   */
  static cleanResponseContent(content: string): string {
    return content
      .trim()
      .replace(/^\*\*|\*\*$/g, '') // 移除markdown粗体标记
      .replace(/^```json\s*|\s*```$/g, '') // 移除代码块标记
      .replace(/^```\s*|\s*```$/g, '');
  }
}

/**
 * 豆包多模态工具函数
 */
export class DoubaoMultiModalUtils {
  /**
   * 构建图像描述提示词
   */
  static buildImageDescriptionPrompt(
    purpose: 'vocabulary' | 'quiz' | 'description' | 'learning',
    language: string = 'english',
    difficulty: string = 'intermediate'
  ): string {
    const prompts = {
      vocabulary: `请分析这张图片并生成相关的${language}词汇学习内容，难度：${difficulty}。`,
      quiz: `基于这张图片生成${language}学习测验题，难度：${difficulty}。`,
      description: `请详细描述这张图片的内容，使用${language}，适合${difficulty}水平的学习者。`,
      learning: `请为语言学习者分析这张图片，提供${language}学习价值，难度：${difficulty}。`
    };

    return prompts[purpose] || prompts.description;
  }

  /**
   * 生成系统提示消息
   */
  static buildSystemPrompt(context: 'vocabulary' | 'quiz' | 'description'): MultiModalMessage {
    const systemPrompts = {
      vocabulary: '你是一个专业的语言学习助手，擅长从图像中提取和生成词汇学习内容。请提供准确、有用的词汇分析。',
      quiz: '你是一个专业的测验题目生成器，擅长基于图像内容创建有趣且有教育意义的语言学习测试。',
      description: '你是一个专业的图像描述师，能够详细、准确地描述图像内容，帮助语言学习者理解视觉信息。'
    };

    return DoubaoMessageBuilder.buildTextMessage('system', systemPrompts[context]);
  }

  /**
   * 检查图像URL可访问性
   */
  static async checkImageAccessibility(url: string): Promise<boolean> {
    try {
      // 在实际环境中，这里应该发送HEAD请求检查图像
      // 目前只做基础URL验证
      return DoubaoMessageBuilder.validateImageUrl(url);
    } catch {
      return false;
    }
  }

  /**
   * 优化多模态请求参数
   */
  static optimizeRequestParams(
    messageComplexity: ReturnType<typeof DoubaoMessageBuilder.calculateMessageComplexity>,
    baseOptions: any = {}
  ): any {
    const { textLength, imageCount, estimatedTokens } = messageComplexity;

    // 基于复杂度调整参数
    const optimizedOptions = { ...baseOptions };

    if (estimatedTokens > 3000) {
      optimizedOptions.max_tokens = Math.max(4000, estimatedTokens + 1000);
    }

    if (imageCount > 0) {
      // 图像分析通常需要更多时间
      optimizedOptions.temperature = optimizedOptions.temperature ?? 0.3;
    }

    return optimizedOptions;
  }
}

export default {
  DoubaoMessageBuilder,
  DoubaoResponseParser,
  DoubaoMultiModalUtils
};