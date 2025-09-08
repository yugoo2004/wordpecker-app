import { Router, Request, Response } from 'express';
import axios, { AxiosInstance } from 'axios';
import { getDoubaoService } from '../services/doubao-service';
import { getSeedreamImageService } from '../services/seedream-image-service';
import { 
  DoubaoMessageBuilder, 
  DoubaoResponseParser, 
  DoubaoMultiModalUtils,
  ImageAnalysisRequest,
  ImageAnalysisResult,
  VocabularyItem
} from '../utils/doubao-multimodal';
import { logger } from '../config/logger';
import AIServiceManager from '../config/ai-service';

const router = Router();

/**
 * 多模态图像分析端点
 * POST /api/multimodal/analyze-image
 */
router.post('/analyze-image', async (req: Request, res: Response) => {
  try {
    const {
      imageUrl,
      prompt = '请分析这张图片并描述其主要内容。',
      targetLanguage = 'chinese',
      analysisType = 'description',
      options = {}
    }: ImageAnalysisRequest = req.body;

    // 验证必需参数
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数：imageUrl'
      });
    }

    // 验证图像URL格式
    if (!DoubaoMessageBuilder.validateImageUrl(imageUrl)) {
      return res.status(400).json({
        success: false,
        error: '无效的图像URL格式'
      });
    }

    logger.info('多模态图像分析请求', {
      imageUrl: imageUrl.substring(0, 100) + '...',
      analysisType,
      targetLanguage
    });

    // 获取豆包服务
    const doubaoService = getDoubaoService();

    // 构建分析提示词
    const analysisPrompt = DoubaoMultiModalUtils.buildImageDescriptionPrompt(
      analysisType as any,
      targetLanguage,
      'intermediate'
    );

    // 执行图像分析
    const response = await doubaoService.analyzeImage(
      imageUrl,
      analysisPrompt,
      {
        temperature: options.temperature || 0.3,
        max_tokens: options.max_tokens || 1000,
        detail: options.detail || 'auto'
      }
    );

    const analysisContent = response.choices[0]?.message?.content || '';
    
    // 解析响应
    let analysisResult: ImageAnalysisResult;
    if (analysisType === 'vocabulary') {
      analysisResult = DoubaoResponseParser.parseVocabularyResponse(analysisContent) || {
        description: analysisContent,
        vocabulary: []
      };
    } else {
      analysisResult = {
        description: DoubaoResponseParser.cleanResponseContent(analysisContent)
      };
    }

    logger.info('多模态图像分析完成', {
      descriptionLength: analysisResult.description?.length || 0,
      vocabularyCount: analysisResult.vocabulary?.length || 0,
      tokensUsed: response.usage?.total_tokens || 0
    });

    res.json({
      success: true,
      data: {
        analysis: analysisResult,
        metadata: {
          imageUrl,
          analysisType,
          targetLanguage,
          model: 'doubao-seed-1-6-250615',
          timestamp: new Date().toISOString()
        },
        usage: response.usage
      }
    });

  } catch (error: any) {
    logger.error('多模态图像分析失败', {
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: '图像分析失败',
      details: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * 基于图像生成词汇学习内容
 * POST /api/multimodal/generate-vocabulary
 */
router.post('/generate-vocabulary', async (req: Request, res: Response) => {
  try {
    const {
      imageUrl,
      targetLanguage = 'english',
      difficulty = 'intermediate',
      wordCount = 10,
      includeExamples = true,
      includePronunciation = false,
      options = {}
    } = req.body;

    // 验证必需参数
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数：imageUrl'
      });
    }

    logger.info('图像词汇生成请求', {
      imageUrl: imageUrl.substring(0, 100) + '...',
      targetLanguage,
      difficulty,
      wordCount
    });

    // 获取豆包服务
    const doubaoService = getDoubaoService();

    // 生成词汇内容
    const response = await doubaoService.generateVocabularyFromImage(
      imageUrl,
      targetLanguage,
      difficulty,
      {
        wordCount,
        includeExamples,
        includePronunciation,
        ...options
      }
    );

    const responseContent = response.choices[0]?.message?.content || '';
    
    // 解析词汇响应
    const vocabularyResult = DoubaoResponseParser.parseVocabularyResponse(responseContent);

    if (!vocabularyResult) {
      throw new Error('词汇生成响应解析失败');
    }

    logger.info('图像词汇生成完成', {
      vocabularyCount: vocabularyResult.vocabulary?.length || 0,
      tokensUsed: response.usage?.total_tokens || 0
    });

    res.json({
      success: true,
      data: {
        description: vocabularyResult.description,
        vocabulary: vocabularyResult.vocabulary || [],
        metadata: {
          imageUrl,
          targetLanguage,
          difficulty,
          wordCount,
          includeExamples,
          includePronunciation,
          model: 'doubao-seed-1-6-250615',
          timestamp: new Date().toISOString()
        },
        usage: response.usage
      }
    });

  } catch (error: any) {
    logger.error('图像词汇生成失败', {
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: '词汇生成失败',
      details: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * 基于图像生成测验题目
 * POST /api/multimodal/generate-quiz
 */
router.post('/generate-quiz', async (req: Request, res: Response) => {
  try {
    const {
      imageUrl,
      vocabulary = [],
      questionCount = 5,
      difficulty = 'intermediate',
      questionTypes = ['multiple_choice'],
      options = {}
    } = req.body;

    // 验证必需参数
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数：imageUrl'
      });
    }

    logger.info('图像测验生成请求', {
      imageUrl: imageUrl.substring(0, 100) + '...',
      vocabularyCount: vocabulary.length,
      questionCount
    });

    // 构建测验生成消息
    const quizMessage = DoubaoMessageBuilder.buildQuizGenerationMessage(
      imageUrl,
      vocabulary,
      questionCount
    );

    // 添加系统提示
    const systemPrompt = DoubaoMultiModalUtils.buildSystemPrompt('quiz');
    const messages = [systemPrompt, quizMessage];

    // 获取豆包服务
    const doubaoService = getDoubaoService();

    // 生成测验
    const response = await doubaoService.createMultiModalCompletion(messages, {
      temperature: options.temperature || 0.5,
      max_tokens: options.max_tokens || 2000
    });

    const responseContent = response.choices[0]?.message?.content || '';
    
    // 解析测验响应
    const quizResult = DoubaoResponseParser.parseQuizResponse(responseContent);

    if (!quizResult || !quizResult.questions) {
      throw new Error('测验生成响应解析失败');
    }

    logger.info('图像测验生成完成', {
      questionCount: quizResult.questions?.length || 0,
      tokensUsed: response.usage?.total_tokens || 0
    });

    res.json({
      success: true,
      data: {
        quiz: quizResult,
        metadata: {
          imageUrl,
          vocabulary,
          questionCount,
          difficulty,
          questionTypes,
          model: 'doubao-seed-1-6-250615',
          timestamp: new Date().toISOString()
        },
        usage: response.usage
      }
    });

  } catch (error: any) {
    logger.error('图像测验生成失败', {
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: '测验生成失败',
      details: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * 多模态聊天端点（通用）
 * POST /api/multimodal/chat
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const {
      messages,
      options = {}
    } = req.body;

    // 验证消息格式
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: '无效的消息格式'
      });
    }

    // 验证多模态消息
    for (const message of messages) {
      if (!DoubaoMessageBuilder.validateMultiModalMessage(message)) {
        return res.status(400).json({
          success: false,
          error: '消息格式验证失败'
        });
      }
    }

    logger.info('多模态聊天请求', {
      messageCount: messages.length,
      complexity: DoubaoMessageBuilder.calculateMessageComplexity(messages)
    });

    // 获取豆包服务
    const doubaoService = getDoubaoService();

    // 优化请求参数
    const complexity = DoubaoMessageBuilder.calculateMessageComplexity(messages);
    const optimizedOptions = DoubaoMultiModalUtils.optimizeRequestParams(complexity, options);

    // 执行多模态聊天
    const response = await doubaoService.createMultiModalCompletion(messages, optimizedOptions);

    const responseContent = response.choices[0]?.message?.content || '';

    logger.info('多模态聊天完成', {
      responseLength: responseContent.length,
      tokensUsed: response.usage?.total_tokens || 0
    });

    res.json({
      success: true,
      data: {
        response: {
          role: 'assistant',
          content: responseContent
        },
        metadata: {
          messageCount: messages.length,
          complexity,
          model: 'doubao-seed-1-6-250615',
          timestamp: new Date().toISOString()
        },
        usage: response.usage
      }
    });

  } catch (error: any) {
    logger.error('多模态聊天失败', {
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: '聊天请求失败',
      details: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * SeeDream 3.0 图像生成端点
 * POST /api/multimodal/generate-image
 */
router.post('/generate-image', async (req: Request, res: Response) => {
  try {
    const {
      prompt,
      size = '1024x1024',
      guidance_scale = 3,
      watermark = true,
      style,
      count = 1,
      response_format = 'url'
    } = req.body;

    // 验证必需参数
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数：prompt'
      });
    }

    logger.info('SeeDream图像生成请求', {
      promptLength: prompt.length,
      size,
      guidance_scale,
      count
    });

    // 获取SeeDream 3.0服务
    const seedreamService = getSeedreamImageService();

    // 生成图像
    const result = await seedreamService.generateImage(prompt, {
      size,
      guidance_scale,
      watermark,
      style,
      count,
      response_format
    });

    logger.info('SeeDream图像生成完成', {
      hasUrl: !!result.url,
      hasBuffer: !!result.buffer
    });

    res.json({
      success: true,
      data: {
        image: {
          url: result.url,
          revisedPrompt: result.revisedPrompt
        },
        metadata: result.metadata
      }
    });

  } catch (error: any) {
    logger.error('SeeDream图像生成失败', {
      error: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: '图像生成失败',
      details: (error instanceof Error ? error.message : String(error))
    });
  }
});

/**
 * 多模态服务健康检查
 * GET /api/multimodal/health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const doubaoService = getDoubaoService();
    const seedreamService = getSeedreamImageService();

    // 并行检查服务状态
    const [doubaoStatus, seedreamStatus] = await Promise.allSettled([
      doubaoService.getServiceStatus(),
      seedreamService.getServiceStatus()
    ]);

    const health = {
      status: 'healthy',
      services: {
        doubao: doubaoStatus.status === 'fulfilled' ? doubaoStatus.value : { available: false, error: (doubaoStatus as any).reason?.message },
        seeddream: seedreamStatus.status === 'fulfilled' ? seedreamStatus.value : { available: false, error: (seedreamStatus as any).reason?.message }
      },
      timestamp: new Date().toISOString()
    };

    // 检查整体健康状态
    const allHealthy = Object.values(health.services).every(service => service.available);
    if (!allHealthy) {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error: any) {
    logger.error('多模态健康检查失败', { error: (error instanceof Error ? error.message : String(error)) });

    res.status(503).json({
      status: 'unhealthy',
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

export default router;