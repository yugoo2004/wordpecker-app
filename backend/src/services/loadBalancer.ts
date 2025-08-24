import { logger } from '../config/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

/**
 * 负载均衡器 - 自动监控系统负载并进行扩缩容
 * 实现需求 4.1, 4.3, 4.4 中的自动扩容和负载管理
 */
export class LoadBalancer extends EventEmitter {
  private readonly CPU_THRESHOLD_HIGH = 80;      // CPU使用率高阈值
  private readonly CPU_THRESHOLD_LOW = 30;       // CPU使用率低阈值
  private readonly MEMORY_THRESHOLD_HIGH = 80;   // 内存使用率高阈值
  private readonly MEMORY_THRESHOLD_LOW = 30;    // 内存使用率低阈值
  private readonly MAX_INSTANCES = 4;            // 最大实例数
  private readonly MIN_INSTANCES = 1;            // 最小实例数
  private readonly SCALE_COOLDOWN = 60000;       // 扩缩容冷却时间（毫秒）
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastScaleTime = 0;
  private isScaling = false;

  constructor() {
    super();
    logger.info('LoadBalancer initialized');
  }

  /**
   * 启动负载监控
   */
  public startMonitoring(intervalMs = 30000): void {
    if (this.monitoringInterval) {
      logger.warn('LoadBalancer monitoring already started');
      return;
    }

    logger.info(`Starting load monitoring with ${intervalMs}ms interval`);
    this.monitoringInterval = setInterval(async () => {
      await this.monitorAndScale();
    }, intervalMs);

    this.emit('monitoring_started');
  }

  /**
   * 停止负载监控
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('LoadBalancer monitoring stopped');
      this.emit('monitoring_stopped');
    }
  }

  /**
   * 监控系统负载并执行自动扩缩容
   */
  public async monitorAndScale(): Promise<void> {
    try {
      // 获取系统指标
      const metrics = await this.getSystemMetrics();
      const currentInstances = await this.getCurrentInstances();
      
      logger.info(`System metrics - CPU: ${metrics.cpu}%, Memory: ${metrics.memory}%, Instances: ${currentInstances}`);
      
      // 检查是否需要扩缩容
      const scaleDecision = this.shouldScale(metrics, currentInstances);
      
      if (scaleDecision.action !== 'none' && this.canScale()) {
        await this.executeScaling(scaleDecision);
      }

      // 发出监控事件
      this.emit('metrics_collected', { metrics, instances: currentInstances });
      
    } catch (error) {
      logger.error('Load monitoring error:', error);
      this.emit('monitoring_error', error);
    }
  }

  /**
   * 获取系统性能指标
   */
  private async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      // 获取CPU使用率
      const { stdout: cpuInfo } = await execAsync(
        "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}'"
      );
      
      // 获取内存使用率
      const { stdout: memInfo } = await execAsync(
        "free | grep Mem | awk '{printf(\"%.1f\", $3/$2 * 100.0)}'"
      );
      
      // 获取磁盘使用率
      const { stdout: diskInfo } = await execAsync(
        "df -h / | awk 'NR==2{print $5}' | sed 's/%//'"
      );

      // 获取网络连接数
      const { stdout: connInfo } = await execAsync(
        "netstat -an | grep :3000 | grep ESTABLISHED | wc -l"
      );

      return {
        cpu: parseFloat(cpuInfo.trim()) || 0,
        memory: parseFloat(memInfo.trim()) || 0,
        disk: parseFloat(diskInfo.trim()) || 0,
        connections: parseInt(connInfo.trim()) || 0,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      throw error;
    }
  }

  /**
   * 获取当前运行的实例数量
   */
  private async getCurrentInstances(): Promise<number> {
    try {
      const { stdout } = await execAsync('pm2 jlist');
      const processes = JSON.parse(stdout);
      
      const backendProcesses = processes.filter((proc: any) => 
        proc.name === 'wordpecker-backend' && proc.pm2_env.status === 'online'
      );
      
      return backendProcesses.length;
    } catch (error) {
      logger.error('Failed to get current instances:', error);
      return 1; // 默认返回1个实例
    }
  }

  /**
   * 判断是否需要扩缩容
   */
  private shouldScale(metrics: SystemMetrics, currentInstances: number): ScaleDecision {
    // 扩容条件：CPU或内存使用率超过高阈值，且未达到最大实例数
    if ((metrics.cpu > this.CPU_THRESHOLD_HIGH || metrics.memory > this.MEMORY_THRESHOLD_HIGH) 
        && currentInstances < this.MAX_INSTANCES) {
      return {
        action: 'scale_up',
        reason: `High resource usage - CPU: ${metrics.cpu}%, Memory: ${metrics.memory}%`,
        targetInstances: Math.min(currentInstances + 1, this.MAX_INSTANCES)
      };
    }
    
    // 缩容条件：CPU和内存使用率都低于低阈值，且超过最小实例数
    if (metrics.cpu < this.CPU_THRESHOLD_LOW && metrics.memory < this.MEMORY_THRESHOLD_LOW 
        && currentInstances > this.MIN_INSTANCES) {
      return {
        action: 'scale_down',
        reason: `Low resource usage - CPU: ${metrics.cpu}%, Memory: ${metrics.memory}%`,
        targetInstances: Math.max(currentInstances - 1, this.MIN_INSTANCES)
      };
    }

    return { action: 'none', reason: 'No scaling needed', targetInstances: currentInstances };
  }

  /**
   * 检查是否可以执行扩缩容（冷却时间检查）
   */
  private canScale(): boolean {
    const now = Date.now();
    const timeSinceLastScale = now - this.lastScaleTime;
    
    if (this.isScaling) {
      logger.debug('Scaling operation already in progress');
      return false;
    }
    
    if (timeSinceLastScale < this.SCALE_COOLDOWN) {
      logger.debug(`Scaling cooldown active, ${this.SCALE_COOLDOWN - timeSinceLastScale}ms remaining`);
      return false;
    }
    
    return true;
  }

  /**
   * 执行扩缩容操作
   */
  private async executeScaling(decision: ScaleDecision): Promise<void> {
    this.isScaling = true;
    this.lastScaleTime = Date.now();
    
    try {
      logger.info(`Executing ${decision.action}: ${decision.reason}`);
      
      if (decision.action === 'scale_up') {
        await this.scaleUp(decision.targetInstances);
      } else if (decision.action === 'scale_down') {
        await this.scaleDown(decision.targetInstances);
      }
      
      this.emit('scaling_completed', decision);
      
    } catch (error) {
      logger.error(`Scaling operation failed:`, error);
      this.emit('scaling_failed', { decision, error });
      throw error;
    } finally {
      this.isScaling = false;
    }
  }

  /**
   * 扩容操作
   */
  private async scaleUp(targetInstances: number): Promise<void> {
    try {
      await execAsync(`pm2 scale wordpecker-backend ${targetInstances}`);
      logger.info(`Scaled up backend to ${targetInstances} instances`);
      
      // 等待新实例启动
      await this.waitForInstancesReady(targetInstances);
      
    } catch (error) {
      logger.error('Scale up operation failed:', error);
      throw error;
    }
  }

  /**
   * 缩容操作
   */
  private async scaleDown(targetInstances: number): Promise<void> {
    try {
      await execAsync(`pm2 scale wordpecker-backend ${targetInstances}`);
      logger.info(`Scaled down backend to ${targetInstances} instances`);
      
    } catch (error) {
      logger.error('Scale down operation failed:', error);
      throw error;
    }
  }

  /**
   * 等待实例就绪
   */
  private async waitForInstancesReady(expectedInstances: number, maxWaitMs = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const currentInstances = await this.getCurrentInstances();
      
      if (currentInstances >= expectedInstances) {
        // 检查实例健康状态
        const healthyInstances = await this.getHealthyInstances();
        if (healthyInstances >= expectedInstances) {
          logger.info(`All ${expectedInstances} instances are ready and healthy`);
          return;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error(`Timeout waiting for ${expectedInstances} instances to be ready`);
  }

  /**
   * 获取健康实例数量
   */
  private async getHealthyInstances(): Promise<number> {
    try {
      const response = await fetch('http://localhost:3000/api/health');
      return response.ok ? await this.getCurrentInstances() : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 获取当前负载均衡状态
   */
  public async getStatus(): Promise<LoadBalancerStatus> {
    const metrics = await this.getSystemMetrics();
    const instances = await this.getCurrentInstances();
    
    return {
      isMonitoring: this.monitoringInterval !== null,
      isScaling: this.isScaling,
      currentInstances: instances,
      lastScaleTime: new Date(this.lastScaleTime),
      metrics,
      thresholds: {
        cpu: { high: this.CPU_THRESHOLD_HIGH, low: this.CPU_THRESHOLD_LOW },
        memory: { high: this.MEMORY_THRESHOLD_HIGH, low: this.MEMORY_THRESHOLD_LOW }
      },
      limits: {
        min: this.MIN_INSTANCES,
        max: this.MAX_INSTANCES
      }
    };
  }
}

// 类型定义
interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  connections: number;
  timestamp: Date;
}

interface ScaleDecision {
  action: 'scale_up' | 'scale_down' | 'none';
  reason: string;
  targetInstances: number;
}

interface LoadBalancerStatus {
  isMonitoring: boolean;
  isScaling: boolean;
  currentInstances: number;
  lastScaleTime: Date;
  metrics: SystemMetrics;
  thresholds: {
    cpu: { high: number; low: number };
    memory: { high: number; low: number };
  };
  limits: {
    min: number;
    max: number;
  };
}