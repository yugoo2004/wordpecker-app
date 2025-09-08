import OpenAI from 'openai';
import { environment } from './environment';
import { logger } from './logger';
import { getDoubaoService } from '../services/doubao-service';
import { getVolcengineTTSService } from '../services/volcengine-tts-service';
import { getSeedreamImageService } from '../services/seedream-image-service';
import { 
  MultiModalMessage, 
  TextMessage, 
  DoubaoMessageBuilder,
  ImageAnalysisRequest,
  ImageAnalysisResult
} from '../utils/doubao-multimodal';

// AI 服务提供商类型 - 扩展国产化支持，豆包1.6优先
export type AIProvider = 'doubao' | 'glm' | 'moonshot' | 'qwen' | 'minimax' | 'baichuan';
export type VoiceProvider = 'volcengine' | 'glm' | 'elevenlabs';
export type ImageProvider = 'seeddream' | 'dalle' | 'stable-diffusion';

// AI 服务配置接口
interface AIServiceConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: AIProvider;
}

// GLM 和其他国产AI的配置
const AI_CONFIGS: Record<AIProvider, AIServiceConfig> = {
  doubao: {
    apiKey: environment.ai.doubao.apiKey,
    baseUrl: environment.ai.doubao.baseUrl,
    model: environment.ai.doubao.model,
    provider: 'doubao'
  },
  glm: {
    apiKey: environment.ai.glm.apiKey,
    baseUrl: environment.ai.glm.baseUrl,
    model: environment.ai.glm.textModel,
    provider: 'glm'
  },
  moonshot: {
    apiKey: environment.ai.primary.apiKey,
    baseUrl: environment.ai.primary.baseUrl,
    model: environment.ai.primary.model,
    provider: 'moonshot'
  },
  qwen: {
    apiKey: environment.ai?.qwen?.apiKey || '',
    baseUrl: environment.ai?.qwen?.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: environment.ai?.qwen?.model || 'qwen-plus',
    provider: 'qwen'
  },
  minimax: {
    apiKey: environment.ai?.minimax?.apiKey || '',
    baseUrl: environment.ai?.minimax?.baseUrl || 'https://api.minimax.chat/v1',
    model: environment.ai?.minimax?.model || 'abab6.5s-chat',
    provider: 'minimax'
  },
  baichuan: {
    apiKey: environment.ai?.baichuan?.apiKey || '',
    baseUrl: environment.ai?.baichuan?.baseUrl || 'https://api.baichuan-ai.com/v1',
    model: environment.ai?.baichuan?.model || 'Baichuan2-Turbo',
    provider: 'baichuan'
  }
};

// AI 服务客户端管理器
class AIServiceManager {
  private clients: Map<AIProvider, OpenAI> = new Map();
  private doubaoService: any = null;
  private voiceService: any = null;
  private imageService: any = null;
  private currentProvider: AIProvider = 'glm'; // 默认使用GLM
  private failedProviders: Set<AIProvider> = new Set();
  private lastFailureTime: Map<AIProvider, number> = new Map();
  private readonly FAILURE_COOLDOWN = 5 * 60 * 1000; // 5分钟冷却时间
  
  // 降级控制属性
  private fallbackDisabled: boolean = false;
  private forcedProvider?: AIProvider;
  private detailedErrorLogging: boolean = false;
  private debugMode: boolean = false;

  constructor() {
    this.initializeClients();
    this.initializeOptionalServices();
    this.initializeFallbackConfig();
  }

  private initializeFallbackConfig(): void {
    // 从环境变量初始化降级配置
    this.fallbackDisabled = !environment.ai.fallback.enabled;
    this.forcedProvider = environment.ai.fallback.forcedProvider;
    this.detailedErrorLogging = environment.ai.fallback.logDetailedErrors;
    this.debugMode = environment.ai.fallback.debugMode;
    
    if (this.fallbackDisabled) {
      logger.warn('AI降级机制已禁用', { 
        forcedProvider: this.forcedProvider,
        reason: '环境配置'
      });
    }
  }

  private initializeOptionalServices(): void {
    // 尝试初始化豆包服务（可选）
    try {
      this.doubaoService = getDoubaoService();
      this.currentProvider = 'doubao'; // 如果豆包可用，优先使用
      logger.info('豆包服务初始化成功');
    } catch (error) {
      logger.warn('豆包服务初始化失败，将使用备用AI服务', { error: (error as Error).message });
    }

    // 尝试初始化语音服务（可选）
    try {
      this.voiceService = getVolcengineTTSService();
      logger.info('火山引擎TTS服务初始化成功');
    } catch (error) {
      logger.warn('火山引擎TTS服务初始化失败', { error: (error as Error).message });
    }

    // 尝试初始化图像服务（可选）
    try {
      this.imageService = getSeedreamImageService();
      logger.info('SeeDream 3.0图像服务初始化成功');
    } catch (error) {
      logger.warn('SeeDream 3.0图像服务初始化失败', { error: (error as Error).message });
    }
  }

  private initializeClients(): void {
    for (const [provider, config] of Object.entries(AI_CONFIGS)) {
      try {
        const client = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseUrl,
        });
        this.clients.set(provider as AIProvider, client);
        logger.info(`AI 服务客户端初始化成功: ${provider}`, {
          provider,
          baseUrl: config.baseUrl,
          model: config.model
        });
      } catch (error) {
        logger.error(`AI 服务客户端初始化失败: ${provider}`, { error, provider });
      }
    }
  }

  // 获取当前可用的 AI 客户端
  private getAvailableClient(): { client: OpenAI; config: AIServiceConfig; isDoubao?: boolean } | null {
    // 如果禁用降级机制
    if (this.fallbackDisabled) {
      return this.getSingleProvider(this.forcedProvider || 'doubao');
    }
    
    // 正常降级逻辑
    return this.getNormalProvider();
  }
  
  /**
   * 获取指定的单个提供商（禁用降级时使用）
   */
  private getSingleProvider(provider: AIProvider): { client: OpenAI; config: AIServiceConfig; isDoubao?: boolean } | null {
    if (this.debugMode) {
      logger.info(`强制使用AI提供商: ${provider}`);
    }
    
    if (provider === 'doubao' && this.doubaoService) {
      logger.info('使用豆包服务（禁用降级模式）');
      return { 
        client: null as any,
        config: AI_CONFIGS[provider],
        isDoubao: true
      };
    }
    
    const client = this.clients.get(provider);
    const config = AI_CONFIGS[provider];
    
    if (client && config) {
      logger.info(`使用${provider}服务（禁用降级模式）`);
      return { client, config };
    }
    
    const errorMsg = `强制指定的AI服务提供商不可用: ${provider}`;
    logger.error(errorMsg, {
      provider,
      hasClient: !!client,
      hasConfig: !!config,
      availableClients: Array.from(this.clients.keys())
    });
    
    throw new Error(errorMsg);
  }
  
  /**
   * 正常降级逻辑（启用降级时使用）
   */
  private getNormalProvider(): { client: OpenAI; config: AIServiceConfig; isDoubao?: boolean } | null {
    // 检查冷却时间，重置已恢复的服务
    this.checkCooldownRecovery();

    // 优先级顺序：豆包 -> GLM -> Moonshot -> Qwen -> MiniMax -> Baichuan
    const providerOrder: AIProvider[] = ['doubao', 'glm', 'moonshot', 'qwen', 'minimax', 'baichuan'];
    
    for (const provider of providerOrder) {
      if (!this.failedProviders.has(provider)) {
        if (provider === 'doubao' && this.doubaoService) {
          // 豆包使用专用服务（仅在可用时）
          return { 
            client: null as any, // 豆包不使用OpenAI客户端
            config: AI_CONFIGS[provider],
            isDoubao: true
          };
        }
        
        if (provider !== 'doubao') {
          const client = this.clients.get(provider);
          const config = AI_CONFIGS[provider];
          
          if (client && config) {
            this.currentProvider = provider;
            return { client, config };
          }
        }
      }
    }

    logger.error('所有 AI 服务提供商都不可用');
    return null;
  }

  // 检查冷却时间，重置已恢复的服务
  private checkCooldownRecovery(): void {
    const now = Date.now();
    for (const provider of this.failedProviders) {
      const lastFailure = this.lastFailureTime.get(provider);
      if (lastFailure && (now - lastFailure) > this.FAILURE_COOLDOWN) {
        this.failedProviders.delete(provider);
        this.lastFailureTime.delete(provider);
        logger.info(`AI 服务提供商已从失败列表中恢复: ${provider}`);
      }
    }
  }

  // 标记服务提供商为失败状态
  private markProviderAsFailed(provider: AIProvider, error: any): void {
    this.failedProviders.add(provider);
    this.lastFailureTime.set(provider, Date.now());
    
    // 基本错误日志
    logger.error(`AI 服务提供商标记为失败: ${provider}`, {
      error: (error instanceof Error ? error.message : String(error)) || error,
      provider,
      cooldownMinutes: this.FAILURE_COOLDOWN / 60000
    });
    
    // 详细错误日志（如果启用）
    if (this.detailedErrorLogging) {
      this.logDetailedError(provider, error);
    }
  }
  
  /**
   * 记录详细错误信息，特别针对火山引擎服务
   */
  private logDetailedError(provider: AIProvider, error: any): void {
    const errorDetails: any = {
      timestamp: new Date().toISOString(),
      provider,
      errorType: error.constructor?.name || 'Unknown',
      message: (error instanceof Error ? error.message : String(error)) || error,
      stack: error.stack,
      config: {
        provider: AI_CONFIGS[provider]?.provider,
        baseUrl: AI_CONFIGS[provider]?.baseUrl,
        model: AI_CONFIGS[provider]?.model,
        hasApiKey: !!AI_CONFIGS[provider]?.apiKey
      }
    };
    
    // 火山引擎（豆包）特殊信息
    if (provider === 'doubao') {
      errorDetails.volcengineDetails = {
        endpoint: environment.ai.doubao.endpoint,
        region: environment.ai.doubao.region,
        baseUrl: environment.ai.doubao.baseUrl,
        accessKeyId: environment.ai.doubao.accessKeyId ? '已配置' : '未配置',
        secretAccessKey: environment.ai.doubao.secretAccessKey ? '已配置' : '未配置',
        hasDoubaoService: !!this.doubaoService,
        // 连接诊断信息
        connectionDiagnostics: {
          endpointConfigured: !!environment.ai.doubao.endpoint,
          credentialsConfigured: !!(environment.ai.doubao.accessKeyId && environment.ai.doubao.secretAccessKey),
          serviceInitialized: !!this.doubaoService
        }
      };
      
      // 如果是网络连接错误，提供额外诊断信息
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'TIMEOUT') {
        errorDetails.networkDiagnostics = {
          errorCode: error.code,
          address: error.address,
          port: error.port,
          hostname: error.hostname,
          suggestion: '请检查网络连接和火山引擎端点配置'
        };
      }
      
      // 如果是认证错误
      if (error.status === 401 || (error instanceof Error ? error.message : String(error))?.includes('auth') || (error instanceof Error ? error.message : String(error))?.includes('key')) {
        errorDetails.authDiagnostics = {
          suggestion: '请检查VOLCENGINE_ACCESS_KEY_ID和VOLCENGINE_SECRET_ACCESS_KEY是否配置正确',
          hasAccessKeyId: !!environment.ai.doubao.accessKeyId,
          hasSecretAccessKey: !!environment.ai.doubao.secretAccessKey,
          endpointId: environment.ai.doubao.endpoint || '未配置'
        };
      }
    }
    
    logger.error('AI服务详细错误信息', errorDetails);
    
    // 写入专门的错误文件用于问题排查
    try {
      const fs = require('fs');
      const path = require('path');
      const errorLogPath = path.join(process.cwd(), 'logs', 'ai-service-errors.json');
      
      // 确保日志目录存在
      const logDir = path.dirname(errorLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      fs.appendFileSync(errorLogPath, JSON.stringify(errorDetails, null, 2) + ',\n');
    } catch (writeError) {
      logger.error('无法写入错误日志文件', { writeError: writeError instanceof Error ? writeError.message : String(writeError) });
    }
  }

  /**
   * 创建多模态聊天完成（支持图像+文本）
   */
  async createMultiModalCompletion(
    messages: MultiModalMessage[],
    options: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      stream?: boolean;
      stop?: string | string[];
    } = {}
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    // 多模态功能目前仅豆包支持
    if (!this.doubaoService) {
      // 降级为文本模式
      logger.warn('豆包服务不可用，多模态请求降级为文本模式');
      
      const textMessages = messages.map(msg => ({
        role: msg.role,
        content: DoubaoMessageBuilder.extractTextContent([msg])
      }));
      
      return this.createChatCompletion(textMessages as any, options);
    }

    try {
      logger.info('创建多模态聊天完成', {
        messagesCount: messages.length,
        complexity: DoubaoMessageBuilder.calculateMessageComplexity(messages)
      });

      const doubaoResponse = await this.doubaoService.createMultiModalCompletion(
        messages,
        options
      );
      
      // 转换为OpenAI格式
      const response: OpenAI.Chat.Completions.ChatCompletion = {
        id: doubaoResponse.id,
        object: 'chat.completion',
        created: doubaoResponse.created,
        model: doubaoResponse.model,
        choices: doubaoResponse.choices.map((choice: any) => ({
          index: choice.index,
          message: {
            role: choice.message.role,
            content: choice.message.content
          },
          logprobs: null,
          finish_reason: choice.finish_reason
        })),
        usage: doubaoResponse.usage,
        system_fingerprint: undefined
      };

      logger.info('多模态聊天完成成功', {
        tokensUsed: response.usage?.total_tokens || 0,
        responseLength: response.choices[0]?.message?.content?.length || 0
      });

      return response;

    } catch (error: any) {
      logger.error('多模态聊天完成失败', {
        error: (error instanceof Error ? error.message : String(error)),
        messagesCount: messages.length
      });
      
      // 记录豆包服务失败
      this.markProviderAsFailed('doubao', error);
      
      // 尝试降级为文本模式
      logger.info('尝试降级为文本模式');
      const textMessages = messages.map(msg => ({
        role: msg.role,
        content: DoubaoMessageBuilder.extractTextContent([msg])
      }));
      
      return this.createChatCompletion(textMessages as any, options);
    }
  }

  /**
   * 图像分析功能
   */
  async analyzeImage(
    request: ImageAnalysisRequest
  ): Promise<ImageAnalysisResult> {
    if (!this.doubaoService) {
      throw new Error('图像分析功能需要豆包服务支持');
    }

    try {
      logger.info('执行图像分析', {
        imageUrl: request.imageUrl?.substring(0, 100) + '...',
        analysisType: request.analysisType,
        targetLanguage: request.targetLanguage
      });

      let response;
      
      if (request.analysisType === 'vocabulary') {
        response = await this.doubaoService.generateVocabularyFromImage(
          request.imageUrl,
          request.targetLanguage,
          request.difficulty,
          request.options
        );
      } else {
        const prompt = request.prompt || '请分析这张图片并描述其主要内容。';
        response = await this.doubaoService.analyzeImage(
          request.imageUrl,
          prompt,
          request.options
        );
      }

      const responseContent = response.choices[0]?.message?.content || '';
      
      // 使用DoubaoResponseParser解析响应
      const { DoubaoResponseParser } = require('../utils/doubao-multimodal');
      
      let result: ImageAnalysisResult;
      if (request.analysisType === 'vocabulary') {
        result = DoubaoResponseParser.parseVocabularyResponse(responseContent) || {
          description: responseContent,
          vocabulary: []
        };
      } else {
        result = {
          description: DoubaoResponseParser.cleanResponseContent(responseContent)
        };
      }

      logger.info('图像分析完成', {
        descriptionLength: result.description?.length || 0,
        vocabularyCount: result.vocabulary?.length || 0,
        tokensUsed: response.usage?.total_tokens || 0
      });

      return result;

    } catch (error: any) {
      logger.error('图像分析失败', {
        error: (error instanceof Error ? error.message : String(error)),
        imageUrl: request.imageUrl?.substring(0, 100) + '...',
        analysisType: request.analysisType
      });
      
      this.markProviderAsFailed('doubao', error);
      throw error;
    }
  }
  async createChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {}
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const maxRetries = 3; // 最多尝试3个提供商
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const serviceInfo = this.getAvailableClient();
      
      if (!serviceInfo) {
        throw new Error('没有可用的 AI 服务提供商');
      }

      const { client, config, isDoubao } = serviceInfo;

      try {
        logger.info(`尝试使用 AI 服务: ${config.provider}`, {
          provider: config.provider,
          model: config.model,
          attempt: attempt + 1
        });

        let response: OpenAI.Chat.Completions.ChatCompletion;

        if (isDoubao) {
          // 使用豆包专用服务
          const doubaoResponse = await this.doubaoService.createChatCompletion(
            messages as any,
            options
          );
          
          // 转换为OpenAI格式
          response = {
            id: doubaoResponse.id,
            object: 'chat.completion',
            created: doubaoResponse.created,
            model: doubaoResponse.model,
            choices: doubaoResponse.choices.map((choice: any) => ({
              index: choice.index,
              message: {
                role: choice.message.role,
                content: choice.message.content
              },
              logprobs: null,
              finish_reason: choice.finish_reason
            })),
            usage: doubaoResponse.usage,
            system_fingerprint: undefined
          };
        } else {
          // 使用传统OpenAI兼容客户端
          const createResponse = await client.chat.completions.create({
            model: config.model,
            messages,
            stream: false,
            ...options
          });
          response = createResponse as OpenAI.Chat.Completions.ChatCompletion;
        }

        // 请求成功，记录日志
        logger.info(`AI 请求成功: ${config.provider}`, {
          provider: config.provider,
          model: config.model,
          tokensUsed: response.usage?.total_tokens || 0
        });

        return response;

      } catch (error: any) {
        lastError = error;
        
        // 标记当前提供商为失败
        this.markProviderAsFailed(config.provider, error);

        logger.warn(`AI 服务请求失败，尝试切换提供商: ${config.provider}`, {
          error: (error instanceof Error ? error.message : String(error)) || error,
          provider: config.provider,
          attempt: attempt + 1,
          willRetry: attempt < maxRetries - 1
        });

        // 如果不是最后一次尝试，继续下一个提供商
        if (attempt < maxRetries - 1) {
          continue;
        }
      }
    }

    // 所有提供商都失败了
    logger.error('所有 AI 服务提供商都失败了', {
      lastError: lastError?.message || lastError,
      failedProviders: Array.from(this.failedProviders)
    });

    throw new Error(`AI 服务不可用: ${lastError?.message || '未知错误'}`);
  }

  // 语音生成服务
  async generateSpeech(
    text: string,
    options: {
      voice?: string;
      speed?: number;
      language?: string;
      encoding?: 'mp3' | 'wav';
    } = {}
  ): Promise<Buffer> {
    try {
      return await this.voiceService.generateSpeech(text, options);
    } catch (error: any) {
      logger.error('语音生成失败', { error: (error instanceof Error ? error.message : String(error)) });
      throw error;
    }
  }

  /**
   * SeeDream 3.0图像生成功能（多模态）
   */
  async generateImageWithSeedream(
    prompt: string,
    options: {
      size?: string;
      guidance_scale?: number;
      watermark?: boolean;
      style?: string;
      count?: number;
      response_format?: 'url' | 'b64_json';
    } = {}
  ): Promise<any> {
    if (!this.imageService) {
      throw new Error('图像生成功能需要SeeDream服务支持');
    }

    try {
      logger.info('执行SeeDream图像生成', {
        promptLength: prompt.length,
        size: options.size,
        guidance_scale: options.guidance_scale
      });

      const result = await this.imageService.generateImage(prompt, {
        size: options.size,
        guidance_scale: options.guidance_scale,
        watermark: options.watermark,
        style: options.style,
        count: options.count,
        response_format: options.response_format
      });

      logger.info('SeeDream图像生成完成', {
        hasUrl: !!result.url,
        hasBuffer: !!result.buffer
      });

      return result;

    } catch (error: any) {
      logger.error('SeeDream图像生成失败', {
        error: (error instanceof Error ? error.message : String(error)),
        promptLength: prompt.length
      });
      
      throw error;
    }
  }

  /**
   * 获取多模态服务状态
   */
  getMultiModalServiceStatus(): {
    doubao: any;
    seeddream: any;
    overall: 'available' | 'degraded' | 'unavailable';
  } {
    const doubaoAvailable = !!this.doubaoService && !this.failedProviders.has('doubao');
    const seedreamAvailable = !!this.imageService;
    
    let overall: 'available' | 'degraded' | 'unavailable';
    
    if (doubaoAvailable && seedreamAvailable) {
      overall = 'available';
    } else if (doubaoAvailable || seedreamAvailable) {
      overall = 'degraded';
    } else {
      overall = 'unavailable';
    }

    return {
      doubao: {
        available: doubaoAvailable,
        failed: this.failedProviders.has('doubao'),
        lastFailure: this.lastFailureTime.get('doubao')
      },
      seeddream: {
        available: seedreamAvailable
      },
      overall
    };
  }

  /**
   * 重置多模态服务状态
   */
  resetMultiModalServiceStatus(): void {
    // 重置豆包服务状态
    this.failedProviders.delete('doubao');
    this.lastFailureTime.delete('doubao');
    
    logger.info('多模态服务状态已重置');
  }

  /**
   * 检查多模态功能可用性
   */
  isMultiModalAvailable(): boolean {
    return !!this.doubaoService && !this.failedProviders.has('doubao');
  }

  /**
   * 检查图像生成功能可用性
   */
  isImageGenerationAvailable(): boolean {
    return !!this.imageService;
  }

  // 图像生成服务
  async generateImage(
    prompt: string,
    options: {
      size?: string;
      quality?: string;
      style?: string;
      saveToFile?: boolean;
    } = {}
  ): Promise<any> {
    try {
      return await this.imageService.generateImage(prompt, options);
    } catch (error: any) {
      logger.error('图像生成失败', { error: (error instanceof Error ? error.message : String(error)) });
      throw error;
    }
  }

  // 获取所有服务状态
  async getAllServiceStatus(): Promise<{
    text: any;
    voice: any;
    image: any;
  }> {
    const [textStatus, voiceStatus, imageStatus] = await Promise.allSettled([
      this.doubaoService.getServiceStatus(),
      this.voiceService.getServiceStatus(),
      this.imageService.getServiceStatus()
    ]);

    return {
      text: textStatus.status === 'fulfilled' ? textStatus.value : { available: false, error: 'Service check failed' },
      voice: voiceStatus.status === 'fulfilled' ? voiceStatus.value : { available: false, error: 'Service check failed' },
      image: imageStatus.status === 'fulfilled' ? imageStatus.value : { available: false, error: 'Service check failed' }
    };
  }

  // 获取当前服务状态
  getServiceStatus(): {
    currentProvider: AIProvider;
    availableProviders: AIProvider[];
    failedProviders: AIProvider[];
    lastFailureTimes: Record<string, number>;
  } {
    const availableProviders = Array.from(this.clients.keys()).filter(
      provider => !this.failedProviders.has(provider)
    );

    const lastFailureTimes: Record<string, number> = {};
    for (const [provider, time] of this.lastFailureTime.entries()) {
      lastFailureTimes[provider] = time;
    }

    return {
      currentProvider: this.currentProvider,
      availableProviders,
      failedProviders: Array.from(this.failedProviders),
      lastFailureTimes
    };
  }

  // 手动重置失败状态（用于管理接口）
  resetFailureStatus(provider?: AIProvider): void {
    if (provider) {
      this.failedProviders.delete(provider);
      this.lastFailureTime.delete(provider);
      logger.info(`手动重置 AI 服务提供商失败状态: ${provider}`);
    } else {
      this.failedProviders.clear();
      this.lastFailureTime.clear();
      logger.info('手动重置所有 AI 服务提供商失败状态');
    }
  }
  
  // 降级控制方法
  
  /**
   * 禁用AI服务降级机制
   * @param provider 强制使用的提供商，不指定则使用默认的首选提供商
   * @param enableDetailedLogging 是否启用详细错误日志
   */
  disableFallback(provider?: AIProvider, enableDetailedLogging: boolean = true): void {
    this.fallbackDisabled = true;
    this.forcedProvider = provider;
    this.detailedErrorLogging = enableDetailedLogging;
    
    logger.warn('AI降级机制已禁用', { 
      forcedProvider: provider || '默认首选',
      detailedLogging: enableDetailedLogging,
      reason: '手动禁用'
    });
  }
  
  /**
   * 启用AI服务降级机制
   */
  enableFallback(): void {
    this.fallbackDisabled = false;
    this.forcedProvider = undefined;
    this.detailedErrorLogging = false;
    
    logger.info('AI降级机制已启用');
  }
  
  /**
   * 获取降级配置状态
   */
  getFallbackStatus(): {
    enabled: boolean;
    forcedProvider?: AIProvider;
    detailedLogging: boolean;
    debugMode: boolean;
  } {
    return {
      enabled: !this.fallbackDisabled,
      forcedProvider: this.forcedProvider,
      detailedLogging: this.detailedErrorLogging,
      debugMode: this.debugMode
    };
  }
  
  /**
   * 设置调试模式
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    logger.info(`AI调试模式${enabled ? '已启用' : '已禁用'}`);
  }
}

// 创建全局 AI 服务管理器实例
export const aiService = new AIServiceManager();

// 导出便捷方法
export const createChatCompletion = aiService.createChatCompletion.bind(aiService);
export const createMultiModalCompletion = aiService.createMultiModalCompletion.bind(aiService);
export const analyzeImage = aiService.analyzeImage.bind(aiService);
export const generateSpeech = aiService.generateSpeech.bind(aiService);
export const generateImage = aiService.generateImage.bind(aiService);
export const generateImageWithSeedream = aiService.generateImageWithSeedream.bind(aiService);
export const getAIServiceStatus = aiService.getServiceStatus.bind(aiService);
export const getAllServiceStatus = aiService.getAllServiceStatus.bind(aiService);
export const getMultiModalServiceStatus = aiService.getMultiModalServiceStatus.bind(aiService);
export const resetAIFailureStatus = aiService.resetFailureStatus.bind(aiService);
export const resetMultiModalServiceStatus = aiService.resetMultiModalServiceStatus.bind(aiService);
export const isMultiModalAvailable = aiService.isMultiModalAvailable.bind(aiService);
export const isImageGenerationAvailable = aiService.isImageGenerationAvailable.bind(aiService);

// 降级控制方法
export const disableAIFallback = aiService.disableFallback.bind(aiService);
export const enableAIFallback = aiService.enableFallback.bind(aiService);
export const getAIFallbackStatus = aiService.getFallbackStatus.bind(aiService);
export const setAIDebugMode = aiService.setDebugMode.bind(aiService);

// 向后兼容的默认导出
export default aiService;