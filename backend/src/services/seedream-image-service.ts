import axios, { AxiosInstance } from 'axios';
import { environment } from '../config/environment';
import { logger } from '../config/logger';
import path from 'path';
import fs from 'fs/promises';
import { createVolcengineAuth, VolcengineAuthUtil } from '../utils/volcengine-auth';

/**
 * SeeDream 3.0图像生成服务
 * 替代DALL-E 3，提供高质量的图像生成服务
 */

// SeeDream 3.0 API请求接口（豆包图像生成）
export interface SeedreamRequest {
  model: string; // 'doubao-seedream-3-0-t2i-250415'
  prompt: string;
  response_format?: 'url' | 'b64_json';
  size?: '1024x1024' | '1280x720' | '720x1280' | '512x512';
  guidance_scale?: number; // 1-10, 推荐 3-7
  watermark?: boolean;
  n?: number; // 生成图片数量，默认 1
  style?: string; // 图像风格，可选
}

// SeeDream 3.0 API响应接口
export interface SeedreamResponse {
  id: string;
  object: 'image.generation';
  created: number;
  model: string;
  data: Array<{
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// 图像生成选项（SeeDream 3.0）
export interface ImageGenerationOptions {
  size?: '1024x1024' | '1280x720' | '720x1280' | '512x512';
  guidance_scale?: number; // 1-10，推荐 3-7
  watermark?: boolean;
  style?: string;
  count?: number;
  enhancePrompt?: boolean;
  saveToFile?: boolean;
  outputDir?: string;
  response_format?: 'url' | 'b64_json';
}

// SeeDream 服务配置（豆包版本）
export interface SeedreamConfig {
  apiKey: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  baseUrl: string; // 'https://ark.cn-beijing.volces.com/api/v3'
  model: string; // 'doubao-seedream-3-0-t2i-250415'
  timeout: number;
  maxRetries: number;
  defaultSize: string;
  defaultGuidanceScale: number;
  defaultWatermark: boolean;
}

// 图像生成结果
export interface ImageResult {
  url?: string;
  buffer?: Buffer;
  revisedPrompt?: string;
  filePath?: string;
  metadata: {
    originalPrompt: string;
    enhancedPrompt?: string;
    size: string;
    guidanceScale?: number;
    watermark?: boolean;
    style?: string;
    generatedAt: Date;
    source: 'seeddream' | 'pexels_fallback' | 'placeholder';
    pexelsId?: number;
    photographer?: string;
    modelUsed?: string;
    usage?: {
      prompt_tokens: number;
      total_tokens: number;
    };
  };
}

/**
 * SeeDream 3.0图像生成服务类
 */
export class SeedreamImageService {
  private httpClient: AxiosInstance;
  private config: SeedreamConfig;
  private authUtil?: VolcengineAuthUtil;
  private promptEnhancer: PromptEnhancer;

  constructor() {
    this.config = {
      apiKey: environment.image.seeddream.apiKey,
      accessKeyId: environment.image.seeddream.accessKeyId,
      secretAccessKey: environment.image.seeddream.secretAccessKey,
      baseUrl: environment.image.seeddream.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
      model: environment.image.seeddream.model || 'doubao-seedream-3-0-t2i-250415',
      timeout: environment.image.seeddream.timeoutMs || 60000,
      maxRetries: environment.image.seeddream.maxRetries || 3,
      defaultSize: '1024x1024',
      defaultGuidanceScale: 3,
      defaultWatermark: true
    };

    // 验证配置
    this.validateConfig();

    // 初始化认证工具
    if (this.config.accessKeyId && this.config.secretAccessKey) {
      this.authUtil = createVolcengineAuth({
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        region: 'cn-north-1',
        service: 'visual'
      });
      logger.info('SeeDream 3.0 服务使用 Access Key 认证方式', {
        accessKeyId: this.config.accessKeyId.substring(0, 8) + '...'
      });
    }

    // 初始化HTTP客户端
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'WordPecker-ImageGen/1.0'
      }
    });

    // 初始化提示词增强器
    this.promptEnhancer = new PromptEnhancer();

    // 设置拦截器
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
      throw new Error('SeeDream 3.0 API密钥未配置，请设置 VOLCENGINE_ACCESS_KEY_ID + VOLCENGINE_SECRET_ACCESS_KEY 或 SEEDREAM_API_KEY 环境变量');
    }

    logger.info('SeeDream 3.0图像生成服务配置验证成功', {
      baseUrl: this.config.baseUrl,
      model: this.config.model,
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
        logger.debug('SeeDream 3.0 API请求', {
          url: config.url,
          method: config.method
        });
        return config;
      },
      (error) => {
        logger.error('SeeDream 3.0 API请求错误', { error });
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug('SeeDream 3.0 API响应成功', {
          status: response.status
        });
        return response;
      },
      (error) => {
        const errorInfo = {
          status: error.response?.status,
          message: error.response?.data?.error?.message || (error instanceof Error ? error.message : String(error)),
          url: error.config?.url
        };
        logger.error('SeeDream API响应错误', errorInfo);
        return Promise.reject(this.handleAPIError(error));
      }
    );
  }

  /**
   * 生成图像
   */
  async generateImage(
    prompt: string,
    options: ImageGenerationOptions = {}
  ): Promise<ImageResult> {
    try {
      logger.info('SeeDream 3.0图像生成开始', {
        promptLength: prompt.length,
        size: options.size,
        guidanceScale: options.guidance_scale
      });

      // 增强提示词
      const enhancedPrompt = options.enhancePrompt 
        ? await this.promptEnhancer.enhance(prompt)
        : prompt;

      // 构建请求
      const request = this.buildImageRequest(enhancedPrompt, options);

      // 调用API
      const response = await this.httpClient.post<SeedreamResponse>(
        '/images/generations',
        request
      );

      if (!response.data.data || response.data.data.length === 0) {
        throw new Error('SeeDream 3.0 API返回空结果');
      }

      const imageData = response.data.data[0];
      const result: ImageResult = {
        url: imageData.url,
        revisedPrompt: imageData.revised_prompt,
        metadata: {
          originalPrompt: prompt,
          enhancedPrompt: enhancedPrompt !== prompt ? enhancedPrompt : undefined,
          size: options.size || this.config.defaultSize,
          guidanceScale: options.guidance_scale || this.config.defaultGuidanceScale,
          watermark: options.watermark ?? this.config.defaultWatermark,
          style: options.style,
          generatedAt: new Date(),
          source: 'seeddream',
          modelUsed: this.config.model,
          usage: response.data.usage
        }
      };

      // 如果需要下载到本地
      if (options.saveToFile && imageData.url) {
        const filePath = await this.downloadImage(
          imageData.url,
          options.outputDir || './generated-images'
        );
        result.filePath = filePath;
      }

      // 如果返回base64数据
      if (imageData.b64_json) {
        result.buffer = Buffer.from(imageData.b64_json, 'base64');
      }

      logger.info('SeeDream 3.0图像生成成功', {
        hasUrl: !!result.url,
        hasBuffer: !!result.buffer,
        hasFile: !!result.filePath
      });

      return result;

    } catch (error: any) {
      logger.error('SeeDream图像生成失败，尝试降级到Pexels图片', {
        error: (error instanceof Error ? error.message : String(error)),
        promptLength: prompt.length
      });
      
      // 降级到Pexels图片
      return await this.fallbackToPexelsImage(prompt, options);
    }
  }

  /**
   * 批量生成图像
   */
  async generateImages(
    prompt: string,
    count: number,
    options: ImageGenerationOptions = {}
  ): Promise<ImageResult[]> {
    const results: ImageResult[] = [];
    
    // SeeDream 3.0可能不支持一次生成多张，分批处理
    for (let i = 0; i < count; i++) {
      try {
        const result = await this.generateImage(prompt, {
          ...options,
          count: 1
        });
        results.push(result);
      } catch (error: any) {
        logger.warn(`第${i + 1}张图像生成失败`, { error: (error instanceof Error ? error.message : String(error)) });
        // 继续生成其他图像
      }
    }

    return results;
  }

  /**
   * 为词汇生成上下文图像
   */
  async generateVocabularyImage(
    word: string,
    context: string,
    options: ImageGenerationOptions = {}
  ): Promise<ImageResult> {
    // 构建专门的词汇学习提示词
    const prompt = this.buildVocabularyPrompt(word, context);
    
    return this.generateImage(prompt, {
      ...options,
      enhancePrompt: true,
      style: 'natural'
    });
  }

  /**
   * 为主题生成图像
   */
  async generateThemeImage(
    theme: string,
    words: string[],
    options: ImageGenerationOptions = {}
  ): Promise<ImageResult> {
    // 构建主题学习提示词
    const prompt = this.buildThemePrompt(theme, words);
    
    return this.generateImage(prompt, {
      ...options,
      enhancePrompt: true,
      style: 'vivid'
    });
  }

  /**
   * 构建图像生成请求（SeeDream 3.0）
   */
  private buildImageRequest(
    prompt: string,
    options: ImageGenerationOptions
  ): SeedreamRequest {
    return {
      model: this.config.model, // 'doubao-seedream-3-0-t2i-250415'
      prompt,
      response_format: options.response_format || (options.saveToFile ? 'url' : 'b64_json'),
      size: (options.size || this.config.defaultSize) as '1024x1024' | '1280x720' | '720x1280' | '512x512',
      guidance_scale: options.guidance_scale || this.config.defaultGuidanceScale,
      watermark: options.watermark ?? this.config.defaultWatermark,
      n: options.count || 1,
      style: options.style
    };
  }

  /**
   * 构建词汇学习提示词
   */
  private buildVocabularyPrompt(word: string, context: string): string {
    return `Create an educational illustration for the word "${word}" in the context: ${context}. 
    The image should be clear, visually appealing, and help language learners understand the meaning. 
    Style: educational, clean, colorful, suitable for language learning. 
    Avoid text in the image.`;
  }

  /**
   * 构建主题学习提示词
   */
  private buildThemePrompt(theme: string, words: string[]): string {
    const wordList = words.slice(0, 5).join(', '); // 限制词汇数量
    return `Create an educational scene illustrating the theme "${theme}" featuring elements related to: ${wordList}. 
    The image should be cohesive, educational, and visually engaging for language learners. 
    Style: vibrant, educational, comprehensive scene. 
    Avoid text in the image.`;
  }

  /**
   * 下载图像到本地
   */
  private async downloadImage(url: string, outputDir: string): Promise<string> {
    try {
      // 确保输出目录存在
      await fs.mkdir(outputDir, { recursive: true });

      // 下载图像
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data);

      // 生成文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `seeddream_${timestamp}.png`;
      const filePath = path.join(outputDir, fileName);

      // 保存文件
      await fs.writeFile(filePath, buffer);

      logger.debug('图像下载成功', { filePath, size: buffer.length });
      return filePath;

    } catch (error: any) {
      logger.error('图像下载失败', { url, error: (error instanceof Error ? error.message : String(error)) });
      throw new Error(`图像下载失败: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  /**
   * 验证图像URL
   */
  async validateImage(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, { timeout: 5000 });
      const contentType = response.headers['content-type'];
      return contentType?.startsWith('image/') || false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 处理API错误
   */
  private handleAPIError(error: any): Error {
    if (error.response?.data?.error?.message) {
      return new Error(`SeeDream 3.0 API错误: ${error.response.data.error.message}`);
    }

    if (error.code === 'ECONNABORTED') {
      return new Error('SeeDream 3.0 API请求超时');
    }

    if (error.response?.status === 401) {
      return new Error('SeeDream 3.0 API认证失败，请检查API密钥');
    }

    if (error.response?.status === 429) {
      return new Error('SeeDream API请求频率过高，请稍后重试');
    }

    if (error.response?.status >= 500) {
      return new Error('SeeDream API服务器错误，请稍后重试');
    }

    return new Error(`SeeDream 3.0 API未知错误: ${(error instanceof Error ? error.message : String(error))}`);
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
      await this.generateImage('test image', {
        size: '512x512',
        guidance_scale: 3
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
   * 获取支持的图像尺寸（SeeDream 3.0）
   */
  getSupportedSizes(): string[] {
    return ['1024x1024', '1280x720', '720x1280', '512x512'];
  }

  /**
   * 获取服务配置（SeeDream 3.0）
   */
  getConfig(): Partial<SeedreamConfig> {
    return {
      baseUrl: this.config.baseUrl,
      model: this.config.model,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      defaultSize: this.config.defaultSize,
      defaultGuidanceScale: this.config.defaultGuidanceScale,
      defaultWatermark: this.config.defaultWatermark
    };
  }

  /**
   * 降级到Pexels图片服务
   */
  private async fallbackToPexelsImage(
    prompt: string,
    options: ImageGenerationOptions
  ): Promise<ImageResult> {
    try {
      logger.info('SeeDream 3.0服务不可用，降级到Pexels图片服务');
      
      // 提取提示词中的关键词
      const keywords = this.extractKeywordsFromPrompt(prompt);
      
      // 使用简单的HTTP请求获取Pexels图片
      const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(keywords)}&per_page=1&orientation=landscape`;
      
      const response = await axios.get(pexelsUrl, {
        headers: {
          'Authorization': process.env.PEXELS_API_KEY || 'UogpOHFb4OKPxWQ5oWET62AhrmZyyMNZstS748cIG5X3r9kDGYzesayo'
        },
        timeout: 10000
      });
      
      if (response.data.photos && response.data.photos.length > 0) {
        const photo = response.data.photos[0];
        return {
          url: photo.src.large,
          revisedPrompt: `Stock photo: ${keywords}`,
          metadata: {
            originalPrompt: prompt,
            size: options.size || '1024x1024',
            guidanceScale: options.guidance_scale,
            watermark: false,
            generatedAt: new Date(),
            source: 'pexels_fallback',
            pexelsId: photo.id,
            photographer: photo.photographer
          }
        };
      }
      
      // 如果Pexels也失败，返回默认图片
      return this.getDefaultImage(prompt);
      
    } catch (pexelsError: any) {
      logger.warn('Pexels降级服务也失败，使用默认图片', {
        error: pexelsError.message
      });
      return this.getDefaultImage(prompt);
    }
  }

  /**
   * 从提示词中提取关键词
   */
  private extractKeywordsFromPrompt(prompt: string): string {
    // 简单的关键词提取逻辑
    const keywords = prompt
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(' ')
      .filter(word => word.length > 3 && !['create', 'image', 'generate', 'show', 'make'].includes(word))
      .slice(0, 3)
      .join(' ');
    
    return keywords || 'education';
  }

  /**
   * 获取默认图片
   */
  private getDefaultImage(prompt: string): ImageResult {
    return {
      url: 'https://via.placeholder.com/1024x1024/4F46E5/FFFFFF?text=SeeDream+3.0+Unavailable',
      revisedPrompt: '默认占位图片',
      metadata: {
        originalPrompt: prompt,
        size: '1024x1024',
        guidanceScale: 3,
        watermark: false,
        generatedAt: new Date(),
        source: 'placeholder'
      }
    };
  }
}

/**
 * 提示词增强器
 * 优化提示词以获得更好的图像生成效果
 */
class PromptEnhancer {
  private readonly stylePrompts = {
    educational: 'educational, clear, simple, instructional',
    artistic: 'artistic, creative, beautiful, aesthetic',
    realistic: 'photorealistic, detailed, high quality, professional',
    cartoon: 'cartoon style, colorful, friendly, approachable'
  };

  private readonly qualityPrompts = [
    'high quality',
    'detailed',
    'well composed',
    'professional',
    'clear and sharp'
  ];

  /**
   * 增强提示词
   */
  async enhance(originalPrompt: string): Promise<string> {
    // 检查提示词是否已经足够详细
    if (originalPrompt.length > 100) {
      return originalPrompt;
    }

    // 添加质量和风格提示
    const enhancements = [
      originalPrompt,
      this.stylePrompts.educational,
      this.qualityPrompts.join(', ')
    ];

    return enhancements.join(', ');
  }
}

// 单例实例
let seedreamServiceInstance: SeedreamImageService | null = null;

/**
 * 获取SeeDream 3.0图像生成服务实例
 */
export function getSeedreamImageService(): SeedreamImageService {
  if (!seedreamServiceInstance) {
    seedreamServiceInstance = new SeedreamImageService();
  }
  return seedreamServiceInstance;
}

// 导出默认实例
export default getSeedreamImageService;