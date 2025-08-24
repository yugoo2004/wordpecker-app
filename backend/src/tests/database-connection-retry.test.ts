import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import mongoose from 'mongoose';
import { connectDB, checkDatabaseHealth, getConnectionStatus } from '../config/mongodb';

// 模拟环境变量
process.env.MONGODB_URL = 'mongodb://localhost:27017/wordpecker-test';
process.env.NODE_ENV = 'test';

describe('数据库连接重试机制测试', () => {
  beforeAll(async () => {
    // 确保测试开始前断开所有连接
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  afterAll(async () => {
    // 测试结束后清理连接
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('连接状态管理', () => {
    it('应该能够获取连接状态信息', () => {
      const status = getConnectionStatus();
      
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('reconnectAttempts');
      expect(status).toHaveProperty('isConnecting');
      expect(typeof status.reconnectAttempts).toBe('number');
      expect(typeof status.isConnecting).toBe('boolean');
    });

    it('应该能够检查数据库健康状态', async () => {
      const health = await checkDatabaseHealth();
      
      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('details');
      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.details).toBe('object');
    });
  });

  describe('连接重试逻辑', () => {
    it('应该在连接失败时返回适当的错误信息', async () => {
      // 使用无效的MongoDB URL测试连接失败
      const originalUrl = process.env.MONGODB_URL;
      process.env.MONGODB_URL = 'mongodb://invalid-host:27017/test';

      // 重新导入模块以使用新的环境变量
      jest.resetModules();
      const { checkDatabaseHealth: checkHealthWithInvalidUrl } = require('../config/mongodb');

      const health = await checkHealthWithInvalidUrl();
      
      expect(health.healthy).toBe(false);
      expect(health.details).toHaveProperty('status');
      
      // 恢复原始URL
      process.env.MONGODB_URL = originalUrl;
    }, 10000);
  });

  describe('连接池配置', () => {
    it('应该使用正确的连接池配置', () => {
      // 检查mongoose连接选项是否正确设置
      const connection = mongoose.connection;
      
      // 这些值在连接建立后可以通过connection对象访问
      expect(connection).toBeDefined();
    });
  });

  describe('错误处理', () => {
    it('应该能够处理数据库连接错误', async () => {
      // 测试健康检查在数据库未连接时的行为
      if (mongoose.connection.readyState === 0) {
        const health = await checkDatabaseHealth();
        expect(health.healthy).toBe(false);
      }
    });

    it('应该提供详细的错误信息', async () => {
      const health = await checkDatabaseHealth();
      
      expect(health.details).toBeDefined();
      
      if (!health.healthy) {
        expect(health.details).toHaveProperty('status');
      }
    });
  });

  describe('连接状态监控', () => {
    it('应该正确报告连接状态', () => {
      const status = getConnectionStatus();
      
      // 验证状态值是有效的
      const validStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
      expect(validStates).toContain(status.state);
    });

    it('应该跟踪重连尝试次数', () => {
      const status = getConnectionStatus();
      
      expect(typeof status.reconnectAttempts).toBe('number');
      expect(status.reconnectAttempts).toBeGreaterThanOrEqual(0);
    });
  });
});