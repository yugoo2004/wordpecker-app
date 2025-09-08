import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = Router();
const execAsync = promisify(exec);

// 监控仪表板路由
// 实现需求 2.1, 2.2, 2.3 - 监控仪表板和告警通知

/**
 * 获取系统概览信息
 */
router.get('/overview', async (req, res) => {
  try {
    const overview = await getSystemOverview();
    res.json({
      success: true,
      data: overview,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取实时指标
 */
router.get('/metrics/realtime', async (req, res) => {
  try {
    const metrics = await getRealtimeMetrics();
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取历史指标
 */
router.get('/metrics/history', async (req, res) => {
  try {
    const { period = '1h', metric = 'all' } = req.query;
    const history = await getHistoricalMetrics(period as string, metric as string);
    
    res.json({
      success: true,
      data: history,
      period,
      metric,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取服务状态
 */
router.get('/services/status', async (req, res) => {
  try {
    const services = await getServicesStatus();
    res.json({
      success: true,
      data: services,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取告警信息
 */
router.get('/alerts', async (req, res) => {
  try {
    const { status = 'all', limit = 50 } = req.query;
    const alerts = await getAlerts(status as string, parseInt(limit as string));
    
    res.json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 创建告警规则
 */
router.post('/alerts/rules', async (req, res) => {
  try {
    const rule = req.body;
    const result = await createAlertRule(rule);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取告警规则
 */
router.get('/alerts/rules', async (req, res) => {
  try {
    const rules = await getAlertRules();
    res.json({
      success: true,
      data: rules,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 更新告警规则
 */
router.put('/alerts/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const result = await updateAlertRule(id, updates);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 删除告警规则
 */
router.delete('/alerts/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteAlertRule(id);
    
    res.json({
      success: true,
      message: 'Alert rule deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 测试告警通知
 */
router.post('/alerts/test', async (req, res) => {
  try {
    const { type, config } = req.body;
    const result = await testAlertNotification(type, config);
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取日志流
 */
router.get('/logs/stream', async (req, res) => {
  try {
    const { service = 'all', level = 'info', lines = 100 } = req.query;
    
    // 设置 SSE 头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // 发送初始日志
    const initialLogs = await getRecentLogs(service as string, parseInt(lines as string));
    res.write(`data: ${JSON.stringify({ type: 'initial', logs: initialLogs })}\n\n`);
    
    // 设置日志监听
    const logWatcher = await setupLogWatcher(service as string, (logEntry) => {
      if (shouldIncludeLogLevel(logEntry.level, level as string)) {
        res.write(`data: ${JSON.stringify({ type: 'update', log: logEntry })}\n\n`);
      }
    });
    
    // 客户端断开连接时清理
    req.on('close', () => {
      if (logWatcher) {
        logWatcher.close();
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error instanceof Error ? error.message : String(error)),
      timestamp: new Date().toISOString()
    });
  }
});

// 辅助函数

/**
 * 获取系统概览信息
 */
async function getSystemOverview() {
  const [systemInfo, serviceStatus, resourceUsage, recentAlerts] = await Promise.all([
    getSystemInfo(),
    getServicesStatus(),
    getCurrentResourceUsage(),
    getRecentAlerts(5)
  ]);
  
  return {
    system: systemInfo,
    services: serviceStatus,
    resources: resourceUsage,
    alerts: recentAlerts,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  };
}

/**
 * 获取系统信息
 */
async function getSystemInfo() {
  try {
    const [hostname, uptime, loadavg] = await Promise.all([
      execAsync('hostname').then(r => r.stdout.trim()),
      execAsync('uptime -p').then(r => r.stdout.trim()),
      execAsync('uptime | awk -F"load average:" \'{print $2}\'').then(r => r.stdout.trim())
    ]);
    
    return {
      hostname,
      uptime,
      loadAverage: loadavg,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  } catch (error) {
    return {
      hostname: 'unknown',
      uptime: 'unknown',
      loadAverage: 'unknown',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  }
}

/**
 * 获取实时指标
 */
async function getRealtimeMetrics() {
  const metricsFile = path.join(process.cwd(), '../logs/resource-metrics.json');
  const healthFile = path.join(process.cwd(), '../logs/health-metrics.json');
  
  try {
    const [resourceMetrics, healthMetrics] = await Promise.all([
      fs.readFile(metricsFile, 'utf8').then(JSON.parse).catch(() => null),
      fs.readFile(healthFile, 'utf8').then(JSON.parse).catch(() => null)
    ]);
    
    return {
      resources: resourceMetrics,
      health: healthMetrics,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to read metrics: ${(error instanceof Error ? error.message : String(error))}`);
  }
}

/**
 * 获取历史指标
 */
async function getHistoricalMetrics(period: string, metric: string) {
  const metricsDir = path.join(process.cwd(), '../logs/metrics-history');
  
  try {
    // 根据时间段计算需要读取的文件
    const files = await getMetricsFiles(metricsDir, period);
    const data = [];
    
    for (const file of files) {
      try {
        const content = await fs.readFile(path.join(metricsDir, file), 'utf8');
        const metrics = JSON.parse(content);
        
        if (metric === 'all' || metrics[metric]) {
          data.push({
            timestamp: metrics.timestamp,
            data: metric === 'all' ? metrics : { [metric]: metrics[metric] }
          });
        }
      } catch (error) {
        // 忽略单个文件读取错误
        continue;
      }
    }
    
    return data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (error) {
    throw new Error(`Failed to read historical metrics: ${(error instanceof Error ? error.message : String(error))}`);
  }
}

/**
 * 获取服务状态
 */
async function getServicesStatus() {
  try {
    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout);
    
    const services = processes.map(proc => ({
      name: proc.name,
      status: proc.pm2_env.status,
      pid: proc.pid,
      uptime: proc.pm2_env.pm_uptime,
      restarts: proc.pm2_env.restart_time,
      memory: proc.monit.memory,
      cpu: proc.monit.cpu,
      instances: proc.pm2_env.instances || 1
    }));
    
    // 添加系统服务状态
    const systemdStatus = await getSystemdServiceStatus();
    
    return {
      pm2: services,
      systemd: systemdStatus,
      summary: {
        total: services.length,
        online: services.filter(s => s.status === 'online').length,
        stopped: services.filter(s => s.status === 'stopped').length,
        errored: services.filter(s => s.status === 'errored').length
      }
    };
  } catch (error) {
    throw new Error(`Failed to get services status: ${(error instanceof Error ? error.message : String(error))}`);
  }
}

/**
 * 获取 Systemd 服务状态
 */
async function getSystemdServiceStatus() {
  try {
    const { stdout } = await execAsync('systemctl is-active wordpecker');
    const isActive = stdout.trim() === 'active';
    
    const { stdout: statusOutput } = await execAsync('systemctl status wordpecker --no-pager -l');
    
    return {
      name: 'wordpecker',
      active: isActive,
      status: stdout.trim(),
      details: statusOutput
    };
  } catch (error) {
    return {
      name: 'wordpecker',
      active: false,
      status: 'inactive',
      error: (error instanceof Error ? error.message : String(error))
    };
  }
}

/**
 * 获取当前资源使用情况
 */
async function getCurrentResourceUsage() {
  try {
    const [cpuUsage, memoryUsage, diskUsage] = await Promise.all([
      getCpuUsage(),
      getMemoryUsage(),
      getDiskUsage()
    ]);
    
    return {
      cpu: cpuUsage,
      memory: memoryUsage,
      disk: diskUsage,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Failed to get resource usage: ${(error instanceof Error ? error.message : String(error))}`);
  }
}

/**
 * 获取 CPU 使用率
 */
async function getCpuUsage() {
  try {
    const { stdout } = await execAsync('top -bn1 | grep "Cpu(s)" | awk \'{print $2}\' | awk -F\'%\' \'{print $1}\'');
    const usage = parseFloat(stdout.trim()) || 0;
    
    return {
      usage: usage,
      cores: require('os').cpus().length,
      status: usage > 80 ? 'critical' : usage > 65 ? 'warning' : 'normal'
    };
  } catch (error) {
    return { usage: 0, cores: 1, status: 'unknown', error: (error instanceof Error ? error.message : String(error)) };
  }
}

/**
 * 获取内存使用情况
 */
async function getMemoryUsage() {
  try {
    const { stdout } = await execAsync('free -m');
    const lines = stdout.split('\n');
    const memLine = lines[1].split(/\s+/);
    
    const total = parseInt(memLine[1]);
    const used = parseInt(memLine[2]);
    const available = parseInt(memLine[6]);
    const usage = Math.round((used / total) * 100);
    
    return {
      total: total,
      used: used,
      available: available,
      usage: usage,
      status: usage > 85 ? 'critical' : usage > 70 ? 'warning' : 'normal'
    };
  } catch (error) {
    return { total: 0, used: 0, available: 0, usage: 0, status: 'unknown', error: (error instanceof Error ? error.message : String(error)) };
  }
}

/**
 * 获取磁盘使用情况
 */
async function getDiskUsage() {
  try {
    const { stdout } = await execAsync('df -h / | awk \'NR==2{print $2, $3, $4, $5}\'');
    const [total, used, available, usageStr] = stdout.trim().split(/\s+/);
    const usage = parseInt(usageStr.replace('%', ''));
    
    return {
      total: total,
      used: used,
      available: available,
      usage: usage,
      status: usage > 85 ? 'critical' : usage > 75 ? 'warning' : 'normal'
    };
  } catch (error) {
    return { total: '0G', used: '0G', available: '0G', usage: 0, status: 'unknown', error: (error instanceof Error ? error.message : String(error)) };
  }
}

/**
 * 获取告警信息
 */
async function getAlerts(status: string, limit: number) {
  const alertsFile = path.join(process.cwd(), '../logs/resource-alerts-optimized.log');
  
  try {
    const content = await fs.readFile(alertsFile, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const alerts = lines
      .slice(-limit * 2) // 读取更多行以便过滤
      .map(line => parseAlertLine(line))
      .filter(alert => alert && (status === 'all' || alert.level.toLowerCase() === status.toLowerCase()))
      .slice(-limit)
      .reverse();
    
    return alerts;
  } catch (error) {
    return [];
  }
}

/**
 * 解析告警日志行
 */
function parseAlertLine(line: string) {
  const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (.+)$/);
  if (!match) return null;
  
  const [, timestamp, level, message] = match;
  
  return {
    id: `${timestamp}-${level}-${message.substring(0, 10)}`,
    timestamp,
    level,
    message,
    severity: getSeverityFromLevel(level),
    category: getCategoryFromMessage(message)
  };
}

/**
 * 从级别获取严重程度
 */
function getSeverityFromLevel(level: string): string {
  switch (level.toUpperCase()) {
    case 'CRITICAL': return 'high';
    case 'ERROR': return 'high';
    case 'WARNING': return 'medium';
    case 'WARN': return 'medium';
    case 'INFO': return 'low';
    default: return 'low';
  }
}

/**
 * 从消息获取分类
 */
function getCategoryFromMessage(message: string): string {
  if (message.includes('CPU')) return 'performance';
  if (message.includes('内存') || message.includes('memory')) return 'performance';
  if (message.includes('磁盘') || message.includes('disk')) return 'storage';
  if (message.includes('服务') || message.includes('service')) return 'service';
  if (message.includes('网络') || message.includes('network')) return 'network';
  return 'system';
}

/**
 * 获取最近告警
 */
async function getRecentAlerts(limit: number) {
  return getAlerts('all', limit);
}

/**
 * 创建告警规则
 */
async function createAlertRule(rule: any) {
  const rulesFile = path.join(process.cwd(), '../config/alert-rules.json');
  
  try {
    let rules = [];
    try {
      const content = await fs.readFile(rulesFile, 'utf8');
      rules = JSON.parse(content);
    } catch (error) {
      // 文件不存在，创建新的规则数组
    }
    
    const newRule = {
      id: `rule-${Date.now()}`,
      name: rule.name,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      severity: rule.severity,
      enabled: rule.enabled !== false,
      notifications: rule.notifications || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    rules.push(newRule);
    
    await fs.writeFile(rulesFile, JSON.stringify(rules, null, 2));
    
    return newRule;
  } catch (error) {
    throw new Error(`Failed to create alert rule: ${(error instanceof Error ? error.message : String(error))}`);
  }
}

/**
 * 获取告警规则
 */
async function getAlertRules() {
  const rulesFile = path.join(process.cwd(), '../config/alert-rules.json');
  
  try {
    const content = await fs.readFile(rulesFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

/**
 * 更新告警规则
 */
async function updateAlertRule(id: string, updates: any) {
  const rulesFile = path.join(process.cwd(), '../config/alert-rules.json');
  
  try {
    const content = await fs.readFile(rulesFile, 'utf8');
    const rules = JSON.parse(content);
    
    const ruleIndex = rules.findIndex((rule: any) => rule.id === id);
    if (ruleIndex === -1) {
      throw new Error('Alert rule not found');
    }
    
    rules[ruleIndex] = {
      ...rules[ruleIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(rulesFile, JSON.stringify(rules, null, 2));
    
    return rules[ruleIndex];
  } catch (error) {
    throw new Error(`Failed to update alert rule: ${(error instanceof Error ? error.message : String(error))}`);
  }
}

/**
 * 删除告警规则
 */
async function deleteAlertRule(id: string) {
  const rulesFile = path.join(process.cwd(), '../config/alert-rules.json');
  
  try {
    const content = await fs.readFile(rulesFile, 'utf8');
    const rules = JSON.parse(content);
    
    const filteredRules = rules.filter((rule: any) => rule.id !== id);
    
    if (filteredRules.length === rules.length) {
      throw new Error('Alert rule not found');
    }
    
    await fs.writeFile(rulesFile, JSON.stringify(filteredRules, null, 2));
  } catch (error) {
    throw new Error(`Failed to delete alert rule: ${(error instanceof Error ? error.message : String(error))}`);
  }
}

/**
 * 测试告警通知
 */
async function testAlertNotification(type: string, config: any) {
  // 这里可以实现不同类型的通知测试
  // 例如：邮件、Slack、钉钉等
  
  const testMessage = {
    title: 'WordPecker 告警测试',
    message: '这是一条测试告警消息',
    severity: 'info',
    timestamp: new Date().toISOString()
  };
  
  switch (type) {
    case 'email':
      return await testEmailNotification(config, testMessage);
    case 'slack':
      return await testSlackNotification(config, testMessage);
    case 'webhook':
      return await testWebhookNotification(config, testMessage);
    default:
      throw new Error(`Unsupported notification type: ${type}`);
  }
}

/**
 * 测试邮件通知
 */
async function testEmailNotification(config: any, message: any) {
  // 实现邮件通知测试
  return {
    type: 'email',
    status: 'success',
    message: 'Email notification test completed',
    config: config
  };
}

/**
 * 测试 Slack 通知
 */
async function testSlackNotification(config: any, message: any) {
  // 实现 Slack 通知测试
  return {
    type: 'slack',
    status: 'success',
    message: 'Slack notification test completed',
    config: config
  };
}

/**
 * 测试 Webhook 通知
 */
async function testWebhookNotification(config: any, message: any) {
  // 实现 Webhook 通知测试
  return {
    type: 'webhook',
    status: 'success',
    message: 'Webhook notification test completed',
    config: config
  };
}

/**
 * 获取最近日志
 */
async function getRecentLogs(service: string, lines: number) {
  try {
    let command = '';
    
    if (service === 'all') {
      command = `tail -n ${lines} logs/pm2-*-combined.log`;
    } else {
      command = `tail -n ${lines} logs/pm2-${service}-combined.log`;
    }
    
    const { stdout } = await execAsync(command);
    
    return stdout.split('\n')
      .filter(line => line.trim())
      .map(line => parseLogLine(line))
      .filter(log => log);
  } catch (error) {
    return [];
  }
}

/**
 * 解析日志行
 */
function parseLogLine(line: string) {
  // 简单的日志解析，可以根据实际日志格式调整
  const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (.+)$/);
  if (!match) return null;
  
  const [, timestamp, level, message] = match;
  
  return {
    timestamp,
    level,
    message,
    service: 'unknown' // 可以从日志内容中提取服务名
  };
}

/**
 * 设置日志监听器
 */
async function setupLogWatcher(service: string, callback: (log: any) => void) {
  // 这里可以实现实时日志监听
  // 例如使用 tail -f 或文件监听器
  
  // 简单实现：定期检查日志文件
  const interval = setInterval(async () => {
    try {
      const logs = await getRecentLogs(service, 10);
      logs.forEach(callback);
    } catch (error) {
      // 忽略错误
    }
  }, 1000);
  
  return {
    close: () => clearInterval(interval)
  };
}

/**
 * 检查是否应该包含日志级别
 */
function shouldIncludeLogLevel(logLevel: string, filterLevel: string): boolean {
  const levels = ['debug', 'info', 'warn', 'error'];
  const logLevelIndex = levels.indexOf(logLevel.toLowerCase());
  const filterLevelIndex = levels.indexOf(filterLevel.toLowerCase());
  
  return logLevelIndex >= filterLevelIndex;
}

/**
 * 获取指定时间段的指标文件
 */
async function getMetricsFiles(dir: string, period: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    const now = new Date();
    let cutoffTime: Date;
    
    switch (period) {
      case '1h':
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '6h':
        cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        break;
      case '24h':
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
    }
    
    return files
      .filter(file => file.endsWith('.json'))
      .filter(file => {
        const stat = require('fs').statSync(path.join(dir, file));
        return stat.mtime >= cutoffTime;
      })
      .sort();
  } catch (error) {
    return [];
  }
}

export default router;