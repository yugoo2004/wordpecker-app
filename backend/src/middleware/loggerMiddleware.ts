import { Request, Response, NextFunction } from 'express';
import { logger, apiLogger, performanceLogger } from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

// 扩展Request接口以包含日志相关属性
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
      logContext?: {
        userId?: string;
        sessionId?: string;
        userAgent?: string;
        ip?: string;
      };
    }
  }
}

// 请求日志中间件
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // 生成唯一请求ID
  req.requestId = uuidv4();
  req.startTime = Date.now();
  
  // 提取请求上下文信息
  req.logContext = {
    userId: req.headers['x-user-id'] as string,
    sessionId: req.headers['x-session-id'] as string,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress
  };

  // 记录请求开始
  apiLogger.info('Request started', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    query: req.query,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for']
    },
    body: req.method === 'POST' || req.method === 'PUT' ? 
      sanitizeRequestBody(req.body) : undefined,
    context: req.logContext
  });

  // 监听响应完成事件
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - (req.startTime || Date.now());
    
    // 记录响应信息
    apiLogger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.get('content-length'),
      context: req.logContext
    });

    // 记录性能信息
    if (responseTime > 1000) { // 超过1秒的请求
      performanceLogger.warn('Slow request detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        responseTime,
        statusCode: res.statusCode,
        performance: {
          slow: true,
          threshold: 1000
        }
      });
    }

    // 记录性能统计
    performanceLogger.info('Request performance', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      responseTime,
      statusCode: res.statusCode,
      performance: {
        responseTime,
        category: getPerformanceCategory(responseTime)
      }
    });

    return originalSend.call(this, data);
  };

  next();
};

// 错误日志中间件
export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction) => {
  const responseTime = Date.now() - (req.startTime || Date.now());
  
  // 记录错误详情
  logger.error('Request error', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    error: {
      name: error.name,
      message: (error instanceof Error ? error.message : String(error)),
      stack: error.stack
    },
    responseTime,
    context: req.logContext,
    body: req.method === 'POST' || req.method === 'PUT' ? 
      sanitizeRequestBody(req.body) : undefined
  });

  // 如果是API错误，记录到API错误日志
  if (req.originalUrl.startsWith('/api/')) {
    apiLogger.error('API error', {
      requestId: req.requestId,
      endpoint: req.originalUrl,
      method: req.method,
      error: {
        name: error.name,
        message: (error instanceof Error ? error.message : String(error)),
        code: (error as any).code,
        statusCode: (error as any).statusCode
      },
      context: req.logContext
    });
  }

  next(error);
};

// 数据库操作日志中间件
export const dbLogger = {
  logQuery: (operation: string, collection: string, query: any, duration?: number) => {
    const logData = {
      operation,
      collection,
      query: sanitizeQuery(query),
      duration,
      timestamp: new Date().toISOString()
    };

    if (duration && duration > 100) { // 超过100ms的查询
      logger.warn('Slow database query', {
        ...logData,
        performance: {
          slow: true,
          threshold: 100
        }
      });
    } else {
      logger.debug('Database query', logData);
    }
  },

  logConnection: (event: string, details?: any) => {
    logger.info(`Database ${event}`, {
      event,
      details,
      timestamp: new Date().toISOString()
    });
  },

  logError: (operation: string, error: Error, context?: any) => {
    logger.error('Database error', {
      operation,
      error: {
        name: error.name,
        message: (error instanceof Error ? error.message : String(error)),
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString()
    });
  }
};

// 外部API调用日志
export const apiCallLogger = {
  logRequest: (service: string, endpoint: string, method: string, data?: any) => {
    logger.info('External API request', {
      service,
      endpoint,
      method,
      data: sanitizeApiData(data),
      timestamp: new Date().toISOString()
    });
  },

  logResponse: (service: string, endpoint: string, statusCode: number, duration: number, error?: Error) => {
    const logData = {
      service,
      endpoint,
      statusCode,
      duration,
      timestamp: new Date().toISOString()
    };

    if (error) {
      logger.error('External API error', {
        ...logData,
        error: {
          name: error.name,
          message: (error instanceof Error ? error.message : String(error))
        }
      });
    } else if (duration > 5000) { // 超过5秒的API调用
      logger.warn('Slow external API call', {
        ...logData,
        performance: {
          slow: true,
          threshold: 5000
        }
      });
    } else {
      logger.info('External API response', logData);
    }
  }
};

// 安全事件日志
export const securityLogger = {
  logAuthAttempt: (success: boolean, userId?: string, ip?: string, userAgent?: string) => {
    logger.info('Authentication attempt', {
      success,
      userId,
      ip,
      userAgent,
      security: true,
      timestamp: new Date().toISOString()
    });
  },

  logSuspiciousActivity: (activity: string, details: any, ip?: string) => {
    logger.warn('Suspicious activity detected', {
      activity,
      details,
      ip,
      security: true,
      suspicious: true,
      timestamp: new Date().toISOString()
    });
  },

  logRateLimitExceeded: (ip: string, endpoint: string, attempts: number) => {
    logger.warn('Rate limit exceeded', {
      ip,
      endpoint,
      attempts,
      security: true,
      rateLimit: true,
      timestamp: new Date().toISOString()
    });
  }
};

// 工具函数

// 清理请求体中的敏感信息
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

// 清理数据库查询中的敏感信息
function sanitizeQuery(query: any): any {
  if (!query || typeof query !== 'object') {
    return query;
  }

  const sanitized = JSON.parse(JSON.stringify(query));
  
  // 递归清理嵌套对象
  function cleanObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(cleanObject);
    }
    
    if (obj && typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key.toLowerCase().includes('password') || 
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('secret')) {
          cleaned[key] = '[REDACTED]';
        } else {
          cleaned[key] = cleanObject(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  return cleanObject(sanitized);
}

// 清理API调用数据
function sanitizeApiData(data: any): any {
  if (!data) return data;
  
  const sanitized = { ...data };
  const sensitiveFields = ['api_key', 'apiKey', 'authorization', 'token', 'password'];
  
  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

// 获取性能分类
function getPerformanceCategory(responseTime: number): string {
  if (responseTime < 100) return 'fast';
  if (responseTime < 500) return 'normal';
  if (responseTime < 1000) return 'slow';
  return 'very_slow';
}

// 日志上下文中间件（用于添加全局上下文）
export const logContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // 添加全局日志上下文
  const originalLogger = logger;
  
  // 创建带有请求上下文的子日志器
  (req as any).logger = originalLogger.child({
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    context: req.logContext
  });

  next();
};

export default {
  requestLogger,
  errorLogger,
  dbLogger,
  apiCallLogger,
  securityLogger,
  logContextMiddleware
};