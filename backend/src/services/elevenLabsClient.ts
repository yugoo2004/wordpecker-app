import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { ApiClient, createApiClient, ApiError } from './apiClient';
import { environment } from '../config/environment';
import { logger } from '../config/logger';

/**
 * ElevenLabs API 错误处理和重试机制
 */
export class EnhancedElevenLabsClient {
  private client: ElevenLabsClient | null = null;
  private apiClient: ApiClient;
  private isValidated: boolean = false;
  private isAvailable: boolean = false;

  constructor() {
    // 创建通用 API 客户端用于验证和监控
    this.apiClient = createApiClient('ElevenLabs', {
      baseURL: 'https://api.elevenlabs.io/v1',
      timeout: 60000,
      headers: {
        'xi-api-key': environment.elevenlabs.apiKey || ''
      }
    });

    // 检查 API 密钥是否可用
    if (environment.elevenlabs.apiKey) {
      this.client = new ElevenLabsClient({
        apiKey: environment.elevenlabs.apiKey
      });

      this.isAvailable = true;
    } else {
      logger.warn('ElevenLabs API 密钥未配置，语音功能将不可用');
      this.isAvailable = false;
    }
  }

  /**
   * 检查服务是否可用
   */
  isServiceAvailable(): boolean {
    return this.isAvailable && this.client !== null;
  }

  /**
   * 验证 ElevenLabs API 密钥
   */
  async validateApiKey(): Promise<boolean> {
    if (!this.isServiceAvailable()) {
      logger.warn('ElevenLabs 服务不可用，跳过验证');
      return false;
    }

    try {
      // 使用用户信息端点验证密钥
      const isValid = await this.apiClient.validateApiKey('/user');
      this.isValidated = isValid;
      
      if (isValid) {
        logger.info('ElevenLabs API 密钥验证成功');
      } else {
        logger.error('ElevenLabs API 密钥验证失败');
      }
      
      return isValid;
    } catch (error) {
      logger.error('ElevenLabs API 密钥验证失败', { error });
      this.isValidated = false;
      return false;
    }
  }

  /**
   * 文字转语音，包含错误处理和重试
   */
  async textToSpeech(
    voiceId: string,
    params: {
      text: string;
      modelId?: string;
      voiceSettings?: {
        stability?: number;
        similarityBoost?: number;
        style?: number;
        useSpeakerBoost?: boolean;
      };
    }
  ): Promise<ReadableStream<Uint8Array>> {
    if (!this.isServiceAvailable()) {
      throw new ApiError({
        code: 'SERVICE_UNAVAILABLE',
        message: 'ElevenLabs 服务不可用，请检查 API 密钥配置'
      });
    }

    await this.ensureValidated();

    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        const audioResponse = await this.client!.textToSpeech.convert(voiceId, {
          text: params.text,
          modelId: params.modelId || 'eleven_multilingual_v2',
          voiceSettings: {
            stability: 0.5,
            similarityBoost: 0.8,
            style: 0.0,
            useSpeakerBoost: true,
            ...params.voiceSettings
          }
        });
        
        logger.info('ElevenLabs 文字转语音请求成功', {
          voiceId,
          textLength: params.text.length,
          model: params.modelId || 'eleven_multilingual_v2',
          duration: Date.now() - startTime,
          attempt: attempt + 1
        });

        return audioResponse;
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries && this.shouldRetryElevenLabsError(error)) {
          const delay = this.calculateRetryDelay(attempt);
          
          logger.warn(`ElevenLabs 请求失败，${delay}ms 后重试`, {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            error: this.extractElevenLabsErrorInfo(error),
            delay
          });
          
          await this.sleep(delay);
          continue;
        }

        logger.error('ElevenLabs 文字转语音请求失败', {
          voiceId,
          textLength: params.text.length,
          attempt: attempt + 1,
          error: this.extractElevenLabsErrorInfo(error)
        });

        throw this.formatElevenLabsError(error);
      }
    }

    throw this.formatElevenLabsError(lastError);
  }

  /**
   * 获取可用语音列表，包含错误处理和重试
   */
  async getVoices(): Promise<any[]> {
    if (!this.isServiceAvailable()) {
      logger.warn('ElevenLabs 服务不可用，返回空语音列表');
      return [];
    }

    await this.ensureValidated();

    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const voicesResponse = await this.client!.voices.getAll();
        
        logger.info('ElevenLabs 获取语音列表成功', {
          voiceCount: voicesResponse.voices.length,
          duration: Date.now() - startTime,
          attempt: attempt + 1
        });

        return voicesResponse.voices;
      } catch (error: any) {
        lastError = error;
        
        if (attempt < maxRetries && this.shouldRetryElevenLabsError(error)) {
          const delay = this.calculateRetryDelay(attempt);
          
          logger.warn(`ElevenLabs 获取语音列表失败，${delay}ms 后重试`, {
            attempt: attempt + 1,
            maxRetries: maxRetries + 1,
            error: this.extractElevenLabsErrorInfo(error),
            delay
          });
          
          await this.sleep(delay);
          continue;
        }

        logger.error('ElevenLabs 获取语音列表失败', {
          attempt: attempt + 1,
          error: this.extractElevenLabsErrorInfo(error)
        });

        // 对于语音列表获取失败，返回空数组而不是抛出错误
        logger.warn('返回空语音列表作为降级处理');
        return [];
      }
    }

    logger.warn('返回空语音列表作为降级处理');
    return [];
  }

  /**
   * 获取用户信息，包含错误处理
   */
  async getUserInfo(): Promise<any | null> {
    if (!this.isServiceAvailable()) {
      return null;
    }

    try {
      const userInfo = await this.apiClient.request({
        method: 'GET',
        url: '/user'
      });
      
      logger.info('ElevenLabs 获取用户信息成功');
      return userInfo;
    } catch (error) {
      logger.error('ElevenLabs 获取用户信息失败', { error });
      return null;
    }
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
          message: 'ElevenLabs API 密钥无效，请检查配置'
        });
      }
    }
  }

  /**
   * 判断是否应该重试 ElevenLabs 错误
   */
  private shouldRetryElevenLabsError(error: any): boolean {
    // HTTP 状态码错误
    if (error.response?.status) {
      const retryableStatuses = [429, 500, 502, 503, 504];
      return retryableStatuses.includes(error.response.status);
    }

    // 直接状态码
    if (error.status) {
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
   * 提取 ElevenLabs 错误信息
   */
  private extractElevenLabsErrorInfo(error: any): any {
    if (error.response) {
      return {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };
    }

    if (error.status && (error instanceof Error ? error.message : String(error))) {
      return {
        status: error.status,
        message: (error instanceof Error ? error.message : String(error))
      };
    }

    return {
      message: (error instanceof Error ? error.message : String(error)),
      code: error.code
    };
  }

  /**
   * 格式化 ElevenLabs 错误
   */
  private formatElevenLabsError(error: any): ApiError {
    const status = error.response?.status || error.status;
    
    if (status) {
      switch (status) {
        case 401:
          return new ApiError({
            code: 'UNAUTHORIZED',
            message: 'ElevenLabs API 密钥无效或已过期',
            statusCode: 401
          });
        
        case 403:
          return new ApiError({
            code: 'FORBIDDEN',
            message: 'ElevenLabs API 访问被拒绝，请检查权限',
            statusCode: 403
          });
        
        case 429:
          return new ApiError({
            code: 'RATE_LIMITED',
            message: 'ElevenLabs API 请求频率超限，请稍后重试',
            statusCode: 429,
            retryAfter: 60000 // 建议1分钟后重试
          });
        
        case 422:
          return new ApiError({
            code: 'VALIDATION_ERROR',
            message: 'ElevenLabs API 请求参数无效',
            statusCode: 422,
            details: error.response?.data
          });
        
        case 500:
        case 502:
        case 503:
        case 504:
          return new ApiError({
            code: 'SERVER_ERROR',
            message: 'ElevenLabs 服务器错误，请稍后重试',
            statusCode: status
          });
        
        default:
          return new ApiError({
            code: 'ELEVENLABS_ERROR',
            message: `ElevenLabs API 错误: ${(error instanceof Error ? error.message : String(error)) || '未知错误'}`,
            statusCode: status
          });
      }
    }

    if (error.code) {
      switch (error.code) {
        case 'ECONNRESET':
          return new ApiError({
            code: 'CONNECTION_RESET',
            message: 'ElevenLabs 连接被重置，请检查网络连接'
          });
        
        case 'ETIMEDOUT':
          return new ApiError({
            code: 'TIMEOUT',
            message: 'ElevenLabs 请求超时，请稍后重试'
          });
        
        case 'ENOTFOUND':
          return new ApiError({
            code: 'DNS_ERROR',
            message: 'ElevenLabs 域名解析失败，请检查网络连接'
          });
        
        default:
          return new ApiError({
            code: 'NETWORK_ERROR',
            message: `ElevenLabs 网络错误: ${(error instanceof Error ? error.message : String(error))}`
          });
      }
    }

    return new ApiError({
      code: 'UNKNOWN_ERROR',
      message: `ElevenLabs 未知错误: ${(error instanceof Error ? error.message : String(error)) || '请求失败'}`
    });
  }

  /**
   * 获取客户端状态
   */
  getStatus(): { available: boolean; validated: boolean; serviceName: string } {
    return {
      available: this.isAvailable,
      validated: this.isValidated,
      serviceName: 'ElevenLabs'
    };
  }

  /**
   * 降级处理：当 ElevenLabs 不可用时的替代方案
   */
  getFallbackMessage(): string {
    return 'ElevenLabs 语音服务暂时不可用，请稍后重试或联系管理员配置 API 密钥';
  }
}

// 创建单例实例
export const elevenLabsClient = new EnhancedElevenLabsClient();