import { Router } from 'express';
import { getAIServiceStatus, resetAIFailureStatus } from '../config/ai-service';
import { getVoiceServiceStatus, resetVoiceFailureStatus } from '../config/voice-service';
import { logger } from '../config/logger';

const router = Router();

// 获取所有服务状态
router.get('/status', (req, res) => {
  try {
    const aiStatus = getAIServiceStatus();
    const voiceStatus = getVoiceServiceStatus();

    const response = {
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        services: {
          ai: {
            ...aiStatus,
            healthy: aiStatus.availableProviders.length > 0
          },
          voice: {
            ...voiceStatus,
            healthy: voiceStatus.availableProviders.length > 0
          }
        },
        overall: {
          healthy: aiStatus.availableProviders.length > 0 && voiceStatus.availableProviders.length > 0,
          totalProviders: aiStatus.availableProviders.length + voiceStatus.availableProviders.length,
          failedProviders: aiStatus.failedProviders.length + voiceStatus.failedProviders.length
        }
      }
    };

    logger.info('服务状态查询', {
      aiProviders: aiStatus.availableProviders,
      voiceProviders: voiceStatus.availableProviders,
      overallHealthy: response.data.overall.healthy
    });

    res.json(response);
  } catch (error: any) {
    logger.error('获取服务状态失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: '获取服务状态失败'
    });
  }
});

// 重置 AI 服务失败状态
router.post('/ai/reset', (req, res) => {
  try {
    const { provider } = req.body;
    
    resetAIFailureStatus(provider);
    
    const newStatus = getAIServiceStatus();
    
    logger.info('AI 服务失败状态已重置', {
      provider: provider || 'all',
      availableProviders: newStatus.availableProviders
    });

    res.json({
      success: true,
      message: provider ? `AI 服务 ${provider} 失败状态已重置` : '所有 AI 服务失败状态已重置',
      data: newStatus
    });
  } catch (error: any) {
    logger.error('重置 AI 服务失败状态失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: '重置失败状态失败'
    });
  }
});

// 重置语音服务失败状态
router.post('/voice/reset', (req, res) => {
  try {
    const { provider } = req.body;
    
    resetVoiceFailureStatus(provider);
    
    const newStatus = getVoiceServiceStatus();
    
    logger.info('语音服务失败状态已重置', {
      provider: provider || 'all',
      availableProviders: newStatus.availableProviders
    });

    res.json({
      success: true,
      message: provider ? `语音服务 ${provider} 失败状态已重置` : '所有语音服务失败状态已重置',
      data: newStatus
    });
  } catch (error: any) {
    logger.error('重置语音服务失败状态失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: '重置失败状态失败'
    });
  }
});

// 健康检查端点
router.get('/health', (req, res) => {
  try {
    const aiStatus = getAIServiceStatus();
    const voiceStatus = getVoiceServiceStatus();
    
    const isHealthy = aiStatus.availableProviders.length > 0 && voiceStatus.availableProviders.length > 0;
    
    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        ai: aiStatus.availableProviders.length > 0 ? 'healthy' : 'unhealthy',
        voice: voiceStatus.availableProviders.length > 0 ? 'healthy' : 'unhealthy'
      }
    });
  } catch (error: any) {
    logger.error('健康检查失败', { error: error.message });
    res.status(500).json({
      success: false,
      status: 'error',
      error: '健康检查失败'
    });
  }
});

export default router;