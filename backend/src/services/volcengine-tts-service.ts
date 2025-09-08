import axios, { AxiosInstance } from 'axios';
import { environment } from '../config/environment';
import { logger } from '../config/logger';
import crypto from 'crypto';
import { createVolcengineAuth, VolcengineAuthUtil } from '../utils/volcengine-auth';

/**
 * 火山引擎TTS语音合成服务
 * 替代GLM-4-voice和ElevenLabs，提供高质量的语音合成服务
 */

// 火山引擎TTS请求接口
export interface VolcengineTTSRequest {
  app: {
    appid: string;
    token: string;
    cluster: string;
  };
  user: {
    uid: string;
  };
  audio: {
    voice_type: string;
    encoding: 'mp3' | 'wav' | 'pcm';
    speed_ratio?: number;
    volume_ratio?: number;
    pitch_ratio?: number;
    emotion?: string;
    language?: string;
  };
  request: {
    reqid: string;
    text: string;
    text_type: 'plain' | 'ssml';
    operation: 'submit' | 'query';
  };
}

// 火山引擎TTS响应接口
export interface VolcengineTTSResponse {
  code: number;
  message: string;
  reqid: string;
  data?: {
    audio?: string; // base64编码的音频数据
    audio_url?: string; // 音频文件URL
    duration?: number; // 音频时长（秒）
  };
}

// 语音配置选项
export interface VoiceOptions {
  voice?: string; // 音色类型
  speed?: number; // 语速 (0.5-2.0)
  volume?: number; // 音量 (0.1-3.0) 
  pitch?: number; // 音调 (0.5-2.0)
  emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'surprised';
  language?: 'zh' | 'en' | 'ja' | 'ko';
  encoding?: 'mp3' | 'wav' | 'pcm';
}

// 火山引擎TTS服务配置
export interface VolcengineTTSConfig {
  apiKey: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  baseUrl: string;
  appId: string;
  cluster: string;
  region?: string;
  timeout: number;
  maxRetries: number;
}

/**
 * 火山引擎TTS服务类
 */
export class VolcengineTTSService {
  private httpClient: AxiosInstance;
  private config: VolcengineTTSConfig;
  private authUtil?: VolcengineAuthUtil;
  private audioCache: Map<string, Buffer> = new Map();
  private readonly MAX_CACHE_SIZE = 100; // 最大缓存条目数

  constructor() {
    this.config = {
      apiKey: environment.voice.volcengine.apiKey,
      accessKeyId: environment.voice.volcengine.accessKeyId,
      secretAccessKey: environment.voice.volcengine.secretAccessKey,
      baseUrl: environment.voice.volcengine.baseUrl,
      appId: environment.voice.volcengine.appId,
      cluster: environment.voice.volcengine.cluster,
      region: environment.voice.volcengine.region,
      timeout: 30000,
      maxRetries: 3
    };

    // 验证配置
    this.validateConfig();

    // 初始化认证工具
    if (this.config.accessKeyId && this.config.secretAccessKey) {
      this.authUtil = createVolcengineAuth({
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        region: this.config.region || 'cn-north-1',
        service: 'tts'
      });
      logger.info('使用 Access Key 认证方式', {
        accessKeyId: this.config.accessKeyId.substring(0, 8) + '...'
      });
    }

    // 初始化HTTP客户端
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WordPecker-TTS/1.0'
      }
    });

    // 添加请求和响应拦截器
    this.setupInterceptors();
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    // 检查认证方式
    const hasAccessKey = this.config.accessKeyId && this.config.secretAccessKey;
    const hasApiKey = this.config.apiKey;

    if (!hasAccessKey && !hasApiKey) {
      throw new Error('火山引擎API密钥未配置，请设置 VOLCENGINE_ACCESS_KEY_ID + VOLCENGINE_SECRET_ACCESS_KEY 或 VOLCENGINE_API_KEY 环境变量');
    }

    if (!this.config.appId) {
      throw new Error('火山引擎应用ID未配置，请设置 VOLCENGINE_APP_ID 环境变量');
    }

    logger.info('火山引擎TTS服务配置验证成功', {
      baseUrl: this.config.baseUrl,
      appId: this.config.appId,
      cluster: this.config.cluster,
      region: this.config.region,
      hasApiKey: !!this.config.apiKey,
      hasAccessKey: !!hasAccessKey
    });
  }

  /**
   * 设置HTTP拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug('火山引擎TTS请求', {
          url: config.url,
          method: config.method
        });
        return config;
      },
      (error) => {
        logger.error('火山引擎TTS请求错误', { error });
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('火山引擎TTS响应成功', {
          status: response.status
        });
        return response;
      },
      (error) => {
        const errorInfo = {
          status: error.response?.status,
          message: error.response?.data?.message || (error instanceof Error ? error.message : String(error)),
          url: error.config?.url
        };
        logger.error('火山引擎TTS响应错误', errorInfo);
        return Promise.reject(this.handleAPIError(error));
      }
    );
  }

  /**
   * 生成语音
   */
  async generateSpeech(
    text: string,
    options: VoiceOptions = {}
  ): Promise<Buffer> {
    // 检查缓存
    const cacheKey = this.generateCacheKey(text, options);
    const cached = this.audioCache.get(cacheKey);
    if (cached) {
      logger.debug('从缓存返回语音', { cacheKey, size: cached.length });
      return cached;
    }

    try {
      logger.info('火山引擎TTS生成语音', {
        textLength: text.length,
        voice: options.voice,
        language: options.language
      });

      // 构建请求
      const request = this.buildTTSRequest(text, options);

      // 提交TTS任务
      const audioBuffer = await this.processTTSRequest(request);

      // 添加到缓存
      this.addToCache(cacheKey, audioBuffer);

      logger.info('火山引擎TTS生成成功', {
        textLength: text.length,
        audioSize: audioBuffer.length
      });

      return audioBuffer;

    } catch (error: any) {
      logger.error('火山引擎TTS生成失败', {
        error: (error instanceof Error ? error.message : String(error)),
        textLength: text.length
      });
      throw error;
    }
  }

  /**
   * 流式语音生成
   */
  async *generateSpeechStream(
    text: string,
    options: VoiceOptions = {}
  ): AsyncGenerator<Buffer, void, unknown> {
    // 将长文本分段处理
    const segments = this.splitText(text);
    
    for (const segment of segments) {
      if (segment.trim()) {
        const audioBuffer = await this.generateSpeech(segment, options);
        yield audioBuffer;
      }
    }
  }

  /**
   * 构建TTS请求
   */
  private buildTTSRequest(text: string, options: VoiceOptions): VolcengineTTSRequest {
    const reqid = this.generateRequestId();
    
    return {
      app: {
        appid: this.config.appId,
        token: this.config.apiKey,
        cluster: this.config.cluster
      },
      user: {
        uid: `wordpecker_${Date.now()}`
      },
      audio: {
        voice_type: this.getVoiceType(options.voice, options.language),
        encoding: options.encoding || 'mp3',
        speed_ratio: this.clampValue(options.speed || 1.0, 0.5, 2.0),
        volume_ratio: this.clampValue(options.volume || 1.0, 0.1, 3.0),
        pitch_ratio: this.clampValue(options.pitch || 1.0, 0.5, 2.0),
        emotion: options.emotion || 'neutral',
        language: options.language || 'zh'
      },
      request: {
        reqid,
        text,
        text_type: 'plain',
        operation: 'submit'
      }
    };
  }

  /**
   * 处理TTS请求
   */
  private async processTTSRequest(request: VolcengineTTSRequest): Promise<Buffer> {
    const submitUrl = `${this.config.baseUrl}/api/v1/tts/submit`;
    const queryUrl = `${this.config.baseUrl}/api/v1/tts/query`;
    
    // 提交任务
    let submitResponse;
    if (this.authUtil) {
      // 使用 Access Key 认证
      const signedRequest = this.authUtil.signRequest(
        'POST',
        submitUrl,
        { 'Content-Type': 'application/json' },
        JSON.stringify(request)
      );
      
      submitResponse = await this.httpClient.post(
        '/api/v1/tts/submit',
        request,
        { headers: signedRequest.headers }
      );
    } else {
      // 使用传统 API Key 认证
      submitResponse = await this.httpClient.post<VolcengineTTSResponse>(
        '/api/v1/tts/submit',
        request
      );
    }

    if (submitResponse.data.code !== 0) {
      throw new Error(`TTS提交失败: ${submitResponse.data.message}`);
    }

    // 查询结果
    const queryRequest = {
      ...request,
      request: {
        ...request.request,
        operation: 'query' as const
      }
    };

    let attempts = 0;
    const maxAttempts = 15; // 最多等待15秒
    
    while (attempts < maxAttempts) {
      await this.sleep(1000); // 等待1秒
      
      try {
        let queryResponse;
        if (this.authUtil) {
          // 使用 Access Key 认证
          const signedRequest = this.authUtil.signRequest(
            'POST',
            queryUrl,
            { 'Content-Type': 'application/json' },
            JSON.stringify(queryRequest)
          );
          
          queryResponse = await this.httpClient.post(
            '/api/v1/tts/query',
            queryRequest,
            { headers: signedRequest.headers }
          );
        } else {
          // 使用传统 API Key 认证
          queryResponse = await this.httpClient.post<VolcengineTTSResponse>(
            '/api/v1/tts/query',
            queryRequest
          );
        }

        if (queryResponse.data.code === 0 && queryResponse.data.data?.audio) {
          // 解码base64音频数据
          const audioBuffer = Buffer.from(queryResponse.data.data.audio, 'base64');
          return audioBuffer;
        }
        
        if (queryResponse.data.code === 10001) {
          // 仍在处理中，继续等待
          attempts++;
          continue;
        }
        
        throw new Error(`TTS查询失败: ${queryResponse.data.message}`);

      } catch (error: any) {
        if (attempts >= maxAttempts - 1) {
          throw error;
        }
        attempts++;
      }
    }
    
    throw new Error('TTS处理超时');
  }

  /**
   * 获取音色类型
   */
  private getVoiceType(requestedVoice?: string, language?: string): string {
    if (requestedVoice) {
      return requestedVoice;
    }

    // 根据语言选择默认音色
    const voiceMap: Record<string, string> = {
      'zh': 'BV700_streaming',     // 中文女声
      'zh-CN': 'BV700_streaming',
      'en': 'BV001_streaming',     // 英文女声
      'en-US': 'BV001_streaming',
      'ja': 'BV002_streaming',     // 日文女声
      'ko': 'BV003_streaming',     // 韩文女声
    };
    
    return voiceMap[language || 'zh'] || 'BV700_streaming';
  }

  /**
   * 获取支持的音色列表
   */
  getSupportedVoices(): Record<string, string[]> {
    return {
      'zh': [
        'BV700_streaming', // 中文女声1
        'BV701_streaming', // 中文女声2
        'BV002_streaming', // 中文男声1
        'BV003_streaming', // 中文男声2
      ],
      'en': [
        'BV001_streaming', // 英文女声1
        'BV004_streaming', // 英文女声2
        'BV005_streaming', // 英文男声1
        'BV006_streaming', // 英文男声2
      ],
      'ja': [
        'BV002_streaming', // 日文女声
        'BV007_streaming', // 日文男声
      ],
      'ko': [
        'BV003_streaming', // 韩文女声
        'BV008_streaming', // 韩文男声
      ]
    };
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(text: string, options: VoiceOptions): string {
    const key = `${text}_${JSON.stringify(options)}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  /**
   * 添加到缓存
   */
  private addToCache(key: string, data: Buffer): void {
    // 如果缓存已满，删除最老的条目
    if (this.audioCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.audioCache.keys().next().value;
      if (firstKey) {
        this.audioCache.delete(firstKey);
      }
    }
    
    this.audioCache.set(key, data);
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `wordpecker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 分割长文本
   */
  private splitText(text: string, maxLength: number = 200): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const segments: string[] = [];
    let current = '';
    
    // 按句子分割
    const sentences = text.split(/[.!?。！？]+/);
    
    for (const sentence of sentences) {
      if (current.length + sentence.length <= maxLength) {
        current += sentence;
      } else {
        if (current) {
          segments.push(current);
        }
        current = sentence;
      }
    }
    
    if (current) {
      segments.push(current);
    }
    
    return segments;
  }

  /**
   * 限制数值范围
   */
  private clampValue(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 处理API错误
   */
  private handleAPIError(error: any): Error {
    if (error.response?.data?.message) {
      return new Error(`火山引擎TTS错误: ${error.response.data.message}`);
    }

    if (error.code === 'ECONNABORTED') {
      return new Error('火山引擎TTS请求超时');
    }

    if (error.response?.status === 401) {
      return new Error('火山引擎TTS认证失败，请检查API密钥配置');
    }

    if (error.response?.status === 429) {
      return new Error('火山引擎TTS请求频率过高，请稍后重试');
    }

    if (error.response?.status >= 500) {
      return new Error('火山引擎TTS服务器错误，请稍后重试');
    }

    return new Error(`火山引擎TTS未知错误: ${(error instanceof Error ? error.message : String(error))}`);
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus(): Promise<{
    available: boolean;
    latency?: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // 发送简单的测试请求
      await this.generateSpeech('测试', {
        voice: 'BV700_streaming',
        speed: 1.0
      });

      const latency = Date.now() - startTime;

      return {
        available: true,
        latency
      };

    } catch (error: any) {
      return {
        available: false,
        error: (error instanceof Error ? error.message : String(error))
      };
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.audioCache.clear();
    logger.info('火山引擎TTS缓存已清空');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.audioCache.size,
      maxSize: this.MAX_CACHE_SIZE
    };
  }
}

// 单例实例
let volcengineTTSServiceInstance: VolcengineTTSService | null = null;

/**
 * 获取火山引擎TTS服务实例
 */
export function getVolcengineTTSService(): VolcengineTTSService {
  if (!volcengineTTSServiceInstance) {
    volcengineTTSServiceInstance = new VolcengineTTSService();
  }
  return volcengineTTSServiceInstance;
}

// 导出默认实例
export default getVolcengineTTSService;