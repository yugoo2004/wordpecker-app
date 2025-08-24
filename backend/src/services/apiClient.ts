import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../config/logger';

/**
 * API 错误类
 */
export class ApiError extends Error {
  public code: string;
  public statusCode?: number;
  public retryAfter?: number;
  public details?: any;

  constructor(options: {
    code: string;
    message: string;
    statusCode?: number;
    retryAfter?: number;
    details?: any;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryAfter = options.retryAfter;
    this.details = options.details;
  }
}

/**
 * 重试配置接口
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

/**
 * API 客户端配置接口
 */
export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  headers?: Record<string, string>;
  retryConfig?: Partial<RetryConfig>;
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'NETWORK_ERROR'
  ]
};

/**
 * 通用 API 客户端基类
 * 提供统一的错误处理、重试机制和日志记录
 */
export class ApiClient {
  private config: ApiClientConfig;
  private retryConfig: RetryConfig;
  private serviceName: string;

  constructor(serviceName: string, config: ApiClientConfig) {
    this.serviceName = serviceName;
    this.config = config;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config.retryConfig };
  }

  /**
   * 发送 HTTP 请求，包含重试机制
   */
  async request<T>(requestConfig: AxiosRequestConfig): Promise<T> {
    const startTime = Date.now();
    let lastError: any;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest<T>(requestConfig);
        
        // 记录成功请求
        this.logSuccess(requestConfig, response, Date.now() - startTime, attempt);
        
        return response.data;
      } catch (error) {
        lastError = error;
        
        // 检查是否应该重试
        if (attempt < this.retryConfig.maxRetries && this.shouldRetry(error)) {
          const delay = this.calculateDelay(attempt);
          
          logger.warn(`${this.serviceName} API 请求失败，${delay}ms 后重试 (尝试 ${attempt + 1}/${this.retryConfig.maxRetries + 1})`, {
            service: this.serviceName,
            attempt: attempt + 1,
            error: this.extractErrorInfo(error),
            delay
          });
          
          await this.sleep(delay);
          continue;
        }
        
        // 记录失败请求
        this.logError(requestConfig, error, Date.now() - startTime, attempt + 1);
        
        // 抛出格式化的错误
        throw this.formatError(error);
      }
    }

    throw this.formatError(lastError);
  }

  /**
   * 发送单次 HTTP 请求
   */
  private async makeRequest<T>(requestConfig: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const config: AxiosRequestConfig = {
      ...requestConfig,
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        ...this.config.headers,
        ...requestConfig.headers
      }
    };

    return axios(config);
  }

  /**
   * 判断是否应该重试请求
   */
  private shouldRetry(error: any): boolean {
    // 检查 HTTP 状态码
    if (error.response?.status) {
      return this.retryConfig.retryableStatusCodes.includes(error.response.status);
    }

    // 检查网络错误
    if (error.code) {
      return this.retryConfig.retryableErrors.includes(error.code);
    }

    // 检查超时错误
    if (error.message?.includes('timeout')) {
      return true;
    }

    return false;
  }

  /**
   * 计算重试延迟时间（指数退避）
   */
  private calculateDelay(attempt: number): number {
    const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt);
    
    // 添加随机抖动，避免雷群效应
    const jitter = Math.random() * 0.1 * delay;
    
    return Math.min(delay + jitter, this.retryConfig.maxDelay);
  }

  /**
   * 休眠指定时间
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 提取错误信息
   */
  private extractErrorInfo(error: any): any {
    if (error.response) {
      return {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };
    }

    if (error.request) {
      return {
        code: error.code,
        message: error.message
      };
    }

    return {
      message: error.message
    };
  }

  /**
   * 格式化错误为统一格式
   */
  private formatError(error: any): ApiError {
    if (error.response) {
      const response = error.response;
      
      // 处理特定的 HTTP 状态码
      switch (response.status) {
        case 401:
          return new ApiError({
            code: 'UNAUTHORIZED',
            message: `${this.serviceName} API 密钥无效或已过期`,
            statusCode: 401
          });
        
        case 403:
          return new ApiError({
            code: 'FORBIDDEN',
            message: `${this.serviceName} API 访问被拒绝，请检查权限`,
            statusCode: 403
          });
        
        case 429:
          const retryAfter = this.extractRetryAfter(response);
          return new ApiError({
            code: 'RATE_LIMITED',
            message: `${this.serviceName} API 请求频率超限`,
            statusCode: 429,
            retryAfter
          });
        
        case 500:
        case 502:
        case 503:
        case 504:
          return new ApiError({
            code: 'SERVER_ERROR',
            message: `${this.serviceName} 服务器错误，请稍后重试`,
            statusCode: response.status
          });
        
        default:
          return new ApiError({
            code: 'HTTP_ERROR',
            message: `${this.serviceName} API 请求失败: ${response.status} ${response.statusText}`,
            statusCode: response.status,
            details: response.data
          });
      }
    }

    if (error.code) {
      // 处理网络错误
      switch (error.code) {
        case 'ECONNRESET':
          return new ApiError({
            code: 'CONNECTION_RESET',
            message: `${this.serviceName} 连接被重置，请检查网络连接`
          });
        
        case 'ETIMEDOUT':
          return new ApiError({
            code: 'TIMEOUT',
            message: `${this.serviceName} 请求超时，请稍后重试`
          });
        
        case 'ENOTFOUND':
          return new ApiError({
            code: 'DNS_ERROR',
            message: `${this.serviceName} 域名解析失败，请检查网络连接`
          });
        
        case 'ECONNREFUSED':
          return new ApiError({
            code: 'CONNECTION_REFUSED',
            message: `${this.serviceName} 连接被拒绝，服务可能不可用`
          });
        
        default:
          return new ApiError({
            code: 'NETWORK_ERROR',
            message: `${this.serviceName} 网络错误: ${error.message}`
          });
      }
    }

    // 默认错误
    return new ApiError({
      code: 'UNKNOWN_ERROR',
      message: `${this.serviceName} 未知错误: ${error.message || '请求失败'}`
    });
  }

  /**
   * 从响应头中提取重试延迟时间
   */
  private extractRetryAfter(response: AxiosResponse): number | undefined {
    const retryAfter = response.headers['retry-after'] || response.headers['Retry-After'];
    
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      return isNaN(seconds) ? undefined : seconds * 1000; // 转换为毫秒
    }
    
    return undefined;
  }

  /**
   * 记录成功请求
   */
  private logSuccess(
    requestConfig: AxiosRequestConfig,
    response: AxiosResponse,
    duration: number,
    attempts: number
  ): void {
    logger.info(`${this.serviceName} API 请求成功`, {
      service: this.serviceName,
      method: requestConfig.method?.toUpperCase() || 'GET',
      url: requestConfig.url,
      status: response.status,
      duration,
      attempts: attempts + 1
    });
  }

  /**
   * 记录失败请求
   */
  private logError(
    requestConfig: AxiosRequestConfig,
    error: any,
    duration: number,
    attempts: number
  ): void {
    logger.error(`${this.serviceName} API 请求失败`, {
      service: this.serviceName,
      method: requestConfig.method?.toUpperCase() || 'GET',
      url: requestConfig.url,
      error: this.extractErrorInfo(error),
      duration,
      attempts
    });
  }

  /**
   * 验证 API 密钥
   */
  async validateApiKey(testEndpoint: string, testParams?: any): Promise<boolean> {
    try {
      await this.request({
        method: 'GET',
        url: testEndpoint,
        params: testParams
      });
      
      logger.info(`${this.serviceName} API 密钥验证成功`);
      return true;
    } catch (error: any) {
      if (error.code === 'UNAUTHORIZED') {
        logger.error(`${this.serviceName} API 密钥无效`);
        return false;
      }
      
      // 其他错误可能不是密钥问题
      logger.warn(`${this.serviceName} API 密钥验证时发生错误`, { error });
      return true; // 假设密钥有效，但服务有其他问题
    }
  }

  /**
   * 获取服务名称
   */
  getServiceName(): string {
    return this.serviceName;
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<ApiClientConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.retryConfig) {
      this.retryConfig = { ...this.retryConfig, ...newConfig.retryConfig };
    }
  }
}

/**
 * 创建 API 客户端的工厂函数
 */
export function createApiClient(serviceName: string, config: ApiClientConfig): ApiClient {
  return new ApiClient(serviceName, config);
}