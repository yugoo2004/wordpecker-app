import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { environment } from '../config/environment';
import { logger } from '../config/logger';
import { createVolcengineAuth, VolcengineAuthUtil } from '../utils/volcengine-auth';

/**
 * 豆包1.6模型服务适配器
 * 使用火山引擎API接口，提供与OpenAI兼容的文本生成服务
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

// 豆包API请求接口（支持多模态）
export interface DoubaoRequest {
  model: string;
  messages: Array<MultiModalMessage | TextMessage>;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
}

// 多模态请求专用接口
export interface DoubaoMultiModalRequest {
  model: string;
  messages: MultiModalMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
}

// 豆包API响应接口
export interface DoubaoResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter' | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// 错误响应接口
export interface DoubaoError {
  error: {
    message: string;
    type: string;
    code?: string;
  };
}

// 豆包服务配置
export interface DoubaoConfig {
  apiKey: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  baseUrl: string;
  endpoint: string; // 豆包端点ID
  model: string;
  region: 'cn-beijing' | 'us-east-1';
  timeout: number;
  maxRetries: number;
}

/**
 * 豆包服务类
 */
export class DoubaoService {
  private httpClient: AxiosInstance;
  private config: DoubaoConfig;
  private authUtil?: VolcengineAuthUtil;

  constructor() {
    this.config = {
      apiKey: environment.ai.doubao.apiKey,
      accessKeyId: environment.ai.doubao.accessKeyId,
      secretAccessKey: environment.ai.doubao.secretAccessKey,
      baseUrl: environment.ai.doubao.baseUrl,
      endpoint: environment.ai.doubao.endpoint,
      model: environment.ai.doubao.model,
      region: environment.ai.doubao.region as 'cn-beijing' | 'us-east-1',
      timeout: 30000,
      maxRetries: 3
    };

    // 验证配置
    this.validateConfig();

    // 初始化认证工具（支持ARK API Key和Access Key两种方式）
    if (this.config.accessKeyId && this.config.secretAccessKey) {
      this.authUtil = createVolcengineAuth({
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        region: this.config.region,
        service: 'ml_maas'
      });
      logger.info('豆包服务使用 Access Key 认证方式', {
        accessKeyId: this.config.accessKeyId.substring(0, 8) + '...'
      });
    }

    // 初始化HTTP客户端
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'WordPecker/1.0'
    };
    
    // 优先使用ARK API Key进行Bearer token认证
    if (this.config.apiKey) {
      defaultHeaders['Authorization'] = `Bearer ${this.config.apiKey}`;
      logger.info('豆包服务使用 ARK API Key 认证方式');
    }
    
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: defaultHeaders
    });

    // 请求拦截器
    this.httpClient.interceptors.request.use(
      async (config) => {
        // 优先使用ARK API Key认证（OpenAI兼容方式）
        if (this.config.apiKey) {
          // 使用Bearer token认证（标准OpenAI方式）
          if (config.headers) {
            config.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          }
          
          logger.debug('豆包API请求（ARK API Key认证）', {
            url: config.url,
            method: config.method,
            hasApiKey: true
          });
        } else if (this.authUtil && config.url && config.method) {
          // 使用Access Key签名认证（降级方式）
          const fullUrl = `${this.config.baseUrl}${config.url}`;
          const body = config.data ? JSON.stringify(config.data) : undefined;
          
          const signedRequest = this.authUtil.signRequest(
            config.method.toUpperCase(),
            fullUrl,
            {
              'Content-Type': 'application/json',
              'User-Agent': 'WordPecker/1.0'
            },
            body
          );
          
          // 使用签名后的headers
          Object.assign(config.headers, signedRequest.headers);
          
          // 移除Bearer token，使用签名认证
          if (config.headers && 'Authorization' in config.headers) {
            delete config.headers['Authorization'];
          }
          
          logger.debug('豆包API请求（Access Key签名认证）', {
            url: config.url,
            method: config.method,
            hasSignature: true
          });
        } else {
          logger.warn('豆包API请求缺少认证信息', {
            url: config.url,
            method: config.method,
            hasApiKey: !!this.config.apiKey,
            hasAuthUtil: !!this.authUtil
          });
        }
        
        return config;
      },
      (error) => {
        logger.error('豆包API请求错误', { error });
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('豆包API响应成功', {
          status: response.status,
          dataSize: JSON.stringify(response.data).length
        });
        return response;
      },
      (error) => {
        const errorInfo = {
          status: error.response?.status,
          message: error.response?.data?.error?.message || (error instanceof Error ? error.message : String(error)),
          url: error.config?.url
        };
        logger.error('豆包API响应错误', errorInfo);
        return Promise.reject(this.handleAPIError(error));
      }
    );
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    // 检查认证方式
    const hasAccessKey = this.config.accessKeyId && this.config.secretAccessKey;
    const hasApiKey = this.config.apiKey;

    if (!hasAccessKey && !hasApiKey) {
      throw new Error('豆包API密钥未配置，请设置 VOLCENGINE_ACCESS_KEY_ID + VOLCENGINE_SECRET_ACCESS_KEY 或 DOUBAO_API_KEY 环境变量');
    }

    if (!this.config.endpoint) {
      throw new Error('豆包端点ID未配置，请设置 DOUBAO_ENDPOINT 环境变量');
    }

    logger.info('豆包服务配置验证成功', {
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      region: this.config.region,
      hasApiKey: !!this.config.apiKey,
      hasAccessKey: !!hasAccessKey,
      hasEndpoint: !!this.config.endpoint
    });
  }

  /**
   * 创建多模态聊天完成
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
  ): Promise<DoubaoResponse> {
    const request: DoubaoMultiModalRequest = {
      model: this.config.endpoint, // 使用端点ID作为模型
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2000,
      top_p: options.top_p ?? 0.9,
      stream: options.stream ?? false,
      stop: options.stop
    };

    try {
      logger.info('豆包多模态聊天完成请求', {
        messagesCount: messages.length,
        hasImages: messages.some(msg => 
          Array.isArray(msg.content) && 
          msg.content.some(content => content.type === 'image_url')
        ),
        temperature: request.temperature,
        maxTokens: request.max_tokens,
        model: request.model
      });

      const response: AxiosResponse<DoubaoResponse> = await this.httpClient.post(
        '/chat/completions',
        request
      );

      const result = response.data;

      // 验证响应格式
      if (!this.validateResponse(result)) {
        throw new Error('豆包API返回格式无效');
      }

      logger.info('豆包多模态聊天完成成功', {
        messageLength: result.choices[0]?.message?.content?.length || 0,
        tokensUsed: result.usage?.total_tokens || 0,
        finishReason: result.choices[0]?.finish_reason
      });

      return result;

    } catch (error: any) {
      logger.error('豆包多模态聊天完成失败', {
        error: (error instanceof Error ? error.message : String(error)),
        messagesCount: messages.length
      });
      throw error;
    }
  }

  /**
   * 分析图像内容
   */
  async analyzeImage(
    imageUrl: string,
    prompt: string = '请分析这张图片并描述其主要内容。',
    options: {
      temperature?: number;
      max_tokens?: number;
      detail?: 'low' | 'high' | 'auto';
    } = {}
  ): Promise<DoubaoResponse> {
    const messages: MultiModalMessage[] = [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: options.detail || 'auto'
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ];

    try {
      logger.info('豆包图像分析请求', {
        imageUrl: imageUrl.substring(0, 100) + '...',
        promptLength: prompt.length,
        detail: options.detail
      });

      const result = await this.createMultiModalCompletion(messages, {
        temperature: options.temperature ?? 0.3, // 较低的温度保证准确性
        max_tokens: options.max_tokens ?? 1000
      });

      logger.info('豆包图像分析成功', {
        analysisLength: result.choices[0]?.message?.content?.length || 0
      });

      return result;

    } catch (error: any) {
      logger.error('豆包图像分析失败', {
        error: (error instanceof Error ? error.message : String(error)),
        imageUrl: imageUrl.substring(0, 100) + '...'
      });
      throw error;
    }
  }

  /**
   * 基于图像生成词汇学习内容
   */
  async generateVocabularyFromImage(
    imageUrl: string,
    targetLanguage: string = 'english',
    difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate',
    options: {
      wordCount?: number;
      includeExamples?: boolean;
      includePronunciation?: boolean;
    } = {}
  ): Promise<DoubaoResponse> {
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

    try {
      logger.info('豆包图像词汇生成请求', {
        imageUrl: imageUrl.substring(0, 100) + '...',
        targetLanguage,
        difficulty,
        wordCount
      });

      const result = await this.analyzeImage(imageUrl, prompt, {
        temperature: 0.5, // 适中的创造性
        max_tokens: 2000
      });

      logger.info('豆包图像词汇生成成功');
      return result;

    } catch (error: any) {
      logger.error('豆包图像词汇生成失败', {
        error: (error instanceof Error ? error.message : String(error)),
        targetLanguage,
        difficulty
      });
      throw error;
    }
  }

  /**
   * 创建聊天完成（向后兼容）
   */
  async createChatCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      stream?: boolean;
      stop?: string | string[];
    } = {}
  ): Promise<DoubaoResponse> {
    // 转换为多模态格式
    const multiModalMessages: MultiModalMessage[] = messages.map(msg => ({
      role: msg.role,
      content: [{
        type: 'text',
        text: msg.content
      }]
    }));

    return this.createMultiModalCompletion(multiModalMessages, options);
  }
  async *createStreamCompletion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
      stop?: string | string[];
    } = {}
  ): AsyncGenerator<string, void, unknown> {
    const request: DoubaoRequest = {
      model: this.config.endpoint,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 2000,
      top_p: options.top_p ?? 0.9,
      stream: true,
      stop: options.stop
    };

    try {
      logger.info('豆包流式聊天完成请求', {
        messagesCount: messages.length,
        model: request.model
      });

      const response = await this.httpClient.post('/chat/completions', request, {
        responseType: 'stream',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        }
      });

      // 处理流式响应
      const stream = response.data;
      let buffer = '';

      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (parseError) {
              logger.warn('豆包流式响应解析失败', { data, error: parseError });
            }
          }
        }
      }

    } catch (error: any) {
      logger.error('豆包流式聊天完成失败', { error: (error instanceof Error ? error.message : String(error)) });
      throw error;
    }
  }

  /**
   * 验证响应格式
   */
  private validateResponse(response: any): response is DoubaoResponse {
    return (
      response &&
      typeof response === 'object' &&
      response.choices &&
      Array.isArray(response.choices) &&
      response.choices.length > 0 &&
      response.choices[0].message &&
      typeof response.choices[0].message.content === 'string'
    );
  }

  /**
   * 处理API错误
   */
  private handleAPIError(error: any): Error {
    if (error.response?.data?.error) {
      const doubaoError = error.response.data as DoubaoError;
      return new Error(`豆包API错误: ${doubaoError.error.message} (${doubaoError.error.type})`);
    }

    if (error.code === 'ECONNABORTED') {
      return new Error('豆包API请求超时');
    }

    if (error.response?.status === 401) {
      return new Error('豆包API认证失败，请检查API密钥和端点配置');
    }

    if (error.response?.status === 429) {
      return new Error('豆包API请求频率过高，请稍后重试');
    }

    if (error.response?.status >= 500) {
      return new Error('豆包API服务器错误，请稍后重试');
    }

    return new Error(`豆包API未知错误: ${(error instanceof Error ? error.message : String(error))}`);
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
      await this.createChatCompletion([
        { role: 'user', content: '你好' }
      ], {
        max_tokens: 10,
        temperature: 0.1
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
   * 获取服务配置信息（脱敏）
   */
  getConfig(): Partial<DoubaoConfig> {
    return {
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      region: this.config.region,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    };
  }
}

// 单例实例
let doubaoServiceInstance: DoubaoService | null = null;

/**
 * 获取豆包服务实例
 */
export function getDoubaoService(): DoubaoService {
  if (!doubaoServiceInstance) {
    doubaoServiceInstance = new DoubaoService();
  }
  return doubaoServiceInstance;
}

// 导出默认实例
export default getDoubaoService;