import { Router, Request, Response } from 'express';
import { environment } from '../../config/environment';
import mongoose from 'mongoose';

const router = Router();

// 基础健康检查端点
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: environment.nodeEnv,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: 'unknown',
        openai: 'unknown'
      }
    };

    // 检查数据库连接状态
    try {
      const dbState = mongoose.connection.readyState;
      switch (dbState) {
        case 0:
          healthStatus.services.database = 'disconnected';
          break;
        case 1:
          healthStatus.services.database = 'connected';
          break;
        case 2:
          healthStatus.services.database = 'connecting';
          break;
        case 3:
          healthStatus.services.database = 'disconnecting';
          break;
        default:
          healthStatus.services.database = 'unknown';
      }
    } catch (error) {
      healthStatus.services.database = 'error';
    }

    // 检查 OpenAI API 密钥配置状态
    if (environment.openai.apiKey && environment.openai.apiKey !== 'your_openai_api_key_here') {
      healthStatus.services.openai = 'configured';
    } else {
      healthStatus.services.openai = 'not_configured';
    }

    // 如果数据库未连接，返回 503 状态
    if (healthStatus.services.database !== 'connected') {
      return res.status(503).json({
        ...healthStatus,
        status: 'unhealthy',
        message: 'Database not connected'
      });
    }

    res.status(200).json(healthStatus);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 就绪状态检查端点
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const readinessChecks = {
      database: false,
      apiKeys: false,
      services: false
    };

    let isReady = true;
    const errors: string[] = [];

    // 检查数据库连接
    try {
      const dbState = mongoose.connection.readyState;
      if (dbState === 1) {
        readinessChecks.database = true;
      } else {
        isReady = false;
        errors.push('Database not ready');
      }
    } catch (error) {
      isReady = false;
      errors.push('Database check failed');
    }

    // 检查必需的 API 密钥
    try {
      if (environment.openai.apiKey && environment.openai.apiKey !== 'your_openai_api_key_here') {
        readinessChecks.apiKeys = true;
      } else {
        isReady = false;
        errors.push('OpenAI API key not configured');
      }
    } catch (error) {
      isReady = false;
      errors.push('API key check failed');
    }

    // 检查核心服务
    try {
      // 这里可以添加更多服务检查，比如外部 API 连通性测试
      readinessChecks.services = true;
    } catch (error) {
      isReady = false;
      errors.push('Services check failed');
    }

    const response = {
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks: readinessChecks,
      errors: errors.length > 0 ? errors : undefined
    };

    if (isReady) {
      res.status(200).json(response);
    } else {
      res.status(503).json(response);
    }
  } catch (error) {
    console.error('Readiness check error:', error);
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;