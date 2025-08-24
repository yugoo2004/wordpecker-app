import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// 确保日志目录存在
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 日志配置常量
const LOG_CONFIG = {
  maxSize: '20m',        // 单个日志文件最大大小
  maxFiles: '14d',       // 保留14天的日志
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,   // 压缩旧日志文件
  auditFile: path.join(logDir, '.audit.json'), // 审计文件
  createSymlink: true,   // 创建符号链接到当前日志
  symlinkName: 'current.log'
};

// 结构化日志格式（用于机器解析）
const structuredFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'service'] })
);

// 人类可读格式（用于控制台和调试）
const humanReadableFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, stack, ...meta }) => {
    let logMessage = `${timestamp} [${level}]`;
    
    if (service) {
      logMessage += ` [${service}]`;
    }
    
    logMessage += `: ${message}`;
    
    // 添加堆栈跟踪（如果存在）
    if (stack) {
      logMessage += `\n${stack}`;
    }
    
    // 添加元数据（排除常见字段）
    const filteredMeta = { ...meta };
    delete filteredMeta.timestamp;
    delete filteredMeta.level;
    delete filteredMeta.message;
    delete filteredMeta.service;
    delete filteredMeta.stack;
    
    if (Object.keys(filteredMeta).length > 0) {
      logMessage += `\n  Meta: ${JSON.stringify(filteredMeta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// 简洁格式（用于生产环境控制台）
const simpleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, service }) => {
    return `${timestamp} [${level.toUpperCase()}] ${service ? `[${service}] ` : ''}${message}`;
  })
);

// 创建日志传输器
const createTransports = () => {
  const transports: winston.transport[] = [];

  // 1. 综合日志（所有级别）- 使用日志轮转
  transports.push(new DailyRotateFile({
    filename: path.join(logDir, 'combined-%DATE%.log'),
    datePattern: LOG_CONFIG.datePattern,
    maxSize: LOG_CONFIG.maxSize,
    maxFiles: LOG_CONFIG.maxFiles,
    zippedArchive: LOG_CONFIG.zippedArchive,
    auditFile: path.join(logDir, 'combined-audit.json'),
    createSymlink: LOG_CONFIG.createSymlink,
    symlinkName: 'combined-current.log',
    format: structuredFormat
  }));

  // 2. 错误日志（error级别及以上）
  transports.push(new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: LOG_CONFIG.datePattern,
    level: 'error',
    maxSize: LOG_CONFIG.maxSize,
    maxFiles: LOG_CONFIG.maxFiles,
    zippedArchive: LOG_CONFIG.zippedArchive,
    auditFile: path.join(logDir, 'error-audit.json'),
    createSymlink: LOG_CONFIG.createSymlink,
    symlinkName: 'error-current.log',
    format: structuredFormat
  }));

  // 3. API 错误日志（warn级别及以上，用于API监控）
  transports.push(new DailyRotateFile({
    filename: path.join(logDir, 'api-errors-%DATE%.log'),
    datePattern: LOG_CONFIG.datePattern,
    level: 'warn',
    maxSize: '10m',
    maxFiles: '7d',
    zippedArchive: LOG_CONFIG.zippedArchive,
    auditFile: path.join(logDir, 'api-errors-audit.json'),
    createSymlink: LOG_CONFIG.createSymlink,
    symlinkName: 'api-errors-current.log',
    format: winston.format.combine(
      structuredFormat,
      winston.format.metadata({ key: 'meta' })
    )
  }));

  // 4. 性能日志（用于监控慢查询和性能问题）
  transports.push(new DailyRotateFile({
    filename: path.join(logDir, 'performance-%DATE%.log'),
    datePattern: LOG_CONFIG.datePattern,
    level: 'info',
    maxSize: '10m',
    maxFiles: '3d',
    zippedArchive: LOG_CONFIG.zippedArchive,
    auditFile: path.join(logDir, 'performance-audit.json'),
    createSymlink: LOG_CONFIG.createSymlink,
    symlinkName: 'performance-current.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
      winston.format((info) => {
        // 只记录包含性能相关信息的日志
        if (info.duration || info.responseTime || info.dbQueryTime || info.performance) {
          return info;
        }
        return false;
      })()
    )
  }));

  // 5. 安全日志（用于记录认证、授权等安全相关事件）
  transports.push(new DailyRotateFile({
    filename: path.join(logDir, 'security-%DATE%.log'),
    datePattern: LOG_CONFIG.datePattern,
    level: 'warn',
    maxSize: '5m',
    maxFiles: '30d', // 安全日志保留更长时间
    zippedArchive: LOG_CONFIG.zippedArchive,
    auditFile: path.join(logDir, 'security-audit.json'),
    createSymlink: LOG_CONFIG.createSymlink,
    symlinkName: 'security-current.log',
    format: winston.format.combine(
      structuredFormat,
      winston.format((info) => {
        // 只记录安全相关的日志
        if (info.security || info.auth || info.unauthorized || info.suspicious) {
          return info;
        }
        return false;
      })()
    )
  }));

  return transports;
};

// 创建 Winston 日志器
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: structuredFormat,
  defaultMeta: { 
    service: 'wordpecker-backend',
    pid: process.pid,
    hostname: require('os').hostname()
  },
  transports: createTransports(),
  
  // 退出时的行为
  exitOnError: false,
  
  // 静默模式（在测试环境中）
  silent: process.env.NODE_ENV === 'test'
});

// 根据环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  // 开发环境：详细的彩色输出
  logger.add(new winston.transports.Console({
    format: humanReadableFormat,
    level: 'debug'
  }));
} else if (process.env.CONSOLE_LOG === 'true') {
  // 生产环境：简洁输出（可选）
  logger.add(new winston.transports.Console({
    format: simpleFormat,
    level: 'warn' // 生产环境只输出警告和错误到控制台
  }));
}

// 处理未捕获的异常
logger.exceptions.handle(
  new DailyRotateFile({
    filename: path.join(logDir, 'exceptions-%DATE%.log'),
    datePattern: LOG_CONFIG.datePattern,
    maxSize: '5m',
    maxFiles: '30d',
    zippedArchive: LOG_CONFIG.zippedArchive,
    auditFile: path.join(logDir, 'exceptions-audit.json'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  })
);

// 处理未捕获的 Promise 拒绝
logger.rejections.handle(
  new DailyRotateFile({
    filename: path.join(logDir, 'rejections-%DATE%.log'),
    datePattern: LOG_CONFIG.datePattern,
    maxSize: '5m',
    maxFiles: '30d',
    zippedArchive: LOG_CONFIG.zippedArchive,
    auditFile: path.join(logDir, 'rejections-audit.json'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  })
);

// 创建专用日志器
export const apiLogger = winston.createLogger({
  level: 'info',
  format: structuredFormat,
  defaultMeta: { 
    service: 'wordpecker-api',
    pid: process.pid 
  },
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'api-%DATE%.log'),
      datePattern: LOG_CONFIG.datePattern,
      maxSize: '15m',
      maxFiles: '7d',
      zippedArchive: LOG_CONFIG.zippedArchive,
      auditFile: path.join(logDir, 'api-audit.json'),
      createSymlink: LOG_CONFIG.createSymlink,
      symlinkName: 'api-current.log',
      format: structuredFormat
    })
  ],
  silent: process.env.NODE_ENV === 'test'
});

// 数据库日志器
export const dbLogger = winston.createLogger({
  level: 'info',
  format: structuredFormat,
  defaultMeta: { 
    service: 'wordpecker-db',
    pid: process.pid 
  },
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'database-%DATE%.log'),
      datePattern: LOG_CONFIG.datePattern,
      maxSize: '10m',
      maxFiles: '7d',
      zippedArchive: LOG_CONFIG.zippedArchive,
      auditFile: path.join(logDir, 'database-audit.json'),
      createSymlink: LOG_CONFIG.createSymlink,
      symlinkName: 'database-current.log',
      format: structuredFormat
    })
  ],
  silent: process.env.NODE_ENV === 'test'
});

// 性能监控日志器
export const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'wordpecker-performance',
    pid: process.pid 
  },
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'performance-%DATE%.log'),
      datePattern: LOG_CONFIG.datePattern,
      maxSize: '10m',
      maxFiles: '3d',
      zippedArchive: LOG_CONFIG.zippedArchive,
      auditFile: path.join(logDir, 'performance-audit.json'),
      createSymlink: LOG_CONFIG.createSymlink,
      symlinkName: 'performance-current.log'
    })
  ],
  silent: process.env.NODE_ENV === 'test'
});

// 日志清理工具函数
export const cleanupLogs = async (daysToKeep: number = 14) => {
  const fs = require('fs').promises;
  const glob = require('glob');
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    // 查找所有日志文件
    const logFiles = glob.sync(path.join(logDir, '*.log*'));
    
    for (const file of logFiles) {
      const stats = await fs.stat(file);
      if (stats.mtime < cutoffDate) {
        await fs.unlink(file);
        logger.info(`Cleaned up old log file: ${file}`);
      }
    }
    
    logger.info(`Log cleanup completed. Kept logs newer than ${daysToKeep} days.`);
  } catch (error) {
    logger.error('Error during log cleanup:', error);
  }
};

// 获取日志统计信息
export const getLogStats = async () => {
  const fs = require('fs').promises;
  const glob = require('glob');
  
  try {
    const logFiles = glob.sync(path.join(logDir, '*.log*'));
    let totalSize = 0;
    const fileStats = [];
    
    for (const file of logFiles) {
      const stats = await fs.stat(file);
      totalSize += stats.size;
      fileStats.push({
        name: path.basename(file),
        size: stats.size,
        modified: stats.mtime
      });
    }
    
    return {
      totalFiles: logFiles.length,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      files: fileStats.sort((a, b) => b.modified.getTime() - a.modified.getTime())
    };
  } catch (error) {
    logger.error('Error getting log stats:', error);
    return null;
  }
};

export default logger;