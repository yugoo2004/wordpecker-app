import { Router, Request, Response } from 'express';
import { validate } from 'echt';
import { DescriptionExercise } from './model';
import { WordList } from '../lists/model';
import { Word } from '../words/model';
import { imageDescriptionAgentService } from './agent-service';
import { stockPhotoService } from './stock-photo-service';
import { getUserLanguages } from '../../utils/getUserLanguages';
import { 
  startExerciseSchema, 
  submitDescriptionSchema, 
  addWordsSchema, 
  historyQuerySchema,
  randomImageQuerySchema,
  categoryRandomImageSchema,
  metricsQuerySchema,
  sessionStatsQuerySchema,
  sessionManagementSchema
} from './schemas';
import { sessionManager } from './session-manager';

const router = Router();

const getUserId = <T extends { headers: Record<string, any> }>(req: T) => {
  const userId = req.headers['user-id'] as string;
  if (!userId) throw new Error('User ID is required');
  return userId;
};

router.post('/start', validate(startExerciseSchema), async (req, res) => {
  try {
    const { context, imageSource } = req.body;
    const userId = getUserId(req);

    const exerciseContext = context || await imageDescriptionAgentService.generateContext();
    const image = imageSource === 'ai' 
      ? await imageDescriptionAgentService.generateAIImage(exerciseContext, userId)
      : await stockPhotoService.findStockImage(exerciseContext, userId);

    res.json({
      context: exerciseContext,
      image: { url: image.url, alt: image.alt_description, id: image.id },
      instructions: "Look at this image carefully and describe what you see. Include details about objects, people, actions, emotions, colors, and atmosphere. Write in your target language and be as descriptive as you can!"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start description exercise';
    res.status(400).json({ error: message });
  }
});

router.post('/submit', validate(submitDescriptionSchema), async (req, res) => {
  try {
    const { context, imageUrl, imageAlt, userDescription } = req.body;
    const userId = getUserId(req);

    const { baseLanguage, targetLanguage } = await getUserLanguages(userId);

    console.log("Calling analyzeDescription"); 

    const analysis = await imageDescriptionAgentService.analyzeDescription(
      userDescription, 
      imageUrl, 
      context || 'General image description', 
      baseLanguage, 
      targetLanguage
    );

    console.log('analysis', analysis);

    const exercise = await DescriptionExercise.create({
      userId,
      context: context || 'General image description',
      imageUrl,
      imageAlt: imageAlt || '',
      userDescription: userDescription.trim(),
      analysis,
      recommendedWords: analysis.recommendations
    });

    res.json({
      exerciseId: exercise._id,
      analysis,
      message: 'Great job! Here\'s your personalized feedback and vocabulary recommendations.'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to analyze description';
    res.status(400).json({ error: message });
  }
});

router.post('/add-words', validate(addWordsSchema), async (req, res) => {
  try {
    const { exerciseId, listId, selectedWords, createNewList } = req.body;
    const userId = getUserId(req);

    const exercise = await DescriptionExercise.findOne({ _id: exerciseId, userId });
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });

    let targetList;
    if (createNewList) {
      const contextName = exercise.context.length > 50 ? exercise.context.substring(0, 47) + '...' : exercise.context;
      targetList = await WordList.create({
        name: `📸 ${contextName}`,
        description: `Vocabulary discovered through image description: ${exercise.context}`,
        context: exercise.context
      });
    } else {
      targetList = await WordList.findById(listId);
      if (!targetList) return res.status(404).json({ error: 'Word list not found' });
    }

    const addedWords = [];
    for (const { word, meaning } of selectedWords) {
      const existingWord = await Word.findOne({ value: word, 'ownedByLists.listId': targetList._id });
      
      if (!existingWord) {
        let wordDoc = await Word.findOne({ value: word });
        
        if (wordDoc) {
          wordDoc.ownedByLists.push({ listId: targetList._id, meaning, learnedPoint: 0 });
          await wordDoc.save();
        } else {
          await Word.create({
            value: word,
            ownedByLists: [{ listId: targetList._id, meaning, learnedPoint: 0 }]
          });
        }
        addedWords.push({ word, meaning });
      }
    }

    res.json({
      message: createNewList 
        ? `Created new list "${targetList.name}" and added ${addedWords.length} words`
        : `Successfully added ${addedWords.length} words to your list`,
      addedWords,
      listId: targetList._id.toString(),
      listName: targetList.name,
      createdNewList: !!createNewList
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add words to list';
    res.status(400).json({ error: message });
  }
});

router.get('/history', validate(historyQuerySchema), async (req, res) => {
  try {
    const userId = getUserId(req);
    const { limit } = req.query;

    const exercises = await DescriptionExercise
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('context imageUrl imageAlt userDescription analysis.feedback createdAt')
      .lean();

    res.json({ exercises });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch exercise history';
    res.status(400).json({ error: message });
  }
});

router.get('/context-suggestions', async (req: Request, res: Response) => {
  try {
    const suggestions = await Promise.all(
      Array(5).fill(null).map(() => imageDescriptionAgentService.generateContext())
    );
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get context suggestions' });
  }
});

// 获取随机图片的API端点
router.get('/random', validate(randomImageQuerySchema), async (req: Request, res: Response) => {
  try {
    const { sessionId, query } = req.query as { sessionId?: string; query?: string };
    
    console.log(`🎲 随机图片请求 - 查询: "${query || '无'}", 会话: ${sessionId || '无'}`);
    
    // 使用 StockPhotoService 的 findRandomImage 方法
    const randomImage = await stockPhotoService.findRandomImage(query, sessionId);
    
    // 返回标准化的响应格式
    res.json({
      success: true,
      image: {
        id: randomImage.id,
        url: randomImage.url,
        alt: randomImage.alt_description,
        description: randomImage.description,
        prompt: randomImage.prompt,
        source: randomImage.source
      },
      message: query 
        ? `成功获取与 "${query}" 相关的随机图片`
        : '成功获取随机图片'
    });
    
  } catch (error) {
    console.error('❌ 随机图片获取失败:', error);
    
    // 处理不同类型的错误
    const errorMessage = error instanceof Error ? error.message : '获取随机图片失败';
    const errorCode = (error as any)?.code || 'UNKNOWN_ERROR';
    const errorDetails = (error as any)?.details;
    const retryAfter = (error as any)?.retryAfter;
    
    // 根据错误类型返回适当的HTTP状态码
    let statusCode = 500;
    if (errorCode === 'API_KEY_INVALID') {
      statusCode = 401;
    } else if (errorCode === 'QUOTA_EXCEEDED' || errorCode === 'RATE_LIMITED') {
      statusCode = 429;
    } else if (errorCode === 'NO_IMAGES_FOUND') {
      statusCode = 404;
    } else if (errorCode === 'NETWORK_ERROR') {
      statusCode = 503;
    }
    
    const errorResponse: any = {
      success: false,
      error: errorMessage,
      code: errorCode
    };
    
    if (errorDetails) {
      errorResponse.details = errorDetails;
    }
    
    if (retryAfter) {
      errorResponse.retryAfter = retryAfter;
      res.set('Retry-After', retryAfter.toString());
    }
    
    res.status(statusCode).json(errorResponse);
  }
});

// 获取分类随机图片的API端点
router.get('/random/:category', validate(categoryRandomImageSchema), async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { sessionId } = req.query as { sessionId?: string };
    
    console.log(`🎯 分类随机图片请求 - 类别: "${category}", 会话: ${sessionId || '无'}`);
    
    // 使用类别作为搜索查询
    const randomImage = await stockPhotoService.findRandomImage(category, sessionId);
    
    // 返回标准化的响应格式
    res.json({
      success: true,
      image: {
        id: randomImage.id,
        url: randomImage.url,
        alt: randomImage.alt_description,
        description: randomImage.description,
        prompt: randomImage.prompt,
        source: randomImage.source
      },
      category: category,
      message: `成功获取 "${category}" 类别的随机图片`
    });
    
  } catch (error) {
    console.error(`❌ 分类随机图片获取失败 (${req.params.category}):`, error);
    
    // 处理不同类型的错误
    const errorMessage = error instanceof Error ? error.message : '获取分类随机图片失败';
    const errorCode = (error as any)?.code || 'UNKNOWN_ERROR';
    const errorDetails = (error as any)?.details;
    const retryAfter = (error as any)?.retryAfter;
    
    // 根据错误类型返回适当的HTTP状态码
    let statusCode = 500;
    if (errorCode === 'API_KEY_INVALID') {
      statusCode = 401;
    } else if (errorCode === 'QUOTA_EXCEEDED' || errorCode === 'RATE_LIMITED') {
      statusCode = 429;
    } else if (errorCode === 'NO_IMAGES_FOUND') {
      statusCode = 404;
    } else if (errorCode === 'NETWORK_ERROR') {
      statusCode = 503;
    }
    
    const errorResponse: any = {
      success: false,
      error: errorMessage,
      code: errorCode,
      category: req.params.category
    };
    
    if (errorDetails) {
      errorResponse.details = errorDetails;
    }
    
    if (retryAfter) {
      errorResponse.retryAfter = retryAfter;
      res.set('Retry-After', retryAfter.toString());
    }
    
    res.status(statusCode).json(errorResponse);
  }
});

// API 使用统计端点
router.get('/stats', async (req: Request, res: Response) => {
  try {
    console.log('📊 获取 API 使用统计...');
    
    // 获取基础统计信息
    const usageStats = stockPhotoService.getApiUsageStats();
    
    // 获取配额使用情况
    const quotaUsage = stockPhotoService.getQuotaUsage();
    
    // 获取全局会话统计
    const globalStats = stockPhotoService.getGlobalStats();
    
    // 计算成功率
    const successRate = usageStats.totalRequests > 0 
      ? ((usageStats.successfulRequests / usageStats.totalRequests) * 100).toFixed(2)
      : '0';
    
    // 格式化响应时间
    const formatResponseTime = (time: number) => {
      if (time === Infinity) return 'N/A';
      if (time === 0) return 'N/A';
      return Math.round(time) + 'ms';
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      statistics: {
        requests: {
          total: usageStats.totalRequests,
          successful: usageStats.successfulRequests,
          failed: usageStats.failedRequests,
          successRate: successRate + '%',
          requestsPerHour: usageStats.requestsPerHour,
          requestsToday: usageStats.requestsToday
        },
        performance: {
          averageResponseTime: formatResponseTime(usageStats.averageResponseTime),
          fastestResponse: formatResponseTime(usageStats.performanceMetrics.fastestResponse),
          slowestResponse: formatResponseTime(usageStats.performanceMetrics.slowestResponse),
          p95ResponseTime: formatResponseTime(usageStats.performanceMetrics.p95ResponseTime),
          p99ResponseTime: formatResponseTime(usageStats.performanceMetrics.p99ResponseTime)
        },
        quota: {
          currentUsage: quotaUsage.current,
          limit: quotaUsage.limit,
          usagePercentage: quotaUsage.percentage ? quotaUsage.percentage.toFixed(2) + '%' : 'N/A',
          resetTime: quotaUsage.resetTime ? quotaUsage.resetTime.toISOString() : null,
          estimatedDailyUsage: quotaUsage.estimatedDailyUsage,
          projectedMonthlyUsage: quotaUsage.projectedMonthlyUsage
        },
        errors: usageStats.errorBreakdown,
        sessions: {
          activeSessions: globalStats.activeSessions,
          totalImagesTracked: globalStats.totalImagesTracked,
          oldestSession: globalStats.oldestSession 
            ? new Date(globalStats.oldestSession).toISOString()
            : null
        },
        lastRequestTime: usageStats.lastRequestTime > 0 
          ? new Date(usageStats.lastRequestTime).toISOString()
          : null
      }
    });
    
  } catch (error) {
    console.error('❌ 获取统计信息失败:', error);
    
    const errorMessage = error instanceof Error ? error.message : '获取统计信息失败';
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// 性能指标端点
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { limit } = req.query as { limit?: string };
    const metricsLimit = limit ? parseInt(limit, 10) : 100;
    
    console.log(`📈 获取性能指标 (限制: ${metricsLimit})`);
    
    // 获取性能指标历史
    const performanceMetrics = stockPhotoService.getPerformanceMetrics(metricsLimit);
    
    // 计算一些聚合指标
    const successfulMetrics = performanceMetrics.filter(m => m.success);
    const failedMetrics = performanceMetrics.filter(m => !m.success);
    
    const avgResponseTime = successfulMetrics.length > 0
      ? successfulMetrics.reduce((sum, m) => sum + m.responseTime, 0) / successfulMetrics.length
      : 0;
    
    // 按错误类型分组
    const errorsByType = failedMetrics.reduce((acc, metric) => {
      const errorCode = metric.errorCode || 'UNKNOWN';
      acc[errorCode] = (acc[errorCode] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // 按时间段分组（最近24小时，按小时分组）
    const now = Date.now();
    const hourlyStats = Array.from({ length: 24 }, (_, i) => {
      const hourStart = now - (i + 1) * 60 * 60 * 1000;
      const hourEnd = now - i * 60 * 60 * 1000;
      
      const hourMetrics = performanceMetrics.filter(m => 
        m.timestamp >= hourStart && m.timestamp < hourEnd
      );
      
      return {
        hour: new Date(hourStart).toISOString().substr(0, 13) + ':00:00Z',
        totalRequests: hourMetrics.length,
        successfulRequests: hourMetrics.filter(m => m.success).length,
        failedRequests: hourMetrics.filter(m => !m.success).length,
        averageResponseTime: hourMetrics.length > 0
          ? Math.round(hourMetrics.reduce((sum, m) => sum + m.responseTime, 0) / hourMetrics.length)
          : 0
      };
    }).reverse();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalMetrics: performanceMetrics.length,
        successfulRequests: successfulMetrics.length,
        failedRequests: failedMetrics.length,
        averageResponseTime: Math.round(avgResponseTime),
        errorsByType
      },
      hourlyStats,
      recentMetrics: performanceMetrics.slice(-20).map(metric => ({
        requestId: metric.requestId,
        timestamp: new Date(metric.timestamp).toISOString(),
        responseTime: metric.responseTime,
        success: metric.success,
        errorCode: metric.errorCode,
        query: metric.query,
        sessionId: metric.sessionId
      }))
    });
    
  } catch (error) {
    console.error('❌ 获取性能指标失败:', error);
    
    const errorMessage = error instanceof Error ? error.message : '获取性能指标失败';
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// 配额监控端点
router.get('/quota', async (req: Request, res: Response) => {
  try {
    console.log('📊 获取配额使用情况...');
    
    // 获取详细的配额信息
    const quotaUsage = stockPhotoService.getQuotaUsage();
    const usageStats = stockPhotoService.getApiUsageStats();
    
    // 计算配额健康状态
    let healthStatus = 'healthy';
    let recommendations: string[] = [];
    
    if (quotaUsage.percentage !== null) {
      if (quotaUsage.percentage > 90) {
        healthStatus = 'critical';
        recommendations.push('配额使用率超过90%，请立即采取措施减少API调用');
        recommendations.push('考虑升级API计划或优化图片缓存策略');
      } else if (quotaUsage.percentage > 75) {
        healthStatus = 'warning';
        recommendations.push('配额使用率超过75%，建议监控使用情况');
        recommendations.push('考虑实施更积极的缓存策略');
      } else if (quotaUsage.percentage > 50) {
        healthStatus = 'moderate';
        recommendations.push('配额使用正常，建议继续监控');
      }
    }
    
    // 预测配额耗尽时间
    let estimatedExhaustionTime: string | null = null;
    if (quotaUsage.limit && quotaUsage.estimatedDailyUsage > 0) {
      const remainingQuota = quotaUsage.limit - quotaUsage.current;
      const daysUntilExhaustion = remainingQuota / quotaUsage.estimatedDailyUsage;
      
      if (daysUntilExhaustion > 0) {
        const exhaustionDate = new Date(Date.now() + daysUntilExhaustion * 24 * 60 * 60 * 1000);
        estimatedExhaustionTime = exhaustionDate.toISOString();
      }
    }
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      quota: {
        current: quotaUsage.current,
        limit: quotaUsage.limit,
        remaining: quotaUsage.limit ? quotaUsage.limit - quotaUsage.current : null,
        usagePercentage: quotaUsage.percentage ? quotaUsage.percentage.toFixed(2) + '%' : 'N/A',
        resetTime: quotaUsage.resetTime ? quotaUsage.resetTime.toISOString() : null
      },
      usage: {
        requestsToday: usageStats.requestsToday,
        requestsPerHour: usageStats.requestsPerHour,
        estimatedDailyUsage: quotaUsage.estimatedDailyUsage,
        projectedMonthlyUsage: quotaUsage.projectedMonthlyUsage
      },
      health: {
        status: healthStatus,
        estimatedExhaustionTime,
        recommendations
      }
    });
    
  } catch (error) {
    console.error('❌ 获取配额信息失败:', error);
    
    const errorMessage = error instanceof Error ? error.message : '获取配额信息失败';
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// 重置统计数据端点（仅用于开发和测试）
router.post('/reset-stats', async (req: Request, res: Response) => {
  try {
    // 在生产环境中可能需要添加认证
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: '生产环境中不允许重置统计数据'
      });
    }
    
    console.log('🔄 重置 API 统计数据...');
    
    stockPhotoService.resetStats();
    
    res.json({
      success: true,
      message: 'API 统计数据已重置',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 重置统计数据失败:', error);
    
    const errorMessage = error instanceof Error ? error.message : '重置统计数据失败';
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

// API配置验证端点
router.get('/validate-api', async (req: Request, res: Response) => {
  try {
    console.log('🔍 开始验证 Pexels API 配置...');
    
    // 验证API密钥
    const isValidKey = await stockPhotoService.validateApiKey();
    
    // 获取API使用统计
    const usageStats = stockPhotoService.getApiUsageStats();
    
    // 获取全局统计信息
    const globalStats = stockPhotoService.getGlobalStats();
    
    if (isValidKey) {
      res.json({
        success: true,
        status: 'valid',
        message: 'Pexels API 配置验证成功',
        apiKey: {
          status: 'valid',
          format: 'correct'
        },
        usage: {
          totalRequests: usageStats.totalRequests,
          successfulRequests: usageStats.successfulRequests,
          failedRequests: usageStats.failedRequests,
          successRate: usageStats.totalRequests > 0 
            ? ((usageStats.successfulRequests / usageStats.totalRequests) * 100).toFixed(2) + '%'
            : '0%',
          averageResponseTime: usageStats.averageResponseTime > 0 
            ? Math.round(usageStats.averageResponseTime) + 'ms'
            : 'N/A',
          lastRequestTime: usageStats.lastRequestTime > 0 
            ? new Date(usageStats.lastRequestTime).toISOString()
            : null
        },
        sessions: {
          activeSessions: globalStats.activeSessions,
          totalImagesTracked: globalStats.totalImagesTracked,
          totalMemoryUsage: globalStats.totalMemoryUsage,
          averageSessionAge: globalStats.averageSessionAge,
          sessionsCreatedToday: globalStats.sessionsCreatedToday,
          oldestSession: globalStats.oldestSession 
            ? new Date(globalStats.oldestSession).toISOString()
            : null
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(401).json({
        success: false,
        status: 'invalid',
        message: 'Pexels API 配置验证失败',
        apiKey: {
          status: 'invalid',
          error: 'API密钥无效或已过期'
        },
        usage: {
          totalRequests: usageStats.totalRequests,
          successfulRequests: usageStats.successfulRequests,
          failedRequests: usageStats.failedRequests,
          successRate: usageStats.totalRequests > 0 
            ? ((usageStats.successfulRequests / usageStats.totalRequests) * 100).toFixed(2) + '%'
            : '0%'
        },
        recommendations: [
          '检查 PEXELS_API_KEY 环境变量是否正确设置',
          '确认API密钥格式正确（应为64位十六进制字符串）',
          '验证API密钥是否已过期或被撤销',
          '访问 https://www.pexels.com/api/ 获取新的API密钥'
        ],
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ API配置验证过程中发生错误:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'API配置验证失败';
    
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'API配置验证过程中发生错误',
      error: errorMessage,
      recommendations: [
        '检查网络连接是否正常',
        '确认Pexels API服务是否可用',
        '检查服务器日志获取更多详细信息'
      ],
      timestamp: new Date().toISOString()
    });
  }
});

// 获取特定会话的统计信息
router.get('/sessions/:sessionId/stats', validate(sessionStatsQuerySchema), async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    console.log(`📊 获取会话统计: ${sessionId}`);
    
    // 获取会话详细信息
    const sessionDetails = sessionManager.getSessionDetails(sessionId);
    
    if (!sessionDetails) {
      return res.status(404).json({
        success: false,
        error: '会话不存在',
        sessionId
      });
    }
    
    // 获取会话统计信息
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
router.post('/sessions/:sessionId/manage', validate(sessionManagementSchema), async (req: Request, res: Response) => {
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
        // 获取现有会话（如果不存在会创建）
        const session = sessionManager.getOrCreateSession(sessionId);
        
        // 更新偏好设置
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
router.get('/sessions/overview', async (req: Request, res: Response) => {
  try {
    console.log('📋 获取会话概览信息...');
    
    // 获取全局统计信息
    const globalStats = sessionManager.getGlobalStats();
    
    // 获取会话管理器配置
    const config = sessionManager.getConfig();
    
    // 导出会话数据摘要
    const sessionData = sessionManager.exportSessionData();
    
    // 计算内存使用百分比
    const memoryUsagePercentage = config.memoryThreshold > 0 
      ? (globalStats.totalMemoryUsage / config.memoryThreshold * 100).toFixed(2)
      : '0';
    
    // 计算会话健康状态
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

// 批量清理会话
router.post('/sessions/cleanup', async (req: Request, res: Response) => {
  try {
    const { 
      force = false, 
      olderThan, 
      maxSessions 
    } = req.body as { 
      force?: boolean; 
      olderThan?: number; 
      maxSessions?: number; 
    };
    
    console.log('🧹 开始批量清理会话...', { force, olderThan, maxSessions });
    
    const beforeCount = sessionManager.getGlobalStats().activeSessions;
    
    if (force) {
      // 强制清理所有会话
      const sessionData = sessionManager.exportSessionData();
      let cleanedCount = 0;
      
      for (const session of sessionData.sessions) {
        sessionManager.clearSession(session.sessionId, 'force_cleanup');
        cleanedCount++;
      }
      
      res.json({
        success: true,
        message: `强制清理完成，清理了 ${cleanedCount} 个会话`,
        cleaned: cleanedCount,
        remaining: 0,
        type: 'force',
        timestamp: new Date().toISOString()
      });
      
    } else if (olderThan) {
      // 清理指定时间之前的会话
      const cutoffTime = Date.now() - olderThan;
      const sessionData = sessionManager.exportSessionData();
      let cleanedCount = 0;
      
      for (const session of sessionData.sessions) {
        const lastAccessTime = new Date(session.lastAccess).getTime();
        if (lastAccessTime < cutoffTime) {
          sessionManager.clearSession(session.sessionId, 'age_based_cleanup');
          cleanedCount++;
        }
      }
      
      const afterCount = sessionManager.getGlobalStats().activeSessions;
      
      res.json({
        success: true,
        message: `基于时间的清理完成，清理了 ${cleanedCount} 个会话`,
        cleaned: cleanedCount,
        remaining: afterCount,
        cutoffTime: new Date(cutoffTime).toISOString(),
        type: 'age_based',
        timestamp: new Date().toISOString()
      });
      
    } else if (maxSessions) {
      // 保留指定数量的最新会话，清理其余的
      const sessionData = sessionManager.exportSessionData();
      
      if (sessionData.sessions.length > maxSessions) {
        // 按最后访问时间排序，保留最新的
        const sortedSessions = sessionData.sessions
          .sort((a, b) => new Date(b.lastAccess).getTime() - new Date(a.lastAccess).getTime());
        
        const toRemove = sortedSessions.slice(maxSessions);
        let cleanedCount = 0;
        
        for (const session of toRemove) {
          sessionManager.clearSession(session.sessionId, 'count_based_cleanup');
          cleanedCount++;
        }
        
        res.json({
          success: true,
          message: `基于数量的清理完成，清理了 ${cleanedCount} 个会话`,
          cleaned: cleanedCount,
          remaining: maxSessions,
          type: 'count_based',
          timestamp: new Date().toISOString()
        });
      } else {
        res.json({
          success: true,
          message: '无需清理，当前会话数量未超过限制',
          cleaned: 0,
          remaining: sessionData.sessions.length,
          type: 'count_based',
          timestamp: new Date().toISOString()
        });
      }
      
    } else {
      // 执行标准清理（基于配置的超时时间）
      const initialStats = sessionManager.getGlobalStats();
      
      // 触发一次清理（通过更新配置来强制触发）
      const config = sessionManager.getConfig();
      sessionManager.updateConfig({ cleanupInterval: config.cleanupInterval });
      
      // 等待一小段时间让清理完成
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalStats = sessionManager.getGlobalStats();
      const cleanedCount = initialStats.activeSessions - finalStats.activeSessions;
      
      res.json({
        success: true,
        message: `标准清理完成，清理了 ${cleanedCount} 个会话`,
        cleaned: cleanedCount,
        remaining: finalStats.activeSessions,
        type: 'standard',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ 批量清理会话失败:', error);
    
    const errorMessage = error instanceof Error ? error.message : '批量清理会话失败';
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;