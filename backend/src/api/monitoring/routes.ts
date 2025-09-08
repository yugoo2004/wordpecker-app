import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const execAsync = promisify(exec);

// 监控仪表板数据接口
router.get('/dashboard', async (req, res) => {
  try {
    const dashboardData = await generateDashboardData();
    res.json({
      success: true,
      data: dashboardData,
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

// 系统指标接口
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await collectSystemMetrics();
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

// 服务健康状态接口
router.get('/health-status', async (req, res) => {
  try {
    const healthStatus = await getHealthStatus();
    res.json({
      success: true,
      data: healthStatus,
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

// 告警历史接口
router.get('/alerts', async (req, res) => {
  try {
    const { limit = 50, level } = req.query;
    const alerts = await getAlertHistory(Number(limit), level as string);
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

// 性能趋势接口
router.get('/trends', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const trends = await getPerformanceTrends(Number(hours));
    res.json({
      success: true,
      data: trends,
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

// 告警配置接口
router.get('/alert-config', async (req, res) => {
  try {
    const config = await getAlertConfiguration();
    res.json({
      success: true,
      data: config,
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

router.put('/alert-config', async (req, res) => {
  try {
    const config = req.body;
    await updateAlertConfiguration(config);
    res.json({
      success: true,
      message: '告警配置已更新',
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

// 生成仪表板数据
async function generateDashboardData() {
  const [systemMetrics, healthStatus, pm2Status, alertSummary] = await Promise.all([
    collectSystemMetrics(),
    getHealthStatus(),
    getPM2Status(),
    getAlertSummary()
  ]);

  return {
    system: systemMetrics,
    health: healthStatus,
    services: pm2Status,
    alerts: alertSummary,
    uptime: process.uptime(),
    lastUpdate: new Date().toISOString()
  };
}

// 收集系统指标
async function collectSystemMetrics() {
  try {
    // CPU 使用率
    const cpuUsage = await getCPUUsage();
    
    // 内存使用率
    const memoryInfo = await getMemoryInfo();
    
    // 磁盘使用率
    const diskUsage = await getDiskUsage();
    
    // 网络统计
    const networkStats = await getNetworkStats();
    
    // 负载平均值
    const loadAverage = await getLoadAverage();

    return {
      cpu: {
        usage: cpuUsage,
        cores: require('os').cpus().length
      },
      memory: memoryInfo,
      disk: diskUsage,
      network: networkStats,
      load: loadAverage
    };
  } catch (error) {
    throw new Error(`收集系统指标失败: ${(error instanceof Error ? error.message : String(error))}`);
  }
}

// 获取 CPU 使用率
async function getCPUUsage() {
  try {
    const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}'");
    return parseFloat(stdout.trim()) || 0;
  } catch (error) {
    return 0;
  }
}

// 获取内存信息
async function getMemoryInfo() {
  try {
    const { stdout } = await execAsync("free -b | grep '^Mem:'");
    const memInfo = stdout.trim().split(/\s+/);
    const total = parseInt(memInfo[1]);
    const used = parseInt(memInfo[2]);
    const available = parseInt(memInfo[6]);
    
    return {
      total: total,
      used: used,
      available: available,
      usage: Math.round((used / total) * 100),
      free: total - used
    };
  } catch (error) {
    return { total: 0, used: 0, available: 0, usage: 0, free: 0 };
  }
}

// 获取磁盘使用率
async function getDiskUsage() {
  try {
    const { stdout } = await execAsync("df -B1 / | tail -1");
    const diskInfo = stdout.trim().split(/\s+/);
    const total = parseInt(diskInfo[1]);
    const used = parseInt(diskInfo[2]);
    const available = parseInt(diskInfo[3]);
    
    return {
      total: total,
      used: used,
      available: available,
      usage: Math.round((used / total) * 100)
    };
  } catch (error) {
    return { total: 0, used: 0, available: 0, usage: 0 };
  }
}

// 获取网络统计
async function getNetworkStats() {
  try {
    const { stdout } = await execAsync("cat /proc/net/dev | grep -E 'eth0|ens|enp' | head -1");
    if (!stdout.trim()) {
      return { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 };
    }
    
    const netInfo = stdout.trim().split(/\s+/);
    return {
      bytesIn: parseInt(netInfo[1]) || 0,
      bytesOut: parseInt(netInfo[9]) || 0,
      packetsIn: parseInt(netInfo[2]) || 0,
      packetsOut: parseInt(netInfo[10]) || 0
    };
  } catch (error) {
    return { bytesIn: 0, bytesOut: 0, packetsIn: 0, packetsOut: 0 };
  }
}

// 获取负载平均值
async function getLoadAverage() {
  try {
    const { stdout } = await execAsync("uptime | awk -F'load average:' '{print $2}' | xargs");
    const loads = stdout.trim().split(',').map(l => parseFloat(l.trim()));
    return {
      load1: loads[0] || 0,
      load5: loads[1] || 0,
      load15: loads[2] || 0
    };
  } catch (error) {
    return { load1: 0, load5: 0, load15: 0 };
  }
}

// 获取健康状态
async function getHealthStatus() {
  try {
    const statusFile = path.join(process.cwd(), '../logs/service-status-optimized.json');
    const metricsFile = path.join(process.cwd(), '../logs/health-metrics.json');
    
    let healthData = { services: {}, system: {} };
    let metricsData = { services: {} };
    
    try {
      const statusContent = await fs.readFile(statusFile, 'utf-8');
      healthData = JSON.parse(statusContent);
    } catch (error) {
      // 文件不存在或格式错误，使用默认值
    }
    
    try {
      const metricsContent = await fs.readFile(metricsFile, 'utf-8');
      metricsData = JSON.parse(metricsContent);
    } catch (error) {
      // 文件不存在或格式错误，使用默认值
    }
    
    return {
      backend: {
        status: (healthData.services as any)?.backend?.status || 'unknown',
        responseTime: (healthData.services as any)?.backend?.response_time_ms || -1,
        availability: (metricsData.services as any)?.backend?.availability_percent || 0,
        consecutiveFailures: (metricsData.services as any)?.backend?.consecutive_failures || 0
      },
      frontend: {
        status: (healthData.services as any)?.frontend?.status || 'unknown',
        responseTime: (healthData.services as any)?.frontend?.response_time_ms || -1,
        availability: (metricsData.services as any)?.frontend?.availability_percent || 0,
        consecutiveFailures: (metricsData.services as any)?.frontend?.consecutive_failures || 0
      },
      lastCheck: (healthData as any).check_time || new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`获取健康状态失败: ${(error instanceof Error ? error.message : String(error))}`);
  }
}

// 获取 PM2 状态
async function getPM2Status() {
  try {
    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout);
    
    return processes.map(proc => ({
      name: proc.name,
      status: proc.pm2_env.status,
      uptime: proc.pm2_env.pm_uptime,
      memory: proc.monit.memory,
      cpu: proc.monit.cpu,
      restarts: proc.pm2_env.restart_time,
      pid: proc.pid,
      instances: proc.pm2_env.instances || 1
    }));
  } catch (error) {
    return [];
  }
}

// 获取告警摘要
async function getAlertSummary() {
  try {
    const alertFile = path.join(process.cwd(), '../logs/resource-alerts-optimized.log');
    const content = await fs.readFile(alertFile, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    // 分析最近24小时的告警
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    
    lines.forEach(line => {
      try {
        const timestamp = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/)?.[1];
        if (timestamp) {
          const alertTime = new Date(timestamp);
          if (alertTime >= yesterday) {
            if (line.includes('[CRITICAL]')) criticalCount++;
            else if (line.includes('[WARNING]')) warningCount++;
            else if (line.includes('[INFO]')) infoCount++;
          }
        }
      } catch (error) {
        // 忽略解析错误的行
      }
    });
    
    return {
      critical: criticalCount,
      warning: warningCount,
      info: infoCount,
      total: criticalCount + warningCount + infoCount,
      period: '24小时'
    };
  } catch (error) {
    return { critical: 0, warning: 0, info: 0, total: 0, period: '24小时' };
  }
}

// 获取告警历史
async function getAlertHistory(limit: number, level?: string) {
  try {
    const alertFile = path.join(process.cwd(), '../logs/resource-alerts-optimized.log');
    const content = await fs.readFile(alertFile, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    const alerts = lines
      .reverse() // 最新的在前
      .slice(0, limit * 2) // 取更多行以便过滤
      .map(line => {
        const match = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\] (.+)/);
        if (match) {
          return {
            timestamp: match[1],
            level: match[2],
            message: match[3]
          };
        }
        return null;
      })
      .filter(alert => alert !== null);
    
    // 按级别过滤
    let filteredAlerts = alerts;
    if (level) {
      filteredAlerts = alerts.filter(alert => alert.level === level.toUpperCase());
    }
    
    return filteredAlerts.slice(0, limit);
  } catch (error) {
    return [];
  }
}

// 获取性能趋势
async function getPerformanceTrends(hours: number) {
  try {
    const metricsFile = path.join(process.cwd(), '../logs/resource-metrics.json');
    
    // 这里简化实现，实际应该从时序数据库或日志文件中获取历史数据
    const currentMetrics = await collectSystemMetrics();
    
    // 模拟趋势数据（实际应该从历史记录中获取）
    const dataPoints = [];
    const now = new Date();
    
    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
      dataPoints.push({
        timestamp: timestamp.toISOString(),
        cpu: currentMetrics.cpu.usage + (Math.random() - 0.5) * 20,
        memory: currentMetrics.memory.usage + (Math.random() - 0.5) * 20,
        disk: currentMetrics.disk.usage + (Math.random() - 0.5) * 10
      });
    }
    
    return {
      period: `${hours}小时`,
      dataPoints: dataPoints,
      summary: {
        avgCpu: dataPoints.reduce((sum, dp) => sum + dp.cpu, 0) / dataPoints.length,
        avgMemory: dataPoints.reduce((sum, dp) => sum + dp.memory, 0) / dataPoints.length,
        avgDisk: dataPoints.reduce((sum, dp) => sum + dp.disk, 0) / dataPoints.length
      }
    };
  } catch (error) {
    return { period: `${hours}小时`, dataPoints: [], summary: {} };
  }
}

// 获取告警配置
async function getAlertConfiguration() {
  const defaultConfig = {
    thresholds: {
      cpu: { warning: 65, critical: 80 },
      memory: { warning: 70, critical: 85 },
      disk: { warning: 75, critical: 85 },
      responseTime: { warning: 2000, critical: 5000 }
    },
    notifications: {
      email: { enabled: false, recipients: [] },
      slack: { enabled: false, webhook: '' },
      sms: { enabled: false, numbers: [] }
    },
    cooldown: {
      minutes: 5
    }
  };
  
  try {
    const configFile = path.join(process.cwd(), '../config/alert-config.json');
    const content = await fs.readFile(configFile, 'utf-8');
    return { ...defaultConfig, ...JSON.parse(content) };
  } catch (error) {
    return defaultConfig;
  }
}

// 更新告警配置
async function updateAlertConfiguration(config: any) {
  try {
    const configFile = path.join(process.cwd(), '../config/alert-config.json');
    await fs.writeFile(configFile, JSON.stringify(config, null, 2));
  } catch (error) {
    throw new Error(`更新告警配置失败: ${(error instanceof Error ? error.message : String(error))}`);
  }
}

export default router;