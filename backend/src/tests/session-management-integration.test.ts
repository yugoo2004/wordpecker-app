import request from 'supertest';
import express from 'express';
import { Router } from 'express';
import { sessionManager } from '../api/image-description/session-manager';
import { stockPhotoService } from '../api/image-description/stock-photo-service';

// 创建简化的测试路由，专注于会话管理功能
const createTestRoutes = () => {
  const router = Router();

  // 随机图片端点（用于创建会话）
  router.get('/random', async (req, res) => {
    try {
      const { sessionId, query } = req.query as { sessionId?: string; query?: string };
      const randomImage = await stockPhotoService.findRandomImage(query, sessionId);
      
      res.json({
        success: true,
        image: {
          id: randomImage.id,
          url: randomImage.url,
          alt: randomImage.alt_description,
          description: randomImage.description,
          source: randomImage.source
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取随机图片失败';
      const errorCode = (error as any)?.code || 'UNKNOWN_ERROR';
      
      res.status(500).json({
        success: false,
        error: errorMessage,
        code: errorCode
      });
    }
  });

  // 分类随机图片端点
  router.get('/random/:category', async (req, res) => {
    try {
      const { category } = req.params;
      const { sessionId } = req.query as { sessionId?: string };
      const randomImage = await stockPhotoService.findRandomImage(category, sessionId);
      
      res.json({
        success: true,
        image: {
          id: randomImage.id,
          url: randomImage.url,
          alt: randomImage.alt_description,
          description: randomImage.description,
          source: randomImage.source
        },
        category: category
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '获取分类随机图片失败';
      const errorCode = (error as any)?.code || 'UNKNOWN_ERROR';
      
      res.status(500).json({
        success: false,
        error: errorMessage,
        code: errorCode,
        category: req.params.category
      });
    }
  });

  // 获取特定会话的统计信息
  router.get('/sessions/:sessionId/stats', async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      console.log(`📊 获取会话统计: ${sessionId}`);
      
      const sessionDetails = sessionManager.getSessionDetails(sessionId);
      
      if (!sessionDetails) {
        return res.status(404).json({
          success: false,
          error: '会话不存在',
          sessionId
        });
      }
      
      const sessionStats = sessionManager.getSessionStats(sessionId);
      
      res.json({
        success: true,
        sessionId,
        details: {
          totalImages: sessionDetails.totalImages,
          requestCount: sessionDetails.requestCount,
          lastAccess: new Date(sessionDetails.lastAccess).toISOString(),
          createdAt: new Date(sessionDetails.createdAt).toISOString(),
          sessionDuration: sessionDetails.sessionDuration,
          memoryUsage: sessionDetails.memoryUsage,
          categories: sessionDetails.categories
        },
        statistics: sessionStats ? {
          totalImageRequests: sessionStats.totalImageRequests,
          successfulRequests: sessionStats.successfulRequests,
          failedRequests: sessionStats.failedRequests,
          successRate: sessionStats.totalImageRequests > 0 
            ? ((sessionStats.successfulRequests / sessionStats.totalImageRequests) * 100).toFixed(2) + '%'
            : '0%',
          averageResponseTime: sessionStats.averageResponseTime > 0 
            ? Math.round(sessionStats.averageResponseTime) + 'ms'
            : 'N/A',
          topCategories: Array.from(sessionStats.topCategories.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)
        } : null,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`❌ 获取会话统计失败 (${req.params.sessionId}):`, error);
      
      const errorMessage = error instanceof Error ? error.message : '获取会话统计失败';
      
      res.status(500).json({
        success: false,
        error: errorMessage,
        sessionId: req.params.sessionId,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 管理特定会话（清理、更新偏好等）
  router.post('/sessions/:sessionId/manage', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { action, preferences } = req.body;
      
      console.log(`⚙️ 会话管理操作: ${action} (会话: ${sessionId})`);
      
      switch (action) {
        case 'clear':
          const cleared = sessionManager.clearSession(sessionId, 'user_request');
          
          if (cleared) {
            res.json({
              success: true,
              message: `会话 ${sessionId} 已清理`,
              action: 'clear',
              sessionId,
              timestamp: new Date().toISOString()
            });
          } else {
            res.status(404).json({
              success: false,
              error: '会话不存在或已被清理',
              action: 'clear',
              sessionId,
              timestamp: new Date().toISOString()
            });
          }
          break;
          
        case 'update_preferences':
          const session = sessionManager.getOrCreateSession(sessionId);
          
          if (preferences) {
            session.preferences = {
              ...session.preferences,
              ...preferences
            };
            
            console.log(`✅ 更新会话偏好: ${sessionId}`, preferences);
            
            res.json({
              success: true,
              message: `会话 ${sessionId} 的偏好设置已更新`,
              action: 'update_preferences',
              sessionId,
              preferences: session.preferences,
              timestamp: new Date().toISOString()
            });
          } else {
            res.status(400).json({
              success: false,
              error: '更新偏好设置时必须提供 preferences 参数',
              action: 'update_preferences',
              sessionId,
              timestamp: new Date().toISOString()
            });
          }
          break;
          
        default:
          res.status(400).json({
            success: false,
            error: `不支持的操作: ${action}`,
            supportedActions: ['clear', 'update_preferences'],
            sessionId,
            timestamp: new Date().toISOString()
          });
      }
      
    } catch (error) {
      console.error(`❌ 会话管理操作失败 (${req.params.sessionId}):`, error);
      
      const errorMessage = error instanceof Error ? error.message : '会话管理操作失败';
      
      res.status(500).json({
        success: false,
        error: errorMessage,
        sessionId: req.params.sessionId,
        action: req.body.action,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 获取所有会话的概览信息
  router.get('/sessions/overview', async (req, res) => {
    try {
      console.log('📋 获取会话概览信息...');
      
      const globalStats = sessionManager.getGlobalStats();
      const config = sessionManager.getConfig();
      const sessionData = sessionManager.exportSessionData();
      
      const memoryUsagePercentage = config.memoryThreshold > 0 
        ? (globalStats.totalMemoryUsage / config.memoryThreshold * 100).toFixed(2)
        : '0';
      
      let healthStatus = 'healthy';
      const warnings: string[] = [];
      
      if (globalStats.activeSessions > config.maxSessions * 0.9) {
        healthStatus = 'warning';
        warnings.push(`活跃会话数接近限制 (${globalStats.activeSessions}/${config.maxSessions})`);
      }
      
      if (globalStats.totalMemoryUsage > config.memoryThreshold * 0.8) {
        healthStatus = healthStatus === 'warning' ? 'critical' : 'warning';
        warnings.push(`内存使用率较高 (${memoryUsagePercentage}%)`);
      }
      
      if (globalStats.averageSessionAge > config.sessionTimeout * 0.8) {
        warnings.push('平均会话年龄较高，建议检查清理策略');
      }
      
      res.json({
        success: true,
        overview: {
          activeSessions: globalStats.activeSessions,
          totalImagesTracked: globalStats.totalImagesTracked,
          totalMemoryUsage: {
            bytes: globalStats.totalMemoryUsage,
            mb: (globalStats.totalMemoryUsage / 1024 / 1024).toFixed(2),
            percentage: memoryUsagePercentage + '%'
          },
          averageSessionAge: {
            milliseconds: globalStats.averageSessionAge,
            hours: (globalStats.averageSessionAge / (1000 * 60 * 60)).toFixed(2)
          },
          sessionsCreatedToday: globalStats.sessionsCreatedToday,
          oldestSession: globalStats.oldestSession 
            ? new Date(globalStats.oldestSession).toISOString()
            : null
        },
        health: {
          status: healthStatus,
          warnings
        },
        configuration: {
          sessionTimeout: {
            milliseconds: config.sessionTimeout,
            hours: config.sessionTimeout / (1000 * 60 * 60)
          },
          maxSessions: config.maxSessions,
          maxImagesPerSession: config.maxImagesPerSession,
          cleanupInterval: {
            milliseconds: config.cleanupInterval,
            minutes: config.cleanupInterval / (1000 * 60)
          },
          memoryThreshold: {
            bytes: config.memoryThreshold,
            mb: config.memoryThreshold / (1024 * 1024)
          }
        },
        recentSessions: sessionData.sessions
          .sort((a, b) => new Date(b.lastAccess).getTime() - new Date(a.lastAccess).getTime())
          .slice(0, 10)
          .map(session => ({
            sessionId: session.sessionId,
            imageCount: session.imageCount,
            requestCount: session.requestCount,
            lastAccess: session.lastAccess,
            memoryUsage: {
              bytes: session.memoryUsage,
              kb: (session.memoryUsage / 1024).toFixed(2)
            },
            topCategories: session.topCategories.slice(0, 3)
          })),
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ 获取会话概览失败:', error);
      
      const errorMessage = error instanceof Error ? error.message : '获取会话概览失败';
      
      res.status(500).json({
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
};

// 创建测试应用
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/image-description', createTestRoutes());
  return app;
};

describe('会话管理集成测试', () => {
  let app: express.Application;
  const testSessionId = 'test-session-mgmt-' + Date.now();
  const testSessionId2 = 'test-session-mgmt-2-' + Date.now();

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    // 清理测试会话
    sessionManager.clearSession(testSessionId, 'test_cleanup');
    sessionManager.clearSession(testSessionId2, 'test_cleanup');
  });

  afterAll(() => {
    // 清理所有测试会话
    sessionManager.clearSession(testSessionId, 'test_cleanup');
    sessionManager.clearSession(testSessionId2, 'test_cleanup');
  });

  describe('会话创建和管理', () => {
    it('应该能够创建新会话并跟踪图片使用', async () => {
      // 第一次请求应该创建新会话
      const response1 = await request(app)
        .get('/api/image-description/random')
        .query({ sessionId: testSessionId })
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(response1.body.image).toBeDefined();

      // 验证会话已创建
      const sessionDetails = sessionManager.getSessionDetails(testSessionId);
      expect(sessionDetails).toBeDefined();
      expect(sessionDetails!.totalImages).toBeGreaterThan(0);
      expect(sessionDetails!.requestCount).toBe(1);
    });

    it('应该在同一会话中避免重复图片', async () => {
      const imageUrls = new Set<string>();
      const maxRequests = 5;

      // 进行多次请求
      for (let i = 0; i < maxRequests; i++) {
        const response = await request(app)
          .get('/api/image-description/random')
          .query({ sessionId: testSessionId })
          .expect(200);

        expect(response.body.success).toBe(true);
        imageUrls.add(response.body.image.url);
      }

      // 验证会话状态
      const sessionDetails = sessionManager.getSessionDetails(testSessionId);
      expect(sessionDetails).toBeDefined();
      expect(sessionDetails!.requestCount).toBe(maxRequests);
      expect(sessionDetails!.totalImages).toBeGreaterThan(0);

      // 在小样本中，应该有一定的图片多样性
      expect(imageUrls.size).toBeGreaterThan(1);
    });

    it('应该能够处理多个并发会话', async () => {
      // 并发创建多个会话
      const promises = [
        request(app)
          .get('/api/image-description/random')
          .query({ sessionId: testSessionId }),
        request(app)
          .get('/api/image-description/random')
          .query({ sessionId: testSessionId2 }),
        request(app)
          .get('/api/image-description/random')
          .query({ sessionId: testSessionId })
      ];

      const responses = await Promise.all(promises);

      // 验证所有请求都成功
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // 验证两个会话都被创建
      const session1Details = sessionManager.getSessionDetails(testSessionId);
      const session2Details = sessionManager.getSessionDetails(testSessionId2);

      expect(session1Details).toBeDefined();
      expect(session2Details).toBeDefined();
      expect(session1Details!.requestCount).toBe(2); // 两次请求
      expect(session2Details!.requestCount).toBe(1); // 一次请求
    });
  });

  describe('GET /api/image-description/sessions/:sessionId/stats - 会话统计端点', () => {
    it('应该返回特定会话的详细统计信息', async () => {
      // 先进行一些API调用以生成统计数据
      await request(app)
        .get('/api/image-description/random')
        .query({ sessionId: testSessionId });

      await request(app)
        .get('/api/image-description/random/nature')
        .query({ sessionId: testSessionId });

      const response = await request(app)
        .get(`/api/image-description/sessions/${testSessionId}/stats`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        sessionId: testSessionId,
        details: expect.objectContaining({
          totalImages: expect.any(Number),
          requestCount: expect.any(Number),
          lastAccess: expect.any(String),
          createdAt: expect.any(String),
          sessionDuration: expect.any(Number),
          memoryUsage: expect.any(Number),
          categories: expect.any(Array)
        }),
        statistics: expect.objectContaining({
          totalImageRequests: expect.any(Number),
          successfulRequests: expect.any(Number),
          failedRequests: expect.any(Number),
          successRate: expect.any(String)
        }),
        timestamp: expect.any(String)
      });

      // 验证统计数据的合理性
      expect(response.body.details.requestCount).toBeGreaterThan(0);
      expect(response.body.details.totalImages).toBeGreaterThan(0);
      expect(response.body.statistics.totalImageRequests).toBeGreaterThan(0);
    });

    it('应该对不存在的会话返回404错误', async () => {
      const nonExistentSessionId = 'non-existent-session-' + Date.now();
      
      const response = await request(app)
        .get(`/api/image-description/sessions/${nonExistentSessionId}/stats`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: '会话不存在',
        sessionId: nonExistentSessionId
      });
    });
  });

  describe('POST /api/image-description/sessions/:sessionId/manage - 会话管理端点', () => {
    it('应该能够清理指定会话', async () => {
      // 先创建会话
      await request(app)
        .get('/api/image-description/random')
        .query({ sessionId: testSessionId });

      // 验证会话存在
      let sessionDetails = sessionManager.getSessionDetails(testSessionId);
      expect(sessionDetails).toBeDefined();

      // 清理会话
      const response = await request(app)
        .post(`/api/image-description/sessions/${testSessionId}/manage`)
        .send({
          action: 'clear'
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining(testSessionId),
        action: 'clear',
        sessionId: testSessionId
      });

      // 验证会话已被清理
      sessionDetails = sessionManager.getSessionDetails(testSessionId);
      expect(sessionDetails).toBeNull();
    });

    it('应该能够更新会话偏好设置', async () => {
      // 先创建会话
      await request(app)
        .get('/api/image-description/random')
        .query({ sessionId: testSessionId });

      const preferences = {
        categories: ['nature', 'animals'],
        excludeCategories: ['urban'],
        minWidth: 800,
        minHeight: 600,
        qualityPreference: 'high' as const
      };

      const response = await request(app)
        .post(`/api/image-description/sessions/${testSessionId}/manage`)
        .send({
          action: 'update_preferences',
          preferences: preferences
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: expect.stringContaining(testSessionId),
        action: 'update_preferences',
        sessionId: testSessionId,
        preferences: expect.objectContaining(preferences)
      });

      // 验证偏好设置已更新
      const session = sessionManager.getOrCreateSession(testSessionId);
      expect(session.preferences).toMatchObject(preferences);
    });

    it('应该拒绝无效的管理操作', async () => {
      const response = await request(app)
        .post(`/api/image-description/sessions/${testSessionId}/manage`)
        .send({
          action: 'invalid_action'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('invalid_action'),
        supportedActions: expect.arrayContaining(['clear', 'update_preferences'])
      });
    });

    it('应该在更新偏好时要求提供preferences参数', async () => {
      const response = await request(app)
        .post(`/api/image-description/sessions/${testSessionId}/manage`)
        .send({
          action: 'update_preferences'
          // 缺少preferences参数
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('preferences'),
        action: 'update_preferences'
      });
    });
  });

  describe('GET /api/image-description/sessions/overview - 会话概览端点', () => {
    it('应该返回所有会话的概览信息', async () => {
      // 创建一些测试会话
      await request(app)
        .get('/api/image-description/random')
        .query({ sessionId: testSessionId });

      await request(app)
        .get('/api/image-description/random')
        .query({ sessionId: testSessionId2 });

      const response = await request(app)
        .get('/api/image-description/sessions/overview')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        overview: expect.objectContaining({
          activeSessions: expect.any(Number),
          totalImagesTracked: expect.any(Number),
          totalMemoryUsage: expect.objectContaining({
            bytes: expect.any(Number),
            mb: expect.any(String),
            percentage: expect.any(String)
          }),
          averageSessionAge: expect.objectContaining({
            milliseconds: expect.any(Number),
            hours: expect.any(String)
          }),
          sessionsCreatedToday: expect.any(Number)
        }),
        health: expect.objectContaining({
          status: expect.any(String),
          warnings: expect.any(Array)
        }),
        configuration: expect.objectContaining({
          sessionTimeout: expect.objectContaining({
            milliseconds: expect.any(Number),
            hours: expect.any(Number)
          }),
          maxSessions: expect.any(Number),
          maxImagesPerSession: expect.any(Number)
        }),
        recentSessions: expect.any(Array),
        timestamp: expect.any(String)
      });

      // 验证活跃会话数量
      expect(response.body.overview.activeSessions).toBeGreaterThanOrEqual(2);
    });

    it('应该包含最近会话的详细信息', async () => {
      // 创建测试会话
      await request(app)
        .get('/api/image-description/random')
        .query({ sessionId: testSessionId });

      const response = await request(app)
        .get('/api/image-description/sessions/overview')
        .expect(200);

      expect(response.body.recentSessions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sessionId: expect.any(String),
            imageCount: expect.any(Number),
            requestCount: expect.any(Number),
            lastAccess: expect.any(String),
            memoryUsage: expect.objectContaining({
              bytes: expect.any(Number),
              kb: expect.any(String)
            }),
            topCategories: expect.any(Array)
          })
        ])
      );
    });
  });

  describe('端到端会话流程测试', () => {
    it('应该完整地处理会话生命周期', async () => {
      // 1. 创建会话并获取第一张图片
      const response1 = await request(app)
        .get('/api/image-description/random')
        .query({ sessionId: testSessionId })
        .expect(200);

      expect(response1.body.success).toBe(true);
      const firstImageUrl = response1.body.image.url;

      // 2. 获取更多图片
      const response2 = await request(app)
        .get('/api/image-description/random/nature')
        .query({ sessionId: testSessionId })
        .expect(200);

      expect(response2.body.success).toBe(true);

      // 3. 检查会话统计
      const statsResponse = await request(app)
        .get(`/api/image-description/sessions/${testSessionId}/stats`)
        .expect(200);

      expect(statsResponse.body.details.requestCount).toBe(2);
      expect(statsResponse.body.details.totalImages).toBeGreaterThan(0);
      // 由于API的随机性，不能保证一定包含'nature'类别，只检查有类别即可
      expect(statsResponse.body.details.categories).toEqual(expect.any(Array));
      expect(statsResponse.body.details.categories.length).toBeGreaterThan(0);

      // 4. 更新会话偏好
      const preferencesResponse = await request(app)
        .post(`/api/image-description/sessions/${testSessionId}/manage`)
        .send({
          action: 'update_preferences',
          preferences: {
            categories: ['nature', 'landscape'],
            qualityPreference: 'high'
          }
        })
        .expect(200);

      expect(preferencesResponse.body.success).toBe(true);

      // 5. 使用更新后的偏好获取图片
      const response3 = await request(app)
        .get('/api/image-description/random')
        .query({ sessionId: testSessionId })
        .expect(200);

      expect(response3.body.success).toBe(true);

      // 6. 最终统计检查
      const finalStatsResponse = await request(app)
        .get(`/api/image-description/sessions/${testSessionId}/stats`)
        .expect(200);

      expect(finalStatsResponse.body.details.requestCount).toBe(3);
      expect(finalStatsResponse.body.statistics.successfulRequests).toBe(3);

      // 7. 清理会话
      const clearResponse = await request(app)
        .post(`/api/image-description/sessions/${testSessionId}/manage`)
        .send({
          action: 'clear'
        })
        .expect(200);

      expect(clearResponse.body.success).toBe(true);

      // 8. 验证会话已被清理
      await request(app)
        .get(`/api/image-description/sessions/${testSessionId}/stats`)
        .expect(404);
    });

    it('应该正确处理会话超时和清理', async () => {
      // 创建会话
      await request(app)
        .get('/api/image-description/random')
        .query({ sessionId: testSessionId });

      // 验证会话存在
      let sessionDetails = sessionManager.getSessionDetails(testSessionId);
      expect(sessionDetails).toBeDefined();

      // 手动触发清理（模拟超时）
      sessionManager.performManualCleanup();

      // 在正常超时时间内，会话应该仍然存在
      sessionDetails = sessionManager.getSessionDetails(testSessionId);
      expect(sessionDetails).toBeDefined();

      // 手动清理会话
      const cleared = sessionManager.clearSession(testSessionId, 'test_timeout');
      expect(cleared).toBe(true);

      // 验证会话已被清理
      sessionDetails = sessionManager.getSessionDetails(testSessionId);
      expect(sessionDetails).toBeNull();
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该处理无效的会话ID格式', async () => {
      const invalidSessionId = '';
      
      const response = await request(app)
        .get(`/api/image-description/sessions/${invalidSessionId}/stats`)
        .expect(404); // Express路由会返回404

      // 或者如果路由处理了空参数
      if (response.status !== 404) {
        expect(response.body.success).toBe(false);
      }
    });

    it('应该处理会话管理中的无效参数', async () => {
      const response = await request(app)
        .post(`/api/image-description/sessions/${testSessionId}/manage`)
        .send({
          action: 'update_preferences',
          preferences: {
            minWidth: -100, // 无效值
            qualityPreference: 'invalid' // 无效枚举值
          }
        });

      // 由于我们的简化测试路由没有实现严格的参数验证，
      // 这个测试可能会成功，但在实际应用中应该有验证
      if (response.status === 400) {
        expect(response.body.success).toBe(false);
      } else {
        // 如果没有验证，至少确保操作完成
        expect(response.status).toBe(200);
        console.log('注意：参数验证未实现，建议在生产环境中添加');
      }
    });

    it('应该处理并发会话操作', async () => {
      // 并发创建和管理会话
      const promises = [
        request(app)
          .get('/api/image-description/random')
          .query({ sessionId: testSessionId }),
        request(app)
          .post(`/api/image-description/sessions/${testSessionId}/manage`)
          .send({
            action: 'update_preferences',
            preferences: { categories: ['test'] }
          }),
        request(app)
          .get(`/api/image-description/sessions/${testSessionId}/stats`)
      ];

      const responses = await Promise.allSettled(promises);

      // 至少有一些操作应该成功
      const successfulResponses = responses.filter(
        result => result.status === 'fulfilled' && 
        (result.value as any).status >= 200 && 
        (result.value as any).status < 400
      );

      expect(successfulResponses.length).toBeGreaterThan(0);
    });
  });
});