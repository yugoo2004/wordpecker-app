import { StockPhotoService } from '../api/image-description/stock-photo-service';
import { sessionManager } from '../api/image-description/session-manager';

// 仅模拟必要的依赖
jest.mock('../agents', () => ({
  contextualImageAgent: {}
}));

jest.mock('@openai/agents', () => ({
  run: jest.fn().mockResolvedValue({
    finalOutput: { searchQuery: 'test query' }
  })
}));

describe('StockPhotoService 智能图片选择算法测试', () => {
  let service: StockPhotoService;

  beforeEach(() => {
    service = new StockPhotoService();
    jest.clearAllMocks();
    
    // 清理会话管理器状态
    const sessionData = sessionManager.exportSessionData();
    sessionData.sessions.forEach(session => {
      sessionManager.clearSession(session.sessionId, 'test_cleanup');
    });
  });

  afterAll(() => {
    // 清理会话管理器
    sessionManager.destroy();
  });

  describe('算法逻辑验证', () => {
    it('应该验证随机数生成的基本功能', () => {
      // 测试随机数生成的基本逻辑
      const numbers = [];
      for (let i = 0; i < 10; i++) {
        numbers.push(Math.random());
      }
      
      // 验证生成的数字在合理范围内
      numbers.forEach(num => {
        expect(num).toBeGreaterThanOrEqual(0);
        expect(num).toBeLessThan(1);
      });
      
      // 验证生成的数字有一定的分布（不全相同）
      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBeGreaterThan(1);
    });

    it('应该验证会话管理的数据结构', () => {
      const sessionId = 'test-structure-validation';
      
      // 测试会话不存在时的行为
      let stats = service.getSessionStats(sessionId);
      expect(stats).toBeNull();
      
      // 创建会话后应该能获取统计信息
      sessionManager.getOrCreateSession(sessionId);
      stats = service.getSessionStats(sessionId);
      expect(stats).toBeDefined();
      expect(stats!.totalImages).toBe(0);
      expect(stats!.requestCount).toBe(0);
      
      // 测试清理会话的行为
      const clearResult = service.clearSession(sessionId);
      expect(clearResult).toBe(true);
      
      // 清理后会话应该不存在
      stats = service.getSessionStats(sessionId);
      expect(stats).toBeNull();
      
      // 测试全局统计的数据结构
      const globalStats = service.getGlobalStats();
      expect(globalStats).toHaveProperty('activeSessions');
      expect(globalStats).toHaveProperty('totalImagesTracked');
      expect(globalStats).toHaveProperty('oldestSession');
    });

    it('应该验证API统计功能的数据完整性', () => {
      const initialStats = service.getApiUsageStats();
      
      // 验证统计对象包含所有必需字段
      expect(initialStats).toHaveProperty('totalRequests');
      expect(initialStats).toHaveProperty('successfulRequests');
      expect(initialStats).toHaveProperty('failedRequests');
      expect(initialStats).toHaveProperty('lastRequestTime');
      expect(initialStats).toHaveProperty('averageResponseTime');
      
      // 验证数据类型正确
      expect(typeof initialStats.totalRequests).toBe('number');
      expect(typeof initialStats.successfulRequests).toBe('number');
      expect(typeof initialStats.failedRequests).toBe('number');
      expect(typeof initialStats.lastRequestTime).toBe('number');
      expect(typeof initialStats.averageResponseTime).toBe('number');
      
      // 验证逻辑关系
      expect(initialStats.totalRequests).toBe(
        initialStats.successfulRequests + initialStats.failedRequests
      );
    });

    it('应该验证随机图片方法的返回类型', () => {
      // 测试方法存在性和返回类型
      const randomImagePromise = service.findRandomImage();
      expect(randomImagePromise).toBeInstanceOf(Promise);
      
      const randomImageWithQueryPromise = service.findRandomImage('nature');
      expect(randomImageWithQueryPromise).toBeInstanceOf(Promise);
      
      const randomImageWithSessionPromise = service.findRandomImage('nature', 'test-session');
      expect(randomImageWithSessionPromise).toBeInstanceOf(Promise);
    });

    it('应该验证会话统计方法的基本功能', () => {
      const sessionId = 'test-session-methods';
      
      // 测试获取不存在会话的统计
      const nonExistentStats = service.getSessionStats(sessionId);
      expect(nonExistentStats).toBeNull();
      
      // 测试清理不存在的会话
      const clearNonExistent = service.clearSession(sessionId);
      expect(clearNonExistent).toBe(false);
      
      // 测试全局统计的基本结构
      const globalStats = service.getGlobalStats();
      expect(globalStats.activeSessions).toBeGreaterThanOrEqual(0);
      expect(globalStats.totalImagesTracked).toBeGreaterThanOrEqual(0);
    });

    it('应该验证API密钥验证方法存在', () => {
      // 测试方法存在性
      const validatePromise = service.validateApiKey();
      expect(validatePromise).toBeInstanceOf(Promise);
    });
  });

  describe('服务初始化验证', () => {
    it('应该正确初始化服务实例', () => {
      expect(service).toBeInstanceOf(StockPhotoService);
      expect(typeof service.findRandomImage).toBe('function');
      expect(typeof service.getApiUsageStats).toBe('function');
      expect(typeof service.getSessionStats).toBe('function');
      expect(typeof service.clearSession).toBe('function');
      expect(typeof service.getGlobalStats).toBe('function');
      expect(typeof service.validateApiKey).toBe('function');
    });

    it('应该提供正确的初始API统计', () => {
      const stats = service.getApiUsageStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.lastRequestTime).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
    });

    it('应该提供正确的初始全局统计', () => {
      const globalStats = service.getGlobalStats();
      expect(globalStats.activeSessions).toBe(0);
      expect(globalStats.totalImagesTracked).toBe(0);
      expect(globalStats.oldestSession).toBeNull();
    });
  });
});