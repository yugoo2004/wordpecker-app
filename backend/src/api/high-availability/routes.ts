import { Router } from 'express';
import { HighAvailabilityManager } from '../../services/highAvailabilityManager';
import { logger } from '../../config/logger';

const router = Router();

// 全局高可用性管理器实例
let haManager: HighAvailabilityManager | null = null;

/**
 * 获取或创建高可用性管理器实例
 */
function getHAManager(): HighAvailabilityManager {
  if (!haManager) {
    haManager = new HighAvailabilityManager();
  }
  return haManager;
}

/**
 * 启动高可用性管理
 * POST /api/ha/start
 */
router.post('/start', async (req, res) => {
  try {
    const manager = getHAManager();
    await manager.start();
    
    logger.info('High availability management started via API');
    
    res.json({
      success: true,
      message: 'High availability management started successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to start HA management via API:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 停止高可用性管理
 * POST /api/ha/stop
 */
router.post('/stop', async (req, res) => {
  try {
    const manager = getHAManager();
    await manager.stop();
    
    logger.info('High availability management stopped via API');
    
    res.json({
      success: true,
      message: 'High availability management stopped successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to stop HA management via API:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取高可用性状态
 * GET /api/ha/status
 */
router.get('/status', async (req, res) => {
  try {
    const manager = getHAManager();
    const status = await manager.getStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get HA status via API:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 执行健康检查
 * GET /api/ha/health
 */
router.get('/health', async (req, res) => {
  try {
    const manager = getHAManager();
    const healthCheck = await manager.performHealthCheck();
    
    const statusCode = healthCheck.isHealthy ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthCheck.isHealthy,
      data: healthCheck,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to perform health check via API:', error);
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取性能指标
 * GET /api/ha/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const manager = getHAManager();
    const metrics = await manager.getMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get metrics via API:', error);
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 手动扩容
 * POST /api/ha/scale-up
 */
router.post('/scale-up', async (req, res) => {
  try {
    const { targetInstances } = req.body;
    const manager = getHAManager();
    
    await manager.scaleUp(targetInstances);
    
    logger.info(`Manual scale up triggered via API${targetInstances ? ` to ${targetInstances} instances` : ''}`);
    
    res.json({
      success: true,
      message: 'Scale up operation initiated',
      targetInstances,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to scale up via API:', error);
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 手动缩容
 * POST /api/ha/scale-down
 */
router.post('/scale-down', async (req, res) => {
  try {
    const { targetInstances } = req.body;
    const manager = getHAManager();
    
    await manager.scaleDown(targetInstances);
    
    logger.info(`Manual scale down triggered via API${targetInstances ? ` to ${targetInstances} instances` : ''}`);
    
    res.json({
      success: true,
      message: 'Scale down operation initiated',
      targetInstances,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to scale down via API:', error);
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 手动触发故障切换
 * POST /api/ha/failover
 */
router.post('/failover', async (req, res) => {
  try {
    const { serviceName, reason } = req.body;
    
    if (!serviceName) {
      return res.status(400).json({
        success: false,
        error: 'Service name is required',
        timestamp: new Date().toISOString()
      });
    }
    
    const manager = getHAManager();
    await manager.triggerFailover(serviceName, reason || 'Manual API trigger');
    
    logger.info(`Manual failover triggered via API for service: ${serviceName}`);
    
    res.json({
      success: true,
      message: `Failover initiated for service: ${serviceName}`,
      serviceName,
      reason: reason || 'Manual API trigger',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to trigger failover via API:', error);
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 重置服务故障状态
 * POST /api/ha/reset-failure/:serviceName
 */
router.post('/reset-failure/:serviceName', async (req, res) => {
  try {
    const { serviceName } = req.params;
    const manager = getHAManager();
    
    manager.resetServiceFailureState(serviceName);
    
    logger.info(`Service failure state reset via API for: ${serviceName}`);
    
    res.json({
      success: true,
      message: `Failure state reset for service: ${serviceName}`,
      serviceName,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to reset failure state via API:', error);
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取负载均衡器状态
 * GET /api/ha/load-balancer
 */
router.get('/load-balancer', async (req, res) => {
  try {
    const manager = getHAManager();
    const status = await manager.getStatus();
    
    res.json({
      success: true,
      data: status.loadBalancer,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get load balancer status via API:', error);
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取故障切换管理器状态
 * GET /api/ha/failover-manager
 */
router.get('/failover-manager', async (req, res) => {
  try {
    const manager = getHAManager();
    const status = await manager.getStatus();
    
    res.json({
      success: true,
      data: status.failover,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get failover manager status via API:', error);
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

export default router;