import mongoose from 'mongoose';
import { environment } from './environment';
import { logger } from './logger';

if (!environment.mongodbUrl) {
  throw new Error('Missing MongoDB configuration. Check MONGODB_URL in .env');
}

// 数据库连接配置
interface DatabaseConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  connectionTimeout: number;
  socketTimeout: number;
  maxPoolSize: number;
  minPoolSize: number;
  maxIdleTimeMS: number;
  heartbeatFrequencyMS: number;
}

// 优化的数据库连接配置
const dbConfig: DatabaseConfig = {
  maxRetries: 10,              // 最大重试次数
  initialDelay: 1000,          // 初始延迟 1秒
  maxDelay: 30000,             // 最大延迟 30秒
  backoffMultiplier: 2,        // 指数退避倍数
  connectionTimeout: 10000,    // 连接超时 10秒
  socketTimeout: 45000,        // Socket超时 45秒
  maxPoolSize: 15,             // 最大连接池大小
  minPoolSize: 3,              // 最小连接池大小
  maxIdleTimeMS: 30000,        // 连接最大空闲时间 30秒
  heartbeatFrequencyMS: 10000, // 心跳检测频率 10秒
};

// MongoDB连接选项
const mongoOptions = {
  serverSelectionTimeoutMS: dbConfig.connectionTimeout,
  socketTimeoutMS: dbConfig.socketTimeout,
  connectTimeoutMS: dbConfig.connectionTimeout,
  bufferCommands: false,
  maxPoolSize: dbConfig.maxPoolSize,
  minPoolSize: dbConfig.minPoolSize,
  maxIdleTimeMS: dbConfig.maxIdleTimeMS,
  heartbeatFrequencyMS: dbConfig.heartbeatFrequencyMS,
  retryWrites: true,
  retryReads: true,
  // 启用自动重连
  autoCreate: true,
  autoIndex: true,
};

// 连接状态管理
class DatabaseConnectionManager {
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  /**
   * 计算指数退避延迟时间
   * @param attempt 当前重试次数
   * @returns 延迟时间（毫秒）
   */
  private calculateBackoffDelay(attempt: number): number {
    const delay = dbConfig.initialDelay * Math.pow(dbConfig.backoffMultiplier, attempt);
    return Math.min(delay, dbConfig.maxDelay);
  }

  /**
   * 检查错误是否可重试
   * @param error 错误对象
   * @returns 是否可重试
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;
    
    const retryableErrors = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE',
      'MongoNetworkError',
      'MongoServerSelectionError',
      'MongoTimeoutError'
    ];

    return retryableErrors.some(errorType => 
      error.code === errorType || 
      error.name === errorType ||
      error.message?.includes(errorType)
    );
  }

  /**
   * 连接到MongoDB（带指数退避重试）
   * @param attempt 当前重试次数
   * @returns Promise<void>
   */
  async connect(attempt = 0): Promise<void> {
    if (this.isConnecting || this.isShuttingDown) {
      return;
    }

    this.isConnecting = true;

    try {
      logger.info(`尝试连接MongoDB... (第 ${attempt + 1}/${dbConfig.maxRetries + 1} 次)`);
      
      await mongoose.connect(environment.mongodbUrl as string, mongoOptions);
      
      logger.info('✅ MongoDB连接成功');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      // 清除重连定时器
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      // 设置连接事件监听器
      this.setupConnectionEventHandlers();
      
    } catch (error) {
      this.isConnecting = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error(`MongoDB连接失败 (第 ${attempt + 1} 次): ${errorMessage}`);

      if (attempt >= dbConfig.maxRetries) {
        logger.error('❌ MongoDB连接重试次数已达上限，应用将退出');
        process.exit(1);
      }

      if (this.isRetryableError(error)) {
        const delay = this.calculateBackoffDelay(attempt);
        logger.info(`${delay / 1000}秒后重试连接...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.connect(attempt + 1);
      } else {
        logger.error('❌ 遇到不可重试的错误，应用将退出');
        process.exit(1);
      }
    }
  }

  /**
   * 设置连接事件处理器
   */
  private setupConnectionEventHandlers(): void {
    // 移除之前的监听器避免重复绑定
    mongoose.connection.removeAllListeners();

    // 连接成功
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB连接已建立');
      this.reconnectAttempts = 0;
    });

    // 连接断开
    mongoose.connection.on('disconnected', () => {
      if (!this.isShuttingDown) {
        logger.warn('MongoDB连接已断开，准备重连...');
        this.scheduleReconnect();
      }
    });

    // 连接错误
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB连接错误:', error);
      
      if (!this.isShuttingDown && this.isRetryableError(error)) {
        this.scheduleReconnect();
      }
    });

    // 重新连接成功
    mongoose.connection.on('reconnected', () => {
      logger.info('✅ MongoDB重连成功');
      this.reconnectAttempts = 0;
    });

    // 连接超时
    mongoose.connection.on('timeout', () => {
      logger.warn('MongoDB连接超时');
    });

    // 缓冲区满
    mongoose.connection.on('fullsetup', () => {
      logger.info('MongoDB副本集连接完成');
    });

    // 处理进程退出
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGUSR2', () => this.gracefulShutdown('SIGUSR2')); // nodemon重启
  }

  /**
   * 调度重连
   */
  private scheduleReconnect(): void {
    if (this.isConnecting || this.isShuttingDown || this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= dbConfig.maxRetries) {
      logger.error('❌ 重连次数已达上限，应用将退出');
      process.exit(1);
    }

    const delay = this.calculateBackoffDelay(this.reconnectAttempts);
    logger.info(`${delay / 1000}秒后尝试重连... (第 ${this.reconnectAttempts + 1}/${dbConfig.maxRetries} 次)`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      
      try {
        await this.connect(0);
      } catch (error) {
        logger.error('重连失败:', error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  /**
   * 优雅关闭数据库连接
   * @param signal 退出信号
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    logger.info(`收到 ${signal} 信号，正在关闭数据库连接...`);
    this.isShuttingDown = true;

    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      await mongoose.connection.close();
      logger.info('✅ MongoDB连接已关闭');
    } catch (error) {
      logger.error('关闭MongoDB连接时出错:', error);
    }

    process.exit(0);
  }

  /**
   * 获取连接状态信息
   */
  getConnectionStatus() {
    const state = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    return {
      state: states[state as keyof typeof states] || 'unknown',
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      reconnectAttempts: this.reconnectAttempts,
      isConnecting: this.isConnecting
    };
  }

  /**
   * 检查数据库连接健康状态
   */
  async checkHealth(): Promise<{ healthy: boolean; details: any }> {
    try {
      if (mongoose.connection.readyState !== 1) {
        return {
          healthy: false,
          details: {
            status: 'disconnected',
            readyState: mongoose.connection.readyState
          }
        };
      }

      // 执行简单的ping操作
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().ping();
      } else {
        throw new Error('Database connection not available');
      }
      
      return {
        healthy: true,
        details: {
          status: 'connected',
          readyState: mongoose.connection.readyState,
          host: mongoose.connection.host,
          port: mongoose.connection.port,
          name: mongoose.connection.name
        }
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
}

// 创建数据库连接管理器实例
const dbManager = new DatabaseConnectionManager();

// 导出连接函数
export const connectDB = async (): Promise<void> => {
  return dbManager.connect();
};

// 导出连接状态检查函数
export const getConnectionStatus = () => {
  return dbManager.getConnectionStatus();
};

// 导出健康检查函数
export const checkDatabaseHealth = async () => {
  return dbManager.checkHealth();
};

// 导出关闭连接函数（保持向后兼容）
export const closeDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB连接已关闭');
  } catch (error) {
    logger.error('关闭MongoDB连接时出错:', error);
  }
}; 