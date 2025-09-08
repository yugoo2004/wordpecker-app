import { logger } from '../config/logger';
import { LoadBalancer } from './loadBalancer';
import { FailoverManager } from './failoverManager';
import { EventEmitter } from 'events';

/**
 * 高可用性管理器 - 整合负载均衡和故障切换功能
 * 实现需求 4.1, 4.3, 4.4 中的完整高可用性解决方案
 */
export class HighAvailabilityManager extends EventEmitter {
  private loadBalancer: LoadBalancer;
  private failoverManager: FailoverManager;
  private isRunning = false;
  private startTime: Date | null = null;

  constructor() {
    super();

    // 初始化组件
    this.loadBalancer = new LoadBalancer();
    this.failoverManager = new FailoverManager();

    // 设置事件监听
    this.setupEventListeners();

    logger.info('HighAvailabilityManager initialized');
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 负载均衡器事件
    this.loadBalancer.on('scaling_completed', (decision) => {
      logger.info(`Load balancer scaling completed: ${decision.action} to ${decision.targetInstances} instances`);
      this.emit('scaling_event', decision);
    });

    this.loadBalancer.on('scaling_failed', (error) => {
      logger.error('Load balancer scaling failed:', error);
      this.emit('scaling_error', error);
    });

    this.loadBalancer.on('metrics_collected', (data) => {
      this.emit('metrics_update', data);
    });

    // 故障切换管理器事件
    this.failoverManager.on('failover_completed', (data) => {
      logger.info(`Failover completed for ${data.service.name}: ${data.reason}`);
      this.emit('failover_event', data);
    });

    this.failoverManager.on('failover_failed', (error) => {
      logger.error('Failover operation failed:', error);
      this.emit('failover_error', error);
    });

    this.failoverManager.on('service_recovered', (service) => {
      logger.info(`Service ${service.name} recovered successfully`);
      this.emit('service_recovery', service);
    });

    this.failoverManager.on('service_failed_permanently', (data) => {
      logger.error(`Service ${data.service.name} failed permanently after ${data.attempts} attempts`);
      this.emit('service_permanent_failure', data);
    });
  }

  /**
   * 启动高可用性管理
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('HighAvailabilityManager is already running');
      return;
    }

    try {
      logger.info('Starting HighAvailabilityManager...');

      // 启动故障切换监控
      this.failoverManager.startMonitoring();

      // 启动负载均衡监控
      this.loadBalancer.startMonitoring();

      this.isRunning = true;
      this.startTime = new Date();

      logger.info('HighAvailabilityManager started successfully');
      this.emit('started');

    } catch (error) {
      logger.error('Failed to start HighAvailabilityManager:', error);
      this.emit('start_error', error);
      throw error;
    }
  }

  /**
   * 停止高可用性管理
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('HighAvailabilityManager is not running');
      return;
    }

    try {
      logger.info('Stopping HighAvailabilityManager...');

      // 停止监控
      this.loadBalancer.stopMonitoring();
      this.failoverManager.stopMonitoring();

      this.isRunning = false;
      this.startTime = null;

      logger.info('HighAvailabilityManager stopped successfully');
      this.emit('stopped');

    } catch (error) {
      logger.error('Failed to stop HighAvailabilityManager:', error);
      this.emit('stop_error', error);
      throw error;
    }
  }

  /**
   * 手动触发扩容操作
   */
  public async scaleUp(targetInstances?: number): Promise<void> {
    try {
      const currentStatus = await this.loadBalancer.getStatus();
      const target = targetInstances || Math.min(currentStatus.currentInstances + 1, currentStatus.limits.max);

      logger.info(`Manual scale up requested to ${target} instances`);

      // 模拟高负载触发扩容
      await this.loadBalancer.monitorAndScale();

      this.emit('manual_scaling', { action: 'scale_up', target });

    } catch (error) {
      logger.error('Manual scale up failed:', error);
      throw error;
    }
  }

  /**
   * 手动触发缩容操作
   */
  public async scaleDown(targetInstances?: number): Promise<void> {
    try {
      const currentStatus = await this.loadBalancer.getStatus();
      const target = targetInstances || Math.max(currentStatus.currentInstances - 1, currentStatus.limits.min);

      logger.info(`Manual scale down requested to ${target} instances`);

      // 执行缩容逻辑
      await this.loadBalancer.monitorAndScale();

      this.emit('manual_scaling', { action: 'scale_down', target });

    } catch (error) {
      logger.error('Manual scale down failed:', error);
      throw error;
    }
  }

  /**
   * 手动触发故障切换
   */
  public async triggerFailover(serviceName: string, reason = 'Manual trigger'): Promise<void> {
    try {
      logger.info(`Manual failover triggered for ${serviceName}: ${reason}`);

      await this.failoverManager.triggerFailover(serviceName, reason);

      this.emit('manual_failover', { serviceName, reason });

    } catch (error) {
      logger.error(`Manual failover failed for ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * 重置服务故障状态
   */
  public resetServiceFailureState(serviceName: string): void {
    this.failoverManager.resetServiceFailureState(serviceName);
    this.emit('failure_state_reset', { serviceName });
  }

  /**
   * 获取完整的高可用性状态
   */
  public async getStatus(): Promise<HighAvailabilityStatus> {
    try {
      const [loadBalancerStatus, failoverStatus] = await Promise.all([
        this.loadBalancer.getStatus(),
        this.failoverManager.getStatus()
      ]);

      return {
        isRunning: this.isRunning,
        startTime: this.startTime,
        uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
        loadBalancer: loadBalancerStatus,
        failover: failoverStatus,
        summary: {
          totalInstances: loadBalancerStatus.currentInstances,
          healthyServices: failoverStatus.monitoredServices - failoverStatus.failedServices.length,
          failedServices: failoverStatus.failedServices.length,
          lastScaling: loadBalancerStatus.lastScaleTime,
          lastHealthCheck: failoverStatus.lastHealthCheck
        }
      };

    } catch (error) {
      logger.error('Failed to get HA status:', error);
      throw error;
    }
  }

  /**
   * 执行健康检查
   */
  public async performHealthCheck(): Promise<HealthCheckResult> {
    try {
      const status = await this.getStatus();

      const issues: string[] = [];

      // 检查负载均衡器状态
      if (!status.loadBalancer.isMonitoring) {
        issues.push('Load balancer monitoring is not active');
      }

      // 检查故障切换管理器状态
      if (!status.failover.isMonitoring) {
        issues.push('Failover manager monitoring is not active');
      }

      // 检查失败的服务
      if (status.failover.failedServices.length > 0) {
        issues.push(`${status.failover.failedServices.length} services are in failed state`);
      }

      // 检查系统资源
      const metrics = status.loadBalancer.metrics;
      if (metrics.cpu > 90) {
        issues.push(`High CPU usage: ${metrics.cpu}%`);
      }

      if (metrics.memory > 90) {
        issues.push(`High memory usage: ${metrics.memory}%`);
      }

      const isHealthy = issues.length === 0;

      return {
        isHealthy,
        issues,
        timestamp: new Date(),
        metrics: status.loadBalancer.metrics,
        services: {
          total: status.failover.monitoredServices,
          healthy: status.summary.healthyServices,
          failed: status.summary.failedServices
        }
      };

    } catch (error) {
      logger.error('Health check failed:', error);
      return {
        isHealthy: false,
        issues: [`Health check error: ${(error instanceof Error ? error.message : String(error))}`],
        timestamp: new Date(),
        metrics: null,
        services: { total: 0, healthy: 0, failed: 0 }
      };
    }
  }

  /**
   * 获取性能指标
   */
  public async getMetrics(): Promise<PerformanceMetrics> {
    try {
      const status = await this.getStatus();

      return {
        timestamp: new Date(),
        system: status.loadBalancer.metrics,
        instances: {
          current: status.loadBalancer.currentInstances,
          min: status.loadBalancer.limits.min,
          max: status.loadBalancer.limits.max
        },
        services: {
          monitored: status.failover.monitoredServices,
          healthy: status.summary.healthyServices,
          failed: status.summary.failedServices
        },
        uptime: status.uptime,
        events: {
          lastScaling: status.loadBalancer.lastScaleTime,
          lastHealthCheck: status.failover.lastHealthCheck
        }
      };

    } catch (error) {
      logger.error('Failed to get metrics:', error);
      throw error;
    }
  }
}

// 类型定义
interface HighAvailabilityStatus {
  isRunning: boolean;
  startTime: Date | null;
  uptime: number;
  loadBalancer: any;
  failover: any;
  summary: {
    totalInstances: number;
    healthyServices: number;
    failedServices: number;
    lastScaling: Date;
    lastHealthCheck: Date;
  };
}

interface HealthCheckResult {
  isHealthy: boolean;
  issues: string[];
  timestamp: Date;
  metrics: any;
  services: {
    total: number;
    healthy: number;
    failed: number;
  };
}

interface PerformanceMetrics {
  timestamp: Date;
  system: any;
  instances: {
    current: number;
    min: number;
    max: number;
  };
  services: {
    monitored: number;
    healthy: number;
    failed: number;
  };
  uptime: number;
  events: {
    lastScaling: Date;
    lastHealthCheck: Date;
  };
}