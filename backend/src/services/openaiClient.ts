import OpenAI from 'openai';
import { ApiClient, createApiClient, ApiError } from './apiClient';
import { environment } from '../config/environment';
import { logger } from '../config/logger';

/**
 * OpenAI API 错误处理和重试机制
 */
export class OpenAIClient {
  private client: OpenAI;
  private apiClient: ApiClient;
  private isValidated: boolean = false;

  constructor() {
    // 创建 OpenAI 客户端
    this.client = new OpenAI({
      apiKey: environment.openai.apiKey,
      baseURL: environment.openai.baseUrl,
      timeout: 60000, // 60秒超时
      maxRetries: 0 // 禁用内置重试，使用我们的重试机制
    });

    // 创建通用 API 客户端用于验证和监控
    this.apiClient = createApiClient('OpenAI', {
      baseURL: environment.openai.baseUrl,
      timeout: 60000,
      headers: {
        'Authorization': `Bearer ${environment.openai.apiKey}`,
        'Content-Type': 'application/json'
      },
      retryConfig: {
        maxRetries: 3,
        baseDelay: 2000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        retryableStatusCodes: [429, 500, 502, 503, 504],
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
      }
    });
  }

  /**
   * 验证 OpenAI API 密钥
   */
  async validateApiKey(): Promise<boolean> {
    try {
      // 使用模型列表端点验证密钥
      const isValid = await this.apiClient.validateApiKey('/models', { limit: 1 });
      this.isValidated = isValid;
      return isValid;
    } catch (error) {
      logger.error('OpenAI API 密钥验证失败', { error });
      this.isValidated = false;
      return false;
    }
  }

  /**
   * 创建聊天完成，包含错误处理和重试
   */
  async createChatCompletion(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParams
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    await this.ensureValidated();

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const completion = await this.client.chat.completions.create(params);
        
        // 确保返回的是ChatCompletion类型，不是流式响应
        if ('choices' in completion && 'usage' in completion) {
          logger.info('OpenAI 聊天完成请求成功', {
            model: params.model,
            tokens: completion.usage?.total_tokens,
            duration: Date.now() - startTime,
            attempt: attempt + 1
          });

          return completion as OpenAI.Chat.Completions.ChatCompletion;
        } else {
          throw new Error('Unexpected response format from OpenAI API');
        }
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries && this.shouldRetryOpenAIError(error)) {
          const delay = this.calculateRetryDelay(attempt);
          
          logger.warn(`OpenAI 请求失败，${delay}ms 后重试`, {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            error: this.extractOpenAIErrorInfo(error),
            delay
          });
          
          await this.sleep(delay);
          continue;
        }

        logger.error('OpenAI 聊天完成请求失败', {
          model: params.model,
          attempt: attempt + 1,
          error: this.extractOpenAIErrorInfo(error)
        });

        throw this.formatOpenAIError(error);
      }
    }

    throw this.formatOpenAIError(lastError);
  }

  /**
   * 创建图像生成，包含错误处理和重试
   */
  async createImage(
    params: OpenAI.Images.ImageGenerateParams
  ): Promise<OpenAI.Images.ImagesResponse> {
    await this.ensureValidated();

    const maxRetries = 2; // 图像生成重试次数较少
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const images = await this.client.images.generate(params);
        
        logger.info('OpenAI 图像生成请求成功', {
          model: params.model,
          size: params.size,
          n: params.n,
          duration: Date.now() - startTime,
          attempt: attempt + 1
        });

        return images;
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries && this.shouldRetryOpenAIError(error)) {
          const delay = this.calculateRetryDelay(attempt) * 2; // 图像生成延迟更长
          
          logger.warn(`OpenAI 图像生成失败，${delay}ms 后重试`, {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            error: this.extractOpenAIErrorInfo(error),
            delay
          });
          
          await this.sleep(delay);
          continue;
        }

        logger.error('OpenAI 图像生成请求失败', {
          model: params.model,
          attempt: attempt + 1,
          error: this.extractOpenAIErrorInfo(error)
        });

        throw this.formatOpenAIError(error);
      }
    }

    throw this.formatOpenAIError(lastError);
  }

  /**
   * 创建语音转文字，包含错误处理和重试
   */
  async createTranscription(
    params: OpenAI.Audio.TranscriptionCreateParams
  ): Promise<OpenAI.Audio.Transcription> {
    await this.ensureValidated();

    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const transcription = await this.client.audio.transcriptions.create({
          ...params,
          stream: false
        } as OpenAI.Audio.TranscriptionCreateParamsNonStreaming);
        
        logger.info('OpenAI 语音转文字请求成功', {
          model: params.model,
          duration: Date.now() - startTime,
          attempt: attempt + 1
        });

        return transcription;
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries && this.shouldRetryOpenAIError(error)) {
          const delay = this.calculateRetryDelay(attempt);
          
          logger.warn(`OpenAI 语音转文字失败，${delay}ms 后重试`, {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            error: this.extractOpenAIErrorInfo(error),
            delay
          });
          
          await this.sleep(delay);
          continue;
        }

        logger.error('OpenAI 语音转文字请求失败', {
          model: params.model,
          attempt: attempt + 1,
          error: this.extractOpenAIErrorInfo(error)
        });

        throw this.formatOpenAIError(error);
      }
    }

    throw this.formatOpenAIError(lastError);
  }

  /**
   * 创建文字转语音，包含错误处理和重试
   */
  async createSpeech(
    params: OpenAI.Audio.SpeechCreateParams
  ): Promise<Response> {
    await this.ensureValidated();

    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const speech = await this.client.audio.speech.create(params);
        
        logger.info('OpenAI 文字转语音请求成功', {
          model: params.model,
          voice: params.voice,
          duration: Date.now() - startTime,
          attempt: attempt + 1
        });

        return speech;
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries && this.shouldRetryOpenAIError(error)) {
          const delay = this.calculateRetryDelay(attempt);
          
          logger.warn(`OpenAI 文字转语音失败，${delay}ms 后重试`, {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            error: this.extractOpenAIErrorInfo(error),
            delay
          });
          
          await this.sleep(delay);
          continue;
        }

        logger.error('OpenAI 文字转语音请求失败', {
          model: params.model,
          attempt: attempt + 1,
          error: this.extractOpenAIErrorInfo(error)
        });

        throw this.formatOpenAIError(error);
      }
    }

    throw this.formatOpenAIError(lastError);
  }

  /**
   * 确保 API 密钥已验证
   */
  private async ensureValidated(): Promise<void> {
    if (!this.isValidated) {
      const isValid = await this.validateApiKey();
      if (!isValid) {
        throw new ApiError({
          code: 'UNAUTHORIZED',
          message: 'OpenAI API 密钥无效，请检查配置'
        });
      }
    }
  }

  /**
   * 判断是否应该重试 OpenAI 错误
   */
  private shouldRetryOpenAIError(error: any): boolean {
    // OpenAI SDK 错误结构
    if (error.status) {
      // 可重试的状态码
      const retryableStatuses = [429, 500, 502, 503, 504];
      return retryableStatuses.includes(error.status);
    }

    // 网络错误
    if (error.code) {
      const retryableErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'];
      return retryableErrors.includes(error.code);
    }

    // 超时错误
    if ((error instanceof Error ? error.message : String(error))?.includes('timeout')) {
      return true;
    }

    return false;
  }

  /**
   * 计算重试延迟
   */
  private calculateRetryDelay(attempt: number): number {
    const baseDelay = 2000; // 2秒基础延迟
    const maxDelay = 30000; // 最大30秒
    const delay = baseDelay * Math.pow(2, attempt);
    
    // 添加随机抖动
    const jitter = Math.random() * 0.1 * delay;
    
    return Math.min(delay + jitter, maxDelay);
  }

  /**
   * 休眠指定时间
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 提取 OpenAI 错误信息
   */
  private extractOpenAIErrorInfo(error: any): any {
    if (error.status && (error instanceof Error ? error.message : String(error))) {
      return {
        status: error.status,
        message: (error instanceof Error ? error.message : String(error)),
        type: error.type,
        code: error.code
      };
    }

    if (error.response) {
      return {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };
    }

    return {
      message: (error instanceof Error ? error.message : String(error)),
      code: error.code
    };
  }

  /**
   * 格式化 OpenAI 错误
   */
  private formatOpenAIError(error: any): ApiError {
    if (error.status) {
      switch (error.status) {
        case 401:
          return new ApiError({
            code: 'UNAUTHORIZED',
            message: 'OpenAI API 密钥无效或已过期',
            statusCode: 401
          });
        
        case 403:
          return new ApiError({
            code: 'FORBIDDEN',
            message: 'OpenAI API 访问被拒绝，请检查权限',
            statusCode: 403
          });
        
        case 429:
          return new ApiError({
            code: 'RATE_LIMITED',
            message: 'OpenAI API 请求频率超限，请稍后重试',
            statusCode: 429,
            retryAfter: 60000 // 建议1分钟后重试
          });
        
        case 500:
        case 502:
        case 503:
        case 504:
          return new ApiError({
            code: 'SERVER_ERROR',
            message: 'OpenAI 服务器错误，请稍后重试',
            statusCode: error.status
          });
        
        default:
          return new ApiError({
            code: 'OPENAI_ERROR',
            message: `OpenAI API 错误: ${(error instanceof Error ? error.message : String(error)) || '未知错误'}`,
            statusCode: error.status
          });
      }
    }

    if (error.code) {
      switch (error.code) {
        case 'ECONNRESET':
          return new ApiError({
            code: 'CONNECTION_RESET',
            message: 'OpenAI 连接被重置，请检查网络连接'
          });
        
        case 'ETIMEDOUT':
          return new ApiError({
            code: 'TIMEOUT',
            message: 'OpenAI 请求超时，请稍后重试'
          });
        
        case 'ENOTFOUND':
          return new ApiError({
            code: 'DNS_ERROR',
            message: 'OpenAI 域名解析失败，请检查网络连接'
          });
        
        default:
          return new ApiError({
            code: 'NETWORK_ERROR',
            message: `OpenAI 网络错误: ${(error instanceof Error ? error.message : String(error))}`
          });
      }
    }

    return new ApiError({
      code: 'UNKNOWN_ERROR',
      message: `OpenAI 未知错误: ${(error instanceof Error ? error.message : String(error)) || '请求失败'}`
    });
  }

  /**
   * 获取客户端状态
   */
  getStatus(): { validated: boolean; serviceName: string } {
    return {
      validated: this.isValidated,
      serviceName: 'OpenAI'
    };
  }
}

// 创建单例实例
export const openaiClient = new OpenAIClient();