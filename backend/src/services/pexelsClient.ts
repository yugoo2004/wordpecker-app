import { ApiClient, createApiClient, ApiError } from './apiClient';
import { environment } from '../config/environment';
import { logger } from '../config/logger';

/**
 * Pexels API 响应接口
 */
export interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  photographer_id: number;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  liked: boolean;
  alt: string;
}

export interface PexelsSearchResponse {
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  total_results: number;
  next_page?: string;
  prev_page?: string;
}

/**
 * Pexels API 错误处理和重试机制
 */
export class PexelsClient {
  private apiClient: ApiClient;
  private isValidated: boolean = false;

  constructor() {
    // 创建通用 API 客户端
    this.apiClient = createApiClient('Pexels', {
      baseURL: environment.pexels.baseUrl,
      timeout: 30000, // 30秒超时
      headers: {
        'Authorization': environment.pexels.apiKey,
        'User-Agent': 'WordPecker/1.0'
      },
      retryConfig: {
        maxRetries: environment.pexels.maxRetries,
        baseDelay: 1500,
        maxDelay: 20000,
        backoffMultiplier: 2,
        retryableStatusCodes: [429, 500, 502, 503, 504],
        retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']
      }
    });
  }

  /**
   * 验证 Pexels API 密钥
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const isValid = await this.apiClient.validateApiKey('/search', { 
        query: 'test', 
        per_page: 1 
      });
      
      this.isValidated = isValid;
      
      if (isValid) {
        logger.info('Pexels API 密钥验证成功');
      } else {
        logger.error('Pexels API 密钥验证失败');
      }
      
      return isValid;
    } catch (error) {
      logger.error('Pexels API 密钥验证失败', { error });
      this.isValidated = false;
      return false;
    }
  }

  /**
   * 搜索图片，包含错误处理和重试
   */
  async searchPhotos(
    query: string,
    options: {
      page?: number;
      perPage?: number;
      orientation?: 'landscape' | 'portrait' | 'square';
      size?: 'large' | 'medium' | 'small';
      color?: string;
      locale?: string;
    } = {}
  ): Promise<PexelsSearchResponse> {
    await this.ensureValidated();

    const params = {
      query: query.trim(),
      page: options.page || 1,
      per_page: Math.min(options.perPage || environment.pexels.defaultPerPage, 80),
      orientation: options.orientation,
      size: options.size,
      color: options.color,
      locale: options.locale || 'en-US'
    };

    // 过滤掉 undefined 值
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined)
    );

    try {
      const startTime = Date.now();
      
      logger.info('Pexels 图片搜索开始', {
        query: params.query,
        page: params.page,
        perPage: params.per_page
      });

      const response = await this.apiClient.request<PexelsSearchResponse>({
        method: 'GET',
        url: '/search',
        params: filteredParams
      });

      logger.info('Pexels 图片搜索成功', {
        query: params.query,
        totalResults: response.total_results,
        photosReturned: response.photos.length,
        duration: Date.now() - startTime
      });

      return response;
    } catch (error: any) {
      logger.error('Pexels 图片搜索失败', {
        query: params.query,
        error: this.extractPexelsErrorInfo(error)
      });

      throw this.formatPexelsError(error);
    }
  }

  /**
   * 获取精选图片，包含错误处理和重试
   */
  async getCuratedPhotos(
    options: {
      page?: number;
      perPage?: number;
    } = {}
  ): Promise<PexelsSearchResponse> {
    await this.ensureValidated();

    const params = {
      page: options.page || 1,
      per_page: Math.min(options.perPage || environment.pexels.defaultPerPage, 80)
    };

    try {
      const startTime = Date.now();
      
      logger.info('Pexels 精选图片获取开始', {
        page: params.page,
        perPage: params.per_page
      });

      const response = await this.apiClient.request<PexelsSearchResponse>({
        method: 'GET',
        url: '/curated',
        params
      });

      logger.info('Pexels 精选图片获取成功', {
        photosReturned: response.photos.length,
        duration: Date.now() - startTime
      });

      return response;
    } catch (error: any) {
      logger.error('Pexels 精选图片获取失败', {
        error: this.extractPexelsErrorInfo(error)
      });

      throw this.formatPexelsError(error);
    }
  }

  /**
   * 根据 ID 获取特定图片，包含错误处理和重试
   */
  async getPhotoById(id: number): Promise<PexelsPhoto> {
    await this.ensureValidated();

    try {
      const startTime = Date.now();
      
      logger.info('Pexels 获取特定图片开始', { photoId: id });

      const response = await this.apiClient.request<PexelsPhoto>({
        method: 'GET',
        url: `/photos/${id}`
      });

      logger.info('Pexels 获取特定图片成功', {
        photoId: id,
        photographer: response.photographer,
        duration: Date.now() - startTime
      });

      return response;
    } catch (error: any) {
      logger.error('Pexels 获取特定图片失败', {
        photoId: id,
        error: this.extractPexelsErrorInfo(error)
      });

      throw this.formatPexelsError(error);
    }
  }

  /**
   * 获取随机图片（通过搜索实现）
   */
  async getRandomPhoto(category?: string): Promise<PexelsPhoto | null> {
    const queries = category ? [category] : [
      'nature', 'technology', 'business', 'people', 'food', 
      'travel', 'art', 'lifestyle', 'architecture', 'animals'
    ];

    const randomQuery = queries[Math.floor(Math.random() * queries.length)];
    const randomPage = Math.floor(Math.random() * 10) + 1; // 随机页面 1-10

    try {
      const response = await this.searchPhotos(randomQuery, {
        page: randomPage,
        perPage: 15
      });

      if (response.photos.length === 0) {
        logger.warn('Pexels 随机图片搜索无结果', { query: randomQuery, page: randomPage });
        return null;
      }

      const randomPhoto = response.photos[Math.floor(Math.random() * response.photos.length)];
      
      logger.info('Pexels 随机图片获取成功', {
        query: randomQuery,
        photoId: randomPhoto.id,
        photographer: randomPhoto.photographer
      });

      return randomPhoto;
    } catch (error) {
      logger.error('Pexels 随机图片获取失败', {
        query: randomQuery,
        error: this.extractPexelsErrorInfo(error)
      });

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
          message: 'Pexels API 密钥无效，请检查配置'
        });
      }
    }
  }

  /**
   * 提取 Pexels 错误信息
   */
  private extractPexelsErrorInfo(error: any): any {
    if (error.response) {
      return {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };
    }

    if (error.statusCode && error.message) {
      return {
        status: error.statusCode,
        message: error.message
      };
    }

    return {
      message: error.message,
      code: error.code
    };
  }

  /**
   * 格式化 Pexels 错误
   */
  private formatPexelsError(error: any): ApiError {
    const status = error.response?.status || error.statusCode;
    
    if (status) {
      switch (status) {
        case 401:
          return new ApiError({
            code: 'UNAUTHORIZED',
            message: 'Pexels API 密钥无效或已过期',
            statusCode: 401
          });
        
        case 403:
          return new ApiError({
            code: 'FORBIDDEN',
            message: 'Pexels API 访问被拒绝，请检查权限',
            statusCode: 403
          });
        
        case 429:
          return new ApiError({
            code: 'RATE_LIMITED',
            message: 'Pexels API 请求频率超限，请稍后重试',
            statusCode: 429,
            retryAfter: 3600000 // 建议1小时后重试
          });
        
        case 404:
          return new ApiError({
            code: 'NOT_FOUND',
            message: 'Pexels 请求的资源不存在',
            statusCode: 404
          });
        
        case 422:
          return new ApiError({
            code: 'VALIDATION_ERROR',
            message: 'Pexels API 请求参数无效',
            statusCode: 422,
            details: error.response?.data
          });
        
        case 500:
        case 502:
        case 503:
        case 504:
          return new ApiError({
            code: 'SERVER_ERROR',
            message: 'Pexels 服务器错误，请稍后重试',
            statusCode: status
          });
        
        default:
          return new ApiError({
            code: 'PEXELS_ERROR',
            message: `Pexels API 错误: ${error.message || '未知错误'}`,
            statusCode: status
          });
      }
    }

    if (error.code) {
      switch (error.code) {
        case 'ECONNRESET':
          return new ApiError({
            code: 'CONNECTION_RESET',
            message: 'Pexels 连接被重置，请检查网络连接'
          });
        
        case 'ETIMEDOUT':
          return new ApiError({
            code: 'TIMEOUT',
            message: 'Pexels 请求超时，请稍后重试'
          });
        
        case 'ENOTFOUND':
          return new ApiError({
            code: 'DNS_ERROR',
            message: 'Pexels 域名解析失败，请检查网络连接'
          });
        
        default:
          return new ApiError({
            code: 'NETWORK_ERROR',
            message: `Pexels 网络错误: ${error.message}`
          });
      }
    }

    return new ApiError({
      code: 'UNKNOWN_ERROR',
      message: `Pexels 未知错误: ${error.message || '请求失败'}`
    });
  }

  /**
   * 获取客户端状态
   */
  getStatus(): { validated: boolean; serviceName: string } {
    return {
      validated: this.isValidated,
      serviceName: 'Pexels'
    };
  }

  /**
   * 获取 API 使用统计（如果可用）
   */
  async getUsageStats(): Promise<any> {
    try {
      // Pexels 没有专门的使用统计端点，但我们可以通过用户信息获取一些信息
      const response = await this.apiClient.request({
        method: 'GET',
        url: '/search',
        params: { query: 'test', per_page: 1 }
      });

      // 从响应头中提取配额信息
      return {
        available: true,
        lastCheck: new Date().toISOString()
      };
    } catch (error) {
      logger.warn('Pexels 使用统计获取失败', { error });
      return {
        available: false,
        error: this.extractPexelsErrorInfo(error)
      };
    }
  }
}

// 创建单例实例
export const pexelsClient = new PexelsClient();