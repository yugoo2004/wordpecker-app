import { Router, Request, Response } from 'express';
import { environment } from '../../config/environment';
import { checkDatabaseHealth, getConnectionStatus } from '../../config/mongodb';
import axios from 'axios';

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
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024)
      },
      services: {
        database: 'unknown',
        openai: 'unknown',
        elevenlabs: 'unknown',
        pexels: 'unknown'
      }
    };

    // 检查数据库连接状态
    try {
      const dbHealth = await checkDatabaseHealth();
      const dbStatus = getConnectionStatus();
      
      healthStatus.services.database = dbHealth.healthy ? 'connected' : 'disconnected';
      
      // 添加详细的数据库状态信息
      (healthStatus as any).database_details = {
        healthy: dbHealth.healthy,
        state: dbStatus.state,
        reconnectAttempts: dbStatus.reconnectAttempts,
        isConnecting: dbStatus.isConnecting,
        ...dbHealth.details
      };
    } catch (error) {
      healthStatus.services.database = 'error';
      (healthStatus as any).database_details = {
        error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)
      };
    }

    // 检查 OpenAI API 密钥配置状态
    if (environment.openai.apiKey && environment.openai.apiKey !== 'your_openai_api_key_here') {
      healthStatus.services.openai = 'configured';
    } else {
      healthStatus.services.openai = 'not_configured';
    }

    // 检查 ElevenLabs API 密钥配置状态
    if (environment.elevenlabs.apiKey && environment.elevenlabs.apiKey !== 'your_elevenlabs_api_key_here') {
      healthStatus.services.elevenlabs = 'configured';
    } else {
      healthStatus.services.elevenlabs = 'not_configured';
    }

    // 检查 Pexels API 密钥配置状态
    if (environment.pexels.apiKey && environment.pexels.apiKey !== 'your_pexels_api_key_here') {
      healthStatus.services.pexels = 'configured';
    } else {
      healthStatus.services.pexels = 'not_configured';
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
      message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

// 检查外部API连通性的辅助函数
async function checkExternalAPIConnectivity() {
  const apiChecks = {
    openai: { configured: false, accessible: false },
    elevenlabs: { configured: false, accessible: false },
    pexels: { configured: false, accessible: false }
  };

  // 检查 OpenAI API
  if (environment.openai.apiKey && environment.openai.apiKey !== 'your_openai_api_key_here') {
    apiChecks.openai.configured = true;
    try {
      // 使用配置的baseUrl进行API连通性测试（不消耗配额）
      const modelsUrl = `${environment.openai.baseUrl}/models`;
      const response = await axios.get(modelsUrl, {
        headers: { 'Authorization': `Bearer ${environment.openai.apiKey}` },
        timeout: 5000
      });
      apiChecks.openai.accessible = response.status === 200;
    } catch (error) {
      apiChecks.openai.accessible = false;
    }
  }

  // 检查 ElevenLabs API
  if (environment.elevenlabs.apiKey && environment.elevenlabs.apiKey !== 'your_elevenlabs_api_key_here') {
    apiChecks.elevenlabs.configured = true;
    try {
      // 检查用户信息端点
      const response = await axios.get('https://api.elevenlabs.io/v1/user', {
        headers: { 'xi-api-key': environment.elevenlabs.apiKey },
        timeout: 5000
      });
      apiChecks.elevenlabs.accessible = response.status === 200;
    } catch (error) {
      apiChecks.elevenlabs.accessible = false;
    }
  }

  // 检查 Pexels API
  if (environment.pexels.apiKey && environment.pexels.apiKey !== 'your_pexels_api_key_here') {
    apiChecks.pexels.configured = true;
    try {
      // 简单的搜索请求测试
      const response = await axios.get('https://api.pexels.com/v1/search?query=test&per_page=1', {
        headers: { 'Authorization': environment.pexels.apiKey },
        timeout: 5000
      });
      apiChecks.pexels.accessible = response.status === 200;
    } catch (error) {
      apiChecks.pexels.accessible = false;
    }
  }

  return apiChecks;
}

// 就绪状态检查端点
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const readinessChecks = {
      database: false,
      requiredAPIs: false,
      optionalAPIs: false,
      connectivity: false
    };

    let isReady = true;
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: any = {};

    // 检查数据库连接
    try {
      const dbHealth = await checkDatabaseHealth();
      const dbStatus = getConnectionStatus();
      
      if (dbHealth.healthy) {
        readinessChecks.database = true;
        details.database = {
          status: 'ready',
          state: dbStatus.state,
          reconnectAttempts: dbStatus.reconnectAttempts,
          ...dbHealth.details
        };
      } else {
        isReady = false;
        readinessChecks.database = false;
        errors.push(`Database not ready: ${dbHealth.details.status || 'unknown error'}`);
        details.database = {
          status: 'not_ready',
          state: dbStatus.state,
          reconnectAttempts: dbStatus.reconnectAttempts,
          isConnecting: dbStatus.isConnecting,
          ...dbHealth.details
        };
      }
    } catch (error) {
      isReady = false;
      readinessChecks.database = false;
      errors.push('Database health check failed');
      details.database = {
        status: 'error',
        error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
      };
    }

    // 检查必需的 API 密钥配置
    const requiredAPIs = ['openai'];
    const configuredRequiredAPIs = [];
    
    if (environment.openai.apiKey && environment.openai.apiKey !== 'your_openai_api_key_here') {
      configuredRequiredAPIs.push('openai');
    } else {
      isReady = false;
      errors.push('OpenAI API key not configured');
    }

    readinessChecks.requiredAPIs = configuredRequiredAPIs.length === requiredAPIs.length;

    // 检查可选的 API 密钥配置
    const optionalAPIs = [];
    if (environment.elevenlabs.apiKey && environment.elevenlabs.apiKey !== 'your_elevenlabs_api_key_here') {
      optionalAPIs.push('elevenlabs');
    } else {
      warnings.push('ElevenLabs API key not configured (optional)');
    }

    if (environment.pexels.apiKey && environment.pexels.apiKey !== 'your_pexels_api_key_here') {
      optionalAPIs.push('pexels');
    } else {
      warnings.push('Pexels API key not configured (optional)');
    }

    readinessChecks.optionalAPIs = optionalAPIs.length > 0;

    // 检查外部API连通性（仅在配置了API密钥时）
    try {
      const apiConnectivity = await checkExternalAPIConnectivity();
      details.apis = apiConnectivity;

      // 检查必需API的连通性
      if (apiConnectivity.openai.configured) {
        if (!apiConnectivity.openai.accessible) {
          warnings.push('OpenAI API configured but not accessible');
        }
      }

      // 检查可选API的连通性
      if (apiConnectivity.elevenlabs.configured && !apiConnectivity.elevenlabs.accessible) {
        warnings.push('ElevenLabs API configured but not accessible');
      }

      if (apiConnectivity.pexels.configured && !apiConnectivity.pexels.accessible) {
        warnings.push('Pexels API configured but not accessible');
      }

      readinessChecks.connectivity = true;
    } catch (error) {
      warnings.push('External API connectivity check failed');
      readinessChecks.connectivity = false;
      details.apis = { error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error' };
    }

    const response = {
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks: readinessChecks,
      details,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
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
      message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
    });
  }
});

export default router;