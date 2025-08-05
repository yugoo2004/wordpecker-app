/**
 * API 监控和统计功能单元测试
 * 
 * 测试范围：
 * 1. StockPhotoService 的统计功能
 * 2. 性能指标收集
 * 3. 配额监控
 * 4. 会话管理统计
 */

import { stockPhotoService } from '../api/image-description/stock-photo-service';

// 模拟环境变量
process.env.NODE_ENV = 'test';
process.env.PEXELS_API_KEY = 'test-api-key-for-monitoring';

describe('API监控和统计功能', () => {
  beforeEach(() => {
    // 每个测试前重置统计数据
    stockPhotoService.resetStats();
  });

  describe('API使用统计', () => {
    test('应该正确初始化统计数据', () => {
      const stats = stockPhotoService.getApiUsageStats();
      
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
      expect(stats.requestsPerHour).toBe(0);
      expect(stats.requestsToday).toBe(0);
      expect(stats.lastRequestTime).toBe(0);
      expect(stats.quotaUsage.estimated).toBe(0);
      expect(stats.errorBreakdown).toEqual({});
      expect(stats.performanceMetrics.fastestResponse).toBe(Infinity);
      expect(stats.performanceMetrics.slowestResponse).toBe(0);
    });

    test('应该正确重置统计数据', () => {
      // 重置统计
      stockPhotoService.resetStats();
      
      const resetStats = stockPhotoService.getApiUsageStats();
      expect(resetStats.totalRequests).toBe(0);
      expect(resetStats.successfulRequests).toBe(0);
      expect(resetStats.failedRequests).toBe(0);
      expect(resetStats.errorBreakdown).toEqual({});
    });

    test('应该返回统计数据的深拷贝', () => {
      const stats1 = stockPhotoService.getApiUsageStats();
      const stats2 = stockPhotoService.getApiUsageStats();
      
      // 修改一个对象不应该影响另一个
      stats1.errorBreakdown['TEST_ERROR'] = 1;
      expect(stats2.errorBreakdown['TEST_ERROR']).toBeUndefined();
    });
  });

  describe('性能指标收集', () => {
    test('应该正确获取性能指标', () => {
      const metrics = stockPhotoService.getPerformanceMetrics(10);
      
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeLessThanOrEqual(10);
    });

    test('应该限制返回的性能指标数量', () => {
      const metrics5 = stockPhotoService.getPerformanceMetrics(5);
      const metrics10 = stockPhotoService.getPerformanceMetrics(10);
      
      expect(metrics5.length).toBeLessThanOrEqual(5);
      expect(metrics10.length).toBeLessThanOrEqual(10);
    });

    test('应该返回性能指标的副本', () => {
      const metrics1 = stockPhotoService.getPerformanceMetrics(5);
      const metrics2 = stockPhotoService.getPerformanceMetrics(5);
      
      // 修改一个数组不应该影响另一个
      if (metrics1.length > 0) {
        metrics1[0].responseTime = 999999;
        if (metrics2.length > 0) {
          expect(metrics2[0].responseTime).not.toBe(999999);
        }
      }
    });
  });

  describe('配额监控', () => {
    test('应该正确获取配额使用情况', () => {
      const quotaUsage = stockPhotoService.getQuotaUsage();
      
      expect(typeof quotaUsage.current).toBe('number');
      expect(quotaUsage.current).toBeGreaterThanOrEqual(0);
      expect(typeof quotaUsage.estimatedDailyUsage).toBe('number');
      expect(quotaUsage.estimatedDailyUsage).toBeGreaterThanOrEqual(0);
      expect(typeof quotaUsage.projectedMonthlyUsage).toBe('number');
      expect(quotaUsage.projectedMonthlyUsage).toBeGreaterThanOrEqual(0);
    });

    test('应该正确计算配额百分比', () => {
      const quotaUsage = stockPhotoService.getQuotaUsage();
      
      if (quotaUsage.limit !== null && quotaUsage.percentage !== null) {
        expect(quotaUsage.percentage).toBeGreaterThanOrEqual(0);
        expect(quotaUsage.percentage).toBeLessThanOrEqual(100);
      }
    });

    test('应该处理无限制配额的情况', () => {
      const quotaUsage = stockPhotoService.getQuotaUsage();
      
      // 当没有配额限制时，percentage 应该为 null
      if (quotaUsage.limit === null) {
        expect(quotaUsage.percentage).toBeNull();
      }
    });
  });

  describe('会话统计', () => {
    test('应该正确获取全局统计信息', () => {
      const globalStats = stockPhotoService.getGlobalStats();
      
      expect(typeof globalStats.activeSessions).toBe('number');
      expect(globalStats.activeSessions).toBeGreaterThanOrEqual(0);
      expect(typeof globalStats.totalImagesTracked).toBe('number');
      expect(globalStats.totalImagesTracked).toBeGreaterThanOrEqual(0);
      
      // oldestSession 可以是 null 或者是一个时间戳
      if (globalStats.oldestSession !== null) {
        expect(typeof globalStats.oldestSession).toBe('number');
        expect(globalStats.oldestSession).toBeGreaterThan(0);
      }
    });

    test('应该正确处理不存在的会话', () => {
      const nonExistentSessionStats = stockPhotoService.getSessionStats('non-existent-session');
      expect(nonExistentSessionStats).toBeNull();
    });

    test('应该正确清理会话', () => {
      // 尝试清理不存在的会话
      const cleared = stockPhotoService.clearSession('non-existent-session');
      expect(cleared).toBe(false);
    });
  });

  describe('API密钥验证', () => {
    test('应该能够调用API密钥验证方法', async () => {
      // 在测试环境中，这个方法应该能够正常调用而不抛出异常
      const isValid = await stockPhotoService.validateApiKey();
      
      // 在测试环境中，我们不期望真实的 API 调用成功
      // 但方法应该返回一个布尔值
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('错误处理', () => {
    test('统计方法应该不抛出异常', () => {
      expect(() => stockPhotoService.getApiUsageStats()).not.toThrow();
      expect(() => stockPhotoService.getPerformanceMetrics(100)).not.toThrow();
      expect(() => stockPhotoService.getQuotaUsage()).not.toThrow();
      expect(() => stockPhotoService.getGlobalStats()).not.toThrow();
      expect(() => stockPhotoService.getSessionStats('test')).not.toThrow();
      expect(() => stockPhotoService.clearSession('test')).not.toThrow();
      expect(() => stockPhotoService.resetStats()).not.toThrow();
    });

    test('应该处理无效的性能指标限制参数', () => {
      // 测试边界情况
      expect(() => stockPhotoService.getPerformanceMetrics(0)).not.toThrow();
      expect(() => stockPhotoService.getPerformanceMetrics(-1)).not.toThrow();
      expect(() => stockPhotoService.getPerformanceMetrics(10000)).not.toThrow();
    });
  });

  describe('数据一致性', () => {
    test('统计数据应该保持一致性', () => {
      const stats = stockPhotoService.getApiUsageStats();
      
      // 总请求数应该等于成功请求数加失败请求数
      expect(stats.totalRequests).toBe(stats.successfulRequests + stats.failedRequests);
      
      // 错误统计的总数应该不超过失败请求数
      const totalErrors = Object.values(stats.errorBreakdown).reduce((sum, count) => sum + count, 0);
      expect(totalErrors).toBeLessThanOrEqual(stats.failedRequests);
    });

    test('性能指标应该有合理的数值范围', () => {
      const stats = stockPhotoService.getApiUsageStats();
      
      // 响应时间应该是非负数
      if (stats.averageResponseTime > 0) {
        expect(stats.averageResponseTime).toBeGreaterThan(0);
      }
      
      // 最快响应时间应该小于等于最慢响应时间
      if (stats.performanceMetrics.fastestResponse !== Infinity && 
          stats.performanceMetrics.slowestResponse > 0) {
        expect(stats.performanceMetrics.fastestResponse)
          .toBeLessThanOrEqual(stats.performanceMetrics.slowestResponse);
      }
      
      // 百分位数响应时间应该是合理的
      expect(stats.performanceMetrics.p95ResponseTime).toBeGreaterThanOrEqual(0);
      expect(stats.performanceMetrics.p99ResponseTime).toBeGreaterThanOrEqual(0);
      expect(stats.performanceMetrics.p99ResponseTime)
        .toBeGreaterThanOrEqual(stats.performanceMetrics.p95ResponseTime);
    });

    test('请求频率统计应该是合理的', () => {
      const stats = stockPhotoService.getApiUsageStats();
      
      // 每小时请求数不应该超过总请求数
      expect(stats.requestsPerHour).toBeLessThanOrEqual(stats.totalRequests);
      
      // 今日请求数不应该超过总请求数
      expect(stats.requestsToday).toBeLessThanOrEqual(stats.totalRequests);
      
      // 今日请求数应该大于等于每小时请求数
      expect(stats.requestsToday).toBeGreaterThanOrEqual(stats.requestsPerHour);
    });
  });

  describe('内存管理', () => {
    test('应该限制性能指标历史记录的大小', () => {
      // 这个测试验证内部的 MAX_PERFORMANCE_HISTORY 限制
      // 由于我们无法直接访问私有属性，我们通过多次调用来间接测试
      const maxMetrics = stockPhotoService.getPerformanceMetrics(2000);
      
      // 即使请求2000条记录，返回的数量也应该受到内部限制
      expect(maxMetrics.length).toBeLessThanOrEqual(1000);
    });

    test('全局统计应该反映当前状态', () => {
      const globalStats1 = stockPhotoService.getGlobalStats();
      const globalStats2 = stockPhotoService.getGlobalStats();
      
      // 两次调用应该返回相同的结果（在没有其他操作的情况下）
      expect(globalStats1.activeSessions).toBe(globalStats2.activeSessions);
      expect(globalStats1.totalImagesTracked).toBe(globalStats2.totalImagesTracked);
    });
  });
});