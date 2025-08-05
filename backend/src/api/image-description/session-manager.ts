import { EventEmitter } from 'events';

/**
 * 增强的用户会话数据结构
 */
export interface UserSession {
  /** 已使用的图片URL集合 */
  images: Set<string>;
  /** 图片元数据映射 */
  imageMetadata: Map<string, ImageMetadata>;
  /** 最后访问时间戳 */
  lastAccess: number;
  /** 请求计数 */
  requestCount: number;
  /** 会话创建时间 */
  createdAt: number;
  /** 用户偏好设置 */
  preferences?: UserPreferences;
  /** 会话统计信息 */
  stats: SessionStats;
}

/**
 * 图片元数据接口
 */
export interface ImageMetadata {
  /** 使用时间戳 */
  timestamp: number;
  /** 图片类别 */
  category: string;
  /** 相关性评分 */
  score: number;
  /** 图片尺寸 */
  dimensions?: { width: number; height: number };
  /** 使用次数 */
  usageCount: number;
}

/**
 * 用户偏好设置接口
 */
export interface UserPreferences {
  /** 偏好的图片类别 */
  categories: string[];
  /** 排除的图片类别 */
  excludeCategories: string[];
  /** 最小图片宽度 */
  minWidth?: number;
  /** 最小图片高度 */
  minHeight?: number;
  /** 图片质量偏好 */
  qualityPreference: 'low' | 'medium' | 'high';
}

/**
 * 会话统计信息接口
 */
export interface SessionStats {
  /** 总图片请求数 */
  totalImageRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 平均响应时间 */
  averageResponseTime: number;
  /** 最常用的类别 */
  topCategories: Map<string, number>;
  /** 会话持续时间（毫秒） */
  sessionDuration: number;
}

/**
 * 会话清理配置接口
 */
export interface SessionCleanupConfig {
  /** 会话过期时间（毫秒） */
  sessionTimeout: number;
  /** 最大会话数量 */
  maxSessions: number;
  /** 每个会话最大图片数量 */
  maxImagesPerSession: number;
  /** 清理检查间隔（毫秒） */
  cleanupInterval: number;
  /** 内存使用阈值（字节） */
  memoryThreshold: number;
}

/**
 * 会话管理器事件类型
 */
export interface SessionManagerEvents {
  'session-created': (sessionId: string, session: UserSession) => void;
  'session-updated': (sessionId: string, session: UserSession) => void;
  'session-expired': (sessionId: string, session: UserSession) => void;
  'session-cleaned': (sessionId: string, reason: string) => void;
  'memory-warning': (usage: number, threshold: number) => void;
  'cleanup-completed': (cleaned: number, remaining: number) => void;
}

/**
 * 高效的会话管理器类
 */
export class SessionManager extends EventEmitter {
  private sessions = new Map<string, UserSession>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private config: SessionCleanupConfig;
  private memoryMonitorTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<SessionCleanupConfig>) {
    super();
    
    // 默认配置
    this.config = {
      sessionTimeout: 24 * 60 * 60 * 1000, // 24小时
      maxSessions: 1000, // 最大1000个会话
      maxImagesPerSession: 100, // 每个会话最多100张图片
      cleanupInterval: 60 * 60 * 1000, // 每小时清理一次
      memoryThreshold: 100 * 1024 * 1024, // 100MB内存阈值
      ...config
    };

    this.startCleanupTimer();
    this.startMemoryMonitor();
  }

  /**
   * 获取或创建用户会话
   * @param sessionId - 会话ID
   * @returns UserSession - 用户会话对象
   */
  getOrCreateSession(sessionId: string): UserSession {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      session = this.createNewSession();
      this.sessions.set(sessionId, session);
      this.emit('session-created', sessionId, session);
      console.log(`🆕 创建新会话: ${sessionId} (总会话数: ${this.sessions.size})`);
    } else {
      // 更新访问时间
      session.lastAccess = Date.now();
      session.stats.sessionDuration = session.lastAccess - session.createdAt;
      this.emit('session-updated', sessionId, session);
    }

    // 检查是否需要立即清理
    this.checkMemoryUsage();
    
    return session;
  }

  /**
   * 创建新的会话对象
   * @returns UserSession - 新的会话对象
   */
  private createNewSession(): UserSession {
    const now = Date.now();
    return {
      images: new Set(),
      imageMetadata: new Map(),
      lastAccess: now,
      createdAt: now,
      requestCount: 0,
      preferences: undefined,
      stats: {
        totalImageRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        topCategories: new Map(),
        sessionDuration: 0
      }
    };
  }

  /**
   * 更新会话统计信息
   * @param sessionId - 会话ID
   * @param responseTime - 响应时间
   * @param success - 是否成功
   * @param category - 图片类别
   */
  updateSessionStats(sessionId: string, responseTime: number, success: boolean, category?: string): void {
    // 确保会话存在
    const session = this.getOrCreateSession(sessionId);

    session.stats.totalImageRequests++;
    
    if (success) {
      session.stats.successfulRequests++;
      
      // 更新平均响应时间
      const totalSuccessful = session.stats.successfulRequests;
      session.stats.averageResponseTime = 
        (session.stats.averageResponseTime * (totalSuccessful - 1) + responseTime) / totalSuccessful;
      
      // 更新类别统计
      if (category) {
        const currentCount = session.stats.topCategories.get(category) || 0;
        session.stats.topCategories.set(category, currentCount + 1);
      }
    } else {
      session.stats.failedRequests++;
    }

    session.requestCount++;
    session.lastAccess = Date.now();
    session.stats.sessionDuration = session.lastAccess - session.createdAt;
  }

  /**
   * 添加图片到会话
   * @param sessionId - 会话ID
   * @param imageUrl - 图片URL
   * @param metadata - 图片元数据
   */
  addImageToSession(sessionId: string, imageUrl: string, metadata: Omit<ImageMetadata, 'usageCount'>): void {
    // 确保会话存在
    const session = this.getOrCreateSession(sessionId);

    // 检查是否已存在该图片
    const existingMetadata = session.imageMetadata.get(imageUrl);
    if (existingMetadata) {
      // 更新使用次数和时间戳
      existingMetadata.usageCount++;
      existingMetadata.timestamp = Date.now();
    } else {
      // 添加新图片
      session.images.add(imageUrl);
      session.imageMetadata.set(imageUrl, {
        ...metadata,
        usageCount: 1
      });
    }

    // 检查会话图片数量限制
    if (session.images.size > this.config.maxImagesPerSession) {
      this.cleanupSessionImages(sessionId);
    }
  }

  /**
   * 清理会话中的旧图片
   * @param sessionId - 会话ID
   */
  private cleanupSessionImages(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // 按时间戳排序，删除最旧的图片
    const sortedImages = Array.from(session.imageMetadata.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = sortedImages.slice(0, session.images.size - this.config.maxImagesPerSession);
    
    toRemove.forEach(([url]) => {
      session.images.delete(url);
      session.imageMetadata.delete(url);
    });

    if (toRemove.length > 0) {
      console.log(`🧹 清理会话 ${sessionId} 中的 ${toRemove.length} 张旧图片`);
    }
  }

  /**
   * 获取会话统计信息
   * @param sessionId - 会话ID
   * @returns 会话统计信息或null
   */
  getSessionStats(sessionId: string): SessionStats | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // 更新会话持续时间
    session.stats.sessionDuration = Date.now() - session.createdAt;
    
    return {
      ...session.stats,
      topCategories: new Map(session.stats.topCategories) // 返回副本
    };
  }

  /**
   * 获取会话详细信息
   * @param sessionId - 会话ID
   * @returns 会话详细信息或null
   */
  getSessionDetails(sessionId: string): {
    totalImages: number;
    requestCount: number;
    lastAccess: number;
    createdAt: number;
    categories: string[];
    sessionDuration: number;
    memoryUsage: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // 计算会话内存使用量（估算）
    const memoryUsage = this.estimateSessionMemoryUsage(session);

    // 获取使用过的类别
    const categories = Array.from(session.imageMetadata.values())
      .map(metadata => metadata.category)
      .filter((category, index, array) => array.indexOf(category) === index);

    return {
      totalImages: session.images.size,
      requestCount: session.requestCount,
      lastAccess: session.lastAccess,
      createdAt: session.createdAt,
      categories,
      sessionDuration: Date.now() - session.createdAt,
      memoryUsage
    };
  }

  /**
   * 估算会话内存使用量
   * @param session - 会话对象
   * @returns 内存使用量（字节）
   */
  private estimateSessionMemoryUsage(session: UserSession): number {
    let size = 0;
    
    // 基础对象大小
    size += 200; // 基础对象结构
    
    // Set<string> 大小估算
    for (const url of session.images) {
      size += url.length * 2 + 32; // 字符串 + Set 开销
    }
    
    // Map<string, ImageMetadata> 大小估算
    for (const [url, metadata] of session.imageMetadata) {
      size += url.length * 2 + 32; // 键
      size += 100; // 元数据对象
      size += metadata.category.length * 2; // 类别字符串
    }
    
    // 统计信息大小
    size += 200; // stats 对象
    for (const [category] of session.stats.topCategories) {
      size += category.length * 2 + 16; // Map 条目
    }
    
    return size;
  }

  /**
   * 清理指定会话
   * @param sessionId - 会话ID
   * @param reason - 清理原因
   * @returns 是否成功清理
   */
  clearSession(sessionId: string, reason: string = 'manual'): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.delete(sessionId);
    this.emit('session-cleaned', sessionId, reason);
    console.log(`🧹 清理会话: ${sessionId} (原因: ${reason})`);
    
    return true;
  }

  /**
   * 获取全局统计信息
   * @returns 全局统计信息
   */
  getGlobalStats(): {
    activeSessions: number;
    totalImagesTracked: number;
    oldestSession: number | null;
    totalMemoryUsage: number;
    averageSessionAge: number;
    sessionsCreatedToday: number;
  } {
    let totalImages = 0;
    let totalMemoryUsage = 0;
    let oldestAccess: number | null = null;
    let totalAge = 0;
    
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    let sessionsCreatedToday = 0;

    for (const [sessionId, session] of this.sessions) {
      totalImages += session.images.size;
      totalMemoryUsage += this.estimateSessionMemoryUsage(session);
      totalAge += (now - session.createdAt);
      
      if (session.createdAt > oneDayAgo) {
        sessionsCreatedToday++;
      }
      
      if (oldestAccess === null || session.lastAccess < oldestAccess) {
        oldestAccess = session.lastAccess;
      }
    }

    const averageSessionAge = this.sessions.size > 0 ? totalAge / this.sessions.size : 0;

    return {
      activeSessions: this.sessions.size,
      totalImagesTracked: totalImages,
      oldestSession: oldestAccess,
      totalMemoryUsage,
      averageSessionAge,
      sessionsCreatedToday
    };
  }

  /**
   * 启动定期清理定时器
   */
  private startCleanupTimer(): void {
    if (process.env.NODE_ENV === 'test') return; // 测试环境中不启动定时器

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);

    console.log(`🕐 启动会话清理定时器，间隔: ${this.config.cleanupInterval / 1000}秒`);
  }

  /**
   * 启动内存监控定时器
   */
  private startMemoryMonitor(): void {
    if (process.env.NODE_ENV === 'test') return; // 测试环境中不启动定时器

    this.memoryMonitorTimer = setInterval(() => {
      this.checkMemoryUsage();
    }, 5 * 60 * 1000); // 每5分钟检查一次

    console.log('🧠 启动内存监控定时器');
  }

  /**
   * 执行清理操作
   */
  private performCleanup(): void {
    const now = Date.now();
    const initialCount = this.sessions.size;
    let cleanedCount = 0;

    // 清理过期会话
    for (const [sessionId, session] of this.sessions) {
      const isExpired = (now - session.lastAccess) > this.config.sessionTimeout;
      
      if (isExpired) {
        this.sessions.delete(sessionId);
        this.emit('session-expired', sessionId, session);
        cleanedCount++;
      }
    }

    // 如果会话数量仍然超过限制，清理最旧的会话
    if (this.sessions.size > this.config.maxSessions) {
      const sortedSessions = Array.from(this.sessions.entries())
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

      const toRemove = sortedSessions.slice(0, this.sessions.size - this.config.maxSessions);
      
      toRemove.forEach(([sessionId, session]) => {
        this.sessions.delete(sessionId);
        this.emit('session-cleaned', sessionId, 'max_sessions_exceeded');
        cleanedCount++;
      });
    }

    if (cleanedCount > 0) {
      console.log(`🧹 定期清理完成: 清理了 ${cleanedCount} 个会话，剩余 ${this.sessions.size} 个`);
    }

    this.emit('cleanup-completed', cleanedCount, this.sessions.size);
  }

  /**
   * 手动触发清理操作（用于测试）
   */
  performManualCleanup(): void {
    this.performCleanup();
  }

  /**
   * 检查内存使用情况
   */
  private checkMemoryUsage(): void {
    const globalStats = this.getGlobalStats();
    
    if (globalStats.totalMemoryUsage > this.config.memoryThreshold) {
      this.emit('memory-warning', globalStats.totalMemoryUsage, this.config.memoryThreshold);
      
      console.warn(`⚠️ 内存使用超过阈值: ${(globalStats.totalMemoryUsage / 1024 / 1024).toFixed(2)}MB / ${(this.config.memoryThreshold / 1024 / 1024).toFixed(2)}MB`);
      
      // 强制清理最旧的会话
      this.forceCleanupOldSessions(0.2); // 清理20%的最旧会话
    }
  }

  /**
   * 强制清理最旧的会话
   * @param percentage - 要清理的会话百分比 (0-1)
   */
  private forceCleanupOldSessions(percentage: number): void {
    const toCleanCount = Math.ceil(this.sessions.size * percentage);
    if (toCleanCount === 0) return;

    const sortedSessions = Array.from(this.sessions.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

    const toRemove = sortedSessions.slice(0, toCleanCount);
    
    toRemove.forEach(([sessionId, session]) => {
      this.sessions.delete(sessionId);
      this.emit('session-cleaned', sessionId, 'memory_pressure');
    });

    console.log(`🧹 内存压力清理: 清理了 ${toRemove.length} 个最旧的会话`);
  }

  /**
   * 更新会话配置
   * @param newConfig - 新的配置
   */
  updateConfig(newConfig: Partial<SessionCleanupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ 会话管理器配置已更新:', newConfig);
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getConfig(): SessionCleanupConfig {
    return { ...this.config };
  }

  /**
   * 销毁会话管理器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer);
      this.memoryMonitorTimer = null;
    }

    this.sessions.clear();
    this.removeAllListeners();
    
    console.log('🔥 会话管理器已销毁');
  }

  /**
   * 导出会话数据（用于调试和监控）
   * @returns 会话数据摘要
   */
  exportSessionData(): {
    sessions: Array<{
      sessionId: string;
      imageCount: number;
      requestCount: number;
      lastAccess: string;
      createdAt: string;
      memoryUsage: number;
      topCategories: Array<{ category: string; count: number }>;
    }>;
    globalStats: ReturnType<SessionManager['getGlobalStats']>;
    config: SessionCleanupConfig;
  } {
    const sessions = Array.from(this.sessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      imageCount: session.images.size,
      requestCount: session.requestCount,
      lastAccess: new Date(session.lastAccess).toISOString(),
      createdAt: new Date(session.createdAt).toISOString(),
      memoryUsage: this.estimateSessionMemoryUsage(session),
      topCategories: Array.from(session.stats.topCategories.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) // 只返回前5个类别
    }));

    return {
      sessions,
      globalStats: this.getGlobalStats(),
      config: this.config
    };
  }
}

// 创建全局会话管理器实例
export const sessionManager = new SessionManager();

// 监听会话管理器事件
sessionManager.on('memory-warning', (usage, threshold) => {
  console.warn(`⚠️ 内存使用警告: ${(usage / 1024 / 1024).toFixed(2)}MB 超过阈值 ${(threshold / 1024 / 1024).toFixed(2)}MB`);
});

sessionManager.on('cleanup-completed', (cleaned, remaining) => {
  if (cleaned > 0) {
    console.log(`✅ 清理完成: 清理 ${cleaned} 个会话，剩余 ${remaining} 个`);
  }
});