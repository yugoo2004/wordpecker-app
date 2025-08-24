import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { logger } from '../../config/logger';
import { ManagementService } from './service';
import { 
  ServiceActionSchema, 
  LogQuerySchema, 
  ScaleServiceSchema,
  LogCleanupSchema 
} from './schemas';

const router = Router();
const managementService = new ManagementService();

// 服务控制接口

/**
 * 重启服务
 * POST /api/management/restart
 */
router.post('/restart', async (req: Request, res: Response) => {
  try {
    const { service } = ServiceActionSchema.parse(req.body);
    
    logger.info('远程重启服务请求', { service, requestId: req.headers['x-request-id'] });
    
    const result = await managementService.restartService(service);
    res.json(result);
  } catch (error) {
    logger.error('服务重启失败', { error: error instanceof Error ? error.message : 'Unknown error', service: req.body.service });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 停止服务
 * POST /api/management/stop
 */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    const { service } = ServiceActionSchema.parse(req.body);
    
    logger.info('远程停止服务请求', { service, requestId: req.headers['x-request-id'] });
    
    const result = await managementService.stopService(service);
    res.json(result);
  } catch (error) {
    logger.error('服务停止失败', { error: error instanceof Error ? error.message : 'Unknown error', service: req.body.service });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 启动服务
 * POST /api/management/start
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { service } = ServiceActionSchema.parse(req.body);
    
    logger.info('远程启动服务请求', { service, requestId: req.headers['x-request-id'] });
    
    const result = await managementService.startService(service);
    res.json(result);
  } catch (error) {
    logger.error('服务启动失败', { error: error.message, service: req.body.service });
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 扩缩容服务
 * POST /api/management/scale
 */
router.post('/scale', async (req: Request, res: Response) => {
  try {
    const { service, instances } = ScaleServiceSchema.parse(req.body);
    
    logger.info('远程扩缩容服务请求', { service, instances, requestId: req.headers['x-request-id'] });
    
    const result = await managementService.scaleService(service, instances);
    res.json(result);
  } catch (error) {
    logger.error('服务扩缩容失败', { error: error.message, service: req.body.service });
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 服务状态查询和系统指标接口

/**
 * 获取服务状态
 * GET /api/management/status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    logger.info('获取服务状态请求', { requestId: req.headers['x-request-id'] });
    
    const status = await managementService.getServiceStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取服务状态失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取系统指标
 * GET /api/management/metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    logger.info('获取系统指标请求', { requestId: req.headers['x-request-id'] });
    
    const metrics = await managementService.getSystemMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取系统指标失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 远程日志查看和下载功能

/**
 * 获取PM2日志
 * GET /api/management/logs/pm2
 */
router.get('/logs/pm2', async (req: Request, res: Response) => {
  try {
    const { service, lines } = LogQuerySchema.parse(req.query);
    
    logger.info('获取PM2日志请求', { service, lines, requestId: req.headers['x-request-id'] });
    
    const logs = await managementService.getPM2Logs(service, lines);
    
    res.json({
      success: true,
      data: {
        logs,
        service: service || 'all',
        lines: lines
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取PM2日志失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取应用日志文件列表
 * GET /api/management/logs/files
 */
router.get('/logs/files', async (req: Request, res: Response) => {
  try {
    logger.info('获取日志文件列表请求', { requestId: req.headers['x-request-id'] });
    
    const logFiles = await managementService.getLogFiles();
    
    res.json({
      success: true,
      data: logFiles,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('获取日志文件列表失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 查看日志文件内容
 * GET /api/management/logs/view/:filename
 */
router.get('/logs/view/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const { lines } = LogQuerySchema.parse(req.query);
    
    logger.info('查看日志文件请求', { filename, lines, requestId: req.headers['x-request-id'] });
    
    const content = await managementService.readLogFile(filename, lines);
    
    res.json({
      success: true,
      data: {
        filename,
        content,
        lines: lines
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('查看日志文件失败', { error: error.message, filename: req.params.filename });
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 下载日志文件
 * GET /api/management/logs/download/:filename
 */
router.get('/logs/download/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    
    logger.info('下载日志文件请求', { filename, requestId: req.headers['x-request-id'] });
    
    const content = await managementService.downloadLogFile(filename);
    
    // 设置下载响应头
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/plain');
    
    res.send(content);
    
    logger.info('日志文件下载成功', { filename });
  } catch (error) {
    logger.error('下载日志文件失败', { error: error.message, filename: req.params.filename });
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 清理日志文件
 * DELETE /api/management/logs/cleanup
 */
router.delete('/logs/cleanup', async (req: Request, res: Response) => {
  try {
    const { days } = LogCleanupSchema.parse(req.body);
    
    logger.info('清理日志文件请求', { days, requestId: req.headers['x-request-id'] });
    
    const result = await managementService.cleanupLogs(days);
    res.json(result);
  } catch (error) {
    logger.error('清理日志文件失败', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取实时日志流（WebSocket或Server-Sent Events的替代方案）
 * GET /api/management/logs/tail/:service
 */
router.get('/logs/tail/:service', async (req: Request, res: Response) => {
  try {
    const { service } = req.params;
    const validServices = ['wordpecker-backend', 'wordpecker-frontend', 'all'];
    
    if (!validServices.includes(service)) {
      return res.status(400).json({
        success: false,
        error: '无效的服务名称',
        timestamp: new Date().toISOString()
      });
    }
    
    logger.info('获取实时日志请求', { service, requestId: req.headers['x-request-id'] });
    
    // 设置Server-Sent Events响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // 发送初始连接消息
    res.write(`data: ${JSON.stringify({ type: 'connected', service, timestamp: new Date().toISOString() })}\n\n`);
    
    // 启动PM2日志流
    const logProcess = exec(`pm2 logs ${service === 'all' ? '' : service} --raw`);
    
    logProcess.stdout?.on('data', (data) => {
      const logEntry = {
        type: 'log',
        service,
        content: data.toString(),
        timestamp: new Date().toISOString()
      };
      res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
    });
    
    logProcess.stderr?.on('data', (data) => {
      const errorEntry = {
        type: 'error',
        service,
        content: data.toString(),
        timestamp: new Date().toISOString()
      };
      res.write(`data: ${JSON.stringify(errorEntry)}\n\n`);
    });
    
    // 处理客户端断开连接
    req.on('close', () => {
      logger.info('实时日志连接关闭', { service });
      logProcess.kill();
    });
    
    // 定期发送心跳
    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 30000);
    
    req.on('close', () => {
      clearInterval(heartbeat);
    });
    
  } catch (error) {
    logger.error('获取实时日志失败', { error: error.message, service: req.params.service });
    res.status(500).json({
      success: false,
      error: `获取实时日志失败: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;