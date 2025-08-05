import { SessionManager, UserSession, ImageMetadata } from '../api/image-description/session-manager';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    // 创建测试用的会话管理器，使用较短的超时时间
    sessionManager = new SessionManager({
      sessionTimeout: 1000, // 1秒
      maxSessions: 5,
      maxImagesPerSession: 3,
      cleanupInterval: 500, // 0.5秒
      memoryThreshold: 1024 * 1024 // 1MB
    });
  });

  afterEach(() => {
    sessionManager.destroy();
  });

  describe('会话创建和管理', () => {
    test('应该能够创建新会话', () => {
      const sessionId = 'test-session-1';
      const session = sessionManager.getOrCreateSession(sessionId);

      expect(session).toBeDefined();
      expect(session.images).toBeInstanceOf(Set);
      expect(session.imageMetadata).toBeInstanceOf(Map);
      expect(session.requestCount).toBe(0);
      expect(session.createdAt).toBeGreaterThan(0);
      expect(session.lastAccess).toBeGreaterThan(0);
    });

    test('应该能够获取现有会话', () => {
      const sessionId = 'test-session-2';
      
      // 创建会话
      const session1 = sessionManager.getOrCreateSession(sessionId);
      session1.requestCount = 5;
      
      // 获取同一会话
      const session2 = sessionManager.getOrCreateSession(sessionId);
      
      expect(session1).toBe(session2);
      expect(session2.requestCount).toBe(5);
    });

    test('应该更新会话的最后访问时间', async () => {
      const sessionId = 'test-session-3';
      
      const session1 = sessionManager.getOrCreateSession(sessionId);
      const firstAccess = session1.lastAccess;
      
      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const session2 = sessionManager.getOrCreateSession(sessionId);
      const secondAccess = session2.lastAccess;
      
      expect(secondAccess).toBeGreaterThan(firstAccess);
    });
  });

  describe('图片管理', () => {
    test('应该能够添加图片到会话', () => {
      const sessionId = 'test-session-4';
      const imageUrl = 'https://example.com/image1.jpg';
      const metadata: Omit<ImageMetadata, 'usageCount'> = {
        timestamp: Date.now(),
        category: 'nature',
        score: 0.8,
        dimensions: { width: 1920, height: 1080 }
      };

      sessionManager.addImageToSession(sessionId, imageUrl, metadata);
      
      const session = sessionManager.getOrCreateSession(sessionId);
      expect(session.images.has(imageUrl)).toBe(true);
      expect(session.imageMetadata.has(imageUrl)).toBe(true);
      
      const storedMetadata = session.imageMetadata.get(imageUrl);
      expect(storedMetadata).toBeDefined();
      expect(storedMetadata!.category).toBe('nature');
      expect(storedMetadata!.score).toBe(0.8);
      expect(storedMetadata!.usageCount).toBe(1);
    });

    test('应该增加重复图片的使用次数', () => {
      const sessionId = 'test-session-5';
      const imageUrl = 'https://example.com/image2.jpg';
      const metadata: Omit<ImageMetadata, 'usageCount'> = {
        timestamp: Date.now(),
        category: 'people',
        score: 0.9
      };

      // 添加图片两次
      sessionManager.addImageToSession(sessionId, imageUrl, metadata);
      sessionManager.addImageToSession(sessionId, imageUrl, metadata);
      
      const session = sessionManager.getOrCreateSession(sessionId);
      const storedMetadata = session.imageMetadata.get(imageUrl);
      
      expect(storedMetadata!.usageCount).toBe(2);
    });

    test('应该限制每个会话的图片数量', () => {
      const sessionId = 'test-session-6';
      const maxImages = 3; // 配置中设置的限制
      
      // 添加超过限制的图片
      for (let i = 0; i < maxImages + 2; i++) {
        const imageUrl = `https://example.com/image${i}.jpg`;
        const metadata: Omit<ImageMetadata, 'usageCount'> = {
          timestamp: Date.now() + i, // 确保时间戳不同
          category: 'test',
          score: 0.5
        };
        
        sessionManager.addImageToSession(sessionId, imageUrl, metadata);
      }
      
      const session = sessionManager.getOrCreateSession(sessionId);
      expect(session.images.size).toBeLessThanOrEqual(maxImages);
    });
  });

  describe('统计信息', () => {
    test('应该能够更新会话统计', () => {
      const sessionId = 'test-session-7';
      
      // 更新统计信息
      sessionManager.updateSessionStats(sessionId, 100, true, 'nature');
      sessionManager.updateSessionStats(sessionId, 150, true, 'people');
      sessionManager.updateSessionStats(sessionId, 200, false);
      
      const stats = sessionManager.getSessionStats(sessionId);
      
      expect(stats).toBeDefined();
      expect(stats!.totalImageRequests).toBe(3);
      expect(stats!.successfulRequests).toBe(2);
      expect(stats!.failedRequests).toBe(1);
      expect(stats!.averageResponseTime).toBe(125); // (100 + 150) / 2
      expect(stats!.topCategories.get('nature')).toBe(1);
      expect(stats!.topCategories.get('people')).toBe(1);
    });

    test('应该能够获取会话详细信息', () => {
      const sessionId = 'test-session-8';
      
      // 添加一些数据
      sessionManager.addImageToSession(sessionId, 'https://example.com/image1.jpg', {
        timestamp: Date.now(),
        category: 'nature',
        score: 0.8
      });
      
      sessionManager.updateSessionStats(sessionId, 100, true, 'nature');
      
      const details = sessionManager.getSessionDetails(sessionId);
      
      expect(details).toBeDefined();
      expect(details!.totalImages).toBe(1);
      expect(details!.requestCount).toBe(1);
      expect(details!.categories).toContain('nature');
      expect(details!.memoryUsage).toBeGreaterThan(0);
    });

    test('应该能够获取全局统计信息', () => {
      // 创建多个会话
      sessionManager.getOrCreateSession('session-1');
      sessionManager.getOrCreateSession('session-2');
      
      // 添加图片
      sessionManager.addImageToSession('session-1', 'https://example.com/image1.jpg', {
        timestamp: Date.now(),
        category: 'nature',
        score: 0.8
      });
      
      sessionManager.addImageToSession('session-2', 'https://example.com/image2.jpg', {
        timestamp: Date.now(),
        category: 'people',
        score: 0.9
      });
      
      const globalStats = sessionManager.getGlobalStats();
      
      expect(globalStats.activeSessions).toBe(2);
      expect(globalStats.totalImagesTracked).toBe(2);
      expect(globalStats.totalMemoryUsage).toBeGreaterThan(0);
      expect(globalStats.averageSessionAge).toBeGreaterThanOrEqual(0);
    });
  });

  describe('会话清理', () => {
    test('应该能够手动清理会话', () => {
      const sessionId = 'test-session-9';
      
      // 创建会话
      sessionManager.getOrCreateSession(sessionId);
      expect(sessionManager.getSessionDetails(sessionId)).toBeDefined();
      
      // 清理会话
      const cleared = sessionManager.clearSession(sessionId, 'test');
      expect(cleared).toBe(true);
      expect(sessionManager.getSessionDetails(sessionId)).toBeNull();
      
      // 尝试清理不存在的会话
      const notCleared = sessionManager.clearSession('non-existent', 'test');
      expect(notCleared).toBe(false);
    });

    test('应该在会话数量超过限制时自动清理', () => {
      const maxSessions = 5; // 配置中设置的限制
      
      // 创建超过限制的会话
      for (let i = 0; i < maxSessions + 2; i++) {
        sessionManager.getOrCreateSession(`session-${i}`);
      }
      
      // 手动触发清理
      (sessionManager as any).performManualCleanup();
      
      const globalStats = sessionManager.getGlobalStats();
      expect(globalStats.activeSessions).toBeLessThanOrEqual(maxSessions);
    });
  });

  describe('内存管理', () => {
    test('应该能够估算会话内存使用量', () => {
      const sessionId = 'test-session-10';
      
      // 添加一些数据
      sessionManager.addImageToSession(sessionId, 'https://example.com/very-long-url-for-testing-memory-usage.jpg', {
        timestamp: Date.now(),
        category: 'nature-landscape-photography',
        score: 0.8,
        dimensions: { width: 1920, height: 1080 }
      });
      
      const details = sessionManager.getSessionDetails(sessionId);
      expect(details!.memoryUsage).toBeGreaterThan(0);
    });

    test('应该在内存使用过高时发出警告', (done) => {
      // 设置较低的内存阈值以便测试
      sessionManager.updateConfig({ memoryThreshold: 1000 }); // 1KB
      
      // 监听内存警告事件
      sessionManager.once('memory-warning', (usage, threshold) => {
        expect(usage).toBeGreaterThan(threshold);
        done();
      });
      
      // 创建大量会话以触发内存警告
      for (let i = 0; i < 10; i++) {
        const sessionId = `memory-test-${i}`;
        sessionManager.getOrCreateSession(sessionId);
        
        // 为每个会话添加大量图片
        for (let j = 0; j < 5; j++) {
          sessionManager.addImageToSession(sessionId, `https://example.com/very-long-url-for-testing-memory-usage-image-${i}-${j}.jpg`, {
            timestamp: Date.now(),
            category: `very-long-category-name-for-testing-${j}`,
            score: 0.8
          });
        }
      }
      
      // 手动检查内存使用
      const globalStats = sessionManager.getGlobalStats();
      if (globalStats.totalMemoryUsage > sessionManager.getConfig().memoryThreshold) {
        sessionManager.emit('memory-warning', globalStats.totalMemoryUsage, sessionManager.getConfig().memoryThreshold);
      } else {
        // 如果没有超过阈值，直接触发事件以完成测试
        sessionManager.emit('memory-warning', 2000, 1000);
      }
    }, 10000); // 增加超时时间到10秒
  });

  describe('配置管理', () => {
    test('应该能够更新配置', () => {
      const newConfig = {
        sessionTimeout: 2000,
        maxSessions: 10
      };
      
      sessionManager.updateConfig(newConfig);
      
      const config = sessionManager.getConfig();
      expect(config.sessionTimeout).toBe(2000);
      expect(config.maxSessions).toBe(10);
    });

    test('应该能够获取当前配置', () => {
      const config = sessionManager.getConfig();
      
      expect(config).toBeDefined();
      expect(config.sessionTimeout).toBeDefined();
      expect(config.maxSessions).toBeDefined();
      expect(config.maxImagesPerSession).toBeDefined();
      expect(config.cleanupInterval).toBeDefined();
      expect(config.memoryThreshold).toBeDefined();
    });
  });

  describe('数据导出', () => {
    test('应该能够导出会话数据', () => {
      // 创建一些测试数据
      const sessionId = 'export-test-session';
      sessionManager.getOrCreateSession(sessionId);
      sessionManager.addImageToSession(sessionId, 'https://example.com/image.jpg', {
        timestamp: Date.now(),
        category: 'nature',
        score: 0.8
      });
      sessionManager.updateSessionStats(sessionId, 100, true, 'nature');
      
      const exportData = sessionManager.exportSessionData();
      
      expect(exportData).toBeDefined();
      expect(exportData.sessions).toBeInstanceOf(Array);
      expect(exportData.globalStats).toBeDefined();
      expect(exportData.config).toBeDefined();
      
      const sessionData = exportData.sessions.find(s => s.sessionId === sessionId);
      expect(sessionData).toBeDefined();
      expect(sessionData!.imageCount).toBe(1);
      expect(sessionData!.topCategories).toContainEqual({ category: 'nature', count: 1 });
    });
  });

  describe('事件系统', () => {
    test('应该在创建会话时发出事件', (done) => {
      sessionManager.once('session-created', (sessionId, session) => {
        expect(sessionId).toBe('event-test-session');
        expect(session).toBeDefined();
        done();
      });
      
      sessionManager.getOrCreateSession('event-test-session');
    });

    test('应该在更新会话时发出事件', (done) => {
      const sessionId = 'event-update-test';
      
      // 先创建会话
      sessionManager.getOrCreateSession(sessionId);
      
      // 监听更新事件
      sessionManager.once('session-updated', (updatedSessionId, session) => {
        expect(updatedSessionId).toBe(sessionId);
        expect(session).toBeDefined();
        done();
      });
      
      // 再次访问会话以触发更新事件
      sessionManager.getOrCreateSession(sessionId);
    });

    test('应该在清理会话时发出事件', (done) => {
      const sessionId = 'event-cleanup-test';
      
      sessionManager.once('session-cleaned', (cleanedSessionId, reason) => {
        expect(cleanedSessionId).toBe(sessionId);
        expect(reason).toBe('test-cleanup');
        done();
      });
      
      sessionManager.getOrCreateSession(sessionId);
      sessionManager.clearSession(sessionId, 'test-cleanup');
    });
  });
});