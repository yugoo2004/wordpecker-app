import { logger } from '../config/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

/**
 * 故障切换管理器 - 处理服务实例故障检测和自动恢复
 * 实现需求 4.1, 4.2 中的故障切换和自动恢复功能
 */
export class FailoverManager extends EventEmitter {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000;    // 健康检查间隔（毫秒）
  private readonly MAX_RESTART_ATTEMPTS = 3;         // 最大重启尝试次数
  private readonly RESTART_COOLDOWN = 60000;         // 重启冷却时间（毫秒）
  private readonly HEALTH_CHECK_TIMEOUT = 5000;      // 健康检查超时时间
  
  private restartAttempts = new Map<string, number>();
  private lastRestartTime = new Map<string, number>();
  private failedServices = new Set<string>();

  constructor() {
    super();
    logger.info('FailoverManager initialized');
  }

  /**
   * 启动健康检查和故障切换监控
   */
  public startMonitoring(): void {
    if (this.healthCheckInterval) {
      logger.warn('FailoverManager monitoring already started');
      return;
    }

    logger.info(`Starting failover monitoring with ${this.HEALTH_CHECK_INTERVAL}ms interval`);
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);

    this.emit('monitoring_started');
  }

  /**
   * 停止健康检查监控
   */
  public stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('FailoverManager monitoring stopped');
      this.emit('monitoring_stopped');
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthChecks(): Promise<void> {
    try {
      const services = await this.getMonitoredServices();
      
      for (const service of services) {
        await this.checkServiceHealth(service);
      }
      
      this.emit('health_check_completed', { 
        timestamp: new Date(),
        servicesChecked: services.length 
      });
      
    } catch (error) {
      logger.error('Health check error:', error);
      this.emit('health_check_error', error);
    }
  }

  /**
   * 获取需要监控的服务列表
   */
  private async getMonitoredServices(): Promise<ServiceInfo[]> {
    try {
      const { stdout } = await execAsync('pm2 jlist');
      const processes = JSON.parse(stdout);
      
      return processes
        .filter((proc: any) => proc.name.startsWith('wordpecker-'))
        .map((proc: any) => ({
          name: proc.name,
          pid: proc.pid,
          status: proc.pm2_env.status,
          restarts: proc.pm2_env.restart_time,
          uptime: proc.pm2_env.pm_uptime,
          memory: proc.monit.memory,
          cpu: proc.monit.cpu
        }));
    } catch (error) {
      logger.error('Failed to get monitored services:', error);
      return [];
    }
  }

  /**
   * 检查单个服务的健康状态
   */
  private async checkServiceHealth(service: ServiceInfo): Promise<void> {
    try {
      // 检查进程状态
      if (service.status !== 'online') {
        logger.warn(`Service ${service.name} is ${service.status}`);
        await this.handleServiceFailure(service, `Process status: ${service.status}`);
        return;
      }

      // 检查应用层健康状态
      const isHealthy = await this.checkApplicationHealth(service);
      
      if (!isHealthy) {
        logger.warn(`Service ${service.name} failed application health check`);
        await this.handleServiceFailure(service, 'Application health check failed');
        return;
      }

      // 检查资源使用异常
      if (this.isResourceUsageAbnormal(service)) {
        logger.warn(`Service ${service.name} has abnormal resource usage`);
        await this.handleServiceFailure(service, 'Abnormal resource usage detected');
        return;
      }

      // 服务健康，清除失败记录
      if (this.failedServices.has(service.name)) {
        this.failedServices.delete(service.name);
        this.restartAttempts.delete(service.name);
        logger.info(`Service ${service.name} recovered`);
        this.emit('service_recovered', service);
      }

    } catch (error) {
      logger.error(`Health check failed for ${service.name}:`, error);
      await this.handleServiceFailure(service, `Health check error: ${(error instanceof Error ? error.message : String(error))}`);
    }
  }

  /**
   * 检查应用层健康状态
   */
  private async checkApplicationHealth(service: ServiceInfo): Promise<boolean> {
    if (service.name === 'wordpecker-backend') {
      return await this.checkBackendHealth();
    } else if (service.name === 'wordpecker-frontend') {
      return await this.checkFrontendHealth();
    }
    
    return true; // 其他服务默认健康
  }

  /**
   * 检查后端服务健康状态
   */
  private async checkBackendHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT);
      
      const response = await fetch('http://localhost:3000/api/health', {
        signal: controller.signal,
        method: 'GET'
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.status === 'healthy';
      
    } catch (error) {
      logger.debug(`Backend health check failed: ${(error instanceof Error ? error.message : String(error))}`);
      return false;
    }
  }

  /**
   * 检查前端服务健康状态
   */
  private async checkFrontendHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.HEALTH_CHECK_TIMEOUT);
      
      const response = await fetch('http://localhost:5173', {
        signal: controller.signal,
        method: 'GET'
      });
      
      clearTimeout(timeoutId);
      return response.ok;
      
    } catch (error) {
      logger.debug(`Frontend health check failed: ${(error instanceof Error ? error.message : String(error))}`);
      return false;
    }
  }

  /**
   * 检查资源使用是否异常
   */
  private isResourceUsageAbnormal(service: ServiceInfo): boolean {
    // 内存使用超过500MB认为异常
    const memoryLimitMB = 500;
    const memoryUsageMB = service.memory / (1024 * 1024);
    
    if (memoryUsageMB > memoryLimitMB) {
      logger.warn(`Service ${service.name} memory usage: ${memoryUsageMB.toFixed(2)}MB (limit: ${memoryLimitMB}MB)`);
      return true;
    }
    
    // CPU使用率持续超过90%认为异常
    if (service.cpu > 90) {
      logger.warn(`Service ${service.name} CPU usage: ${service.cpu}%`);
      return true;
    }
    
    return false;
  }

  /**
   * 处理服务故障
   */
  private async handleServiceFailure(service: ServiceInfo, reason: string): Promise<void> {
    const serviceName = service.name;
    
    // 记录故障
    this.failedServices.add(serviceName);
    
    // 检查重启冷却时间
    const lastRestart = this.lastRestartTime.get(serviceName) || 0;
    const timeSinceRestart = Date.now() - lastRestart;
    
    if (timeSinceRestart < this.RESTART_COOLDOWN) {
      logger.debug(`Service ${serviceName} in restart cooldown, ${this.RESTART_COOLDOWN - timeSinceRestart}ms remaining`);
      return;
    }
    
    // 检查重启次数限制
    const attempts = this.restartAttempts.get(serviceName) || 0;
    
    if (attempts >= this.MAX_RESTART_ATTEMPTS) {
      logger.error(`Service ${serviceName} exceeded max restart attempts (${this.MAX_RESTART_ATTEMPTS})`);
      this.emit('service_failed_permanently', { service, reason, attempts });
      return;
    }
    
    // 执行故障切换
    await this.executeFailover(service, reason);
  }

  /**
   * 执行故障切换操作
   */
  private async executeFailover(service: ServiceInfo, reason: string): Promise<void> {
    const serviceName = service.name;
    
    try {
      logger.info(`Executing failover for ${serviceName}: ${reason}`);
      
      // 增加重启尝试计数
      const attempts = (this.restartAttempts.get(serviceName) || 0) + 1;
      this.restartAttempts.set(serviceName, attempts);
      this.lastRestartTime.set(serviceName, Date.now());
      
      // 执行重启
      await this.restartService(serviceName);
      
      // 等待服务恢复
      await this.waitForServiceRecovery(serviceName);
      
      logger.info(`Failover completed for ${serviceName} (attempt ${attempts})`);
      this.emit('failover_completed', { service, reason, attempts });
      
    } catch (error) {
      logger.error(`Failover failed for ${serviceName}:`, error);
      this.emit('failover_failed', { service, reason, error });
      throw error;
    }
  }

  /**
   * 重启服务
   */
  private async restartService(serviceName: string): Promise<void> {
    try {
      // 优雅重启
      await execAsync(`pm2 reload ${serviceName}`);
      logger.info(`Service ${serviceName} reloaded`);
      
    } catch (reloadError) {
      logger.warn(`Reload failed for ${serviceName}, trying restart:`, reloadError);
      
      try {
        // 强制重启
        await execAsync(`pm2 restart ${serviceName}`);
        logger.info(`Service ${serviceName} restarted`);
        
      } catch (restartError) {
        logger.error(`Restart failed for ${serviceName}:`, restartError);
        throw restartError;
      }
    }
  }

  /**
   * 等待服务恢复
   */
  private async waitForServiceRecovery(serviceName: string, maxWaitMs = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const services = await this.getMonitoredServices();
        const service = services.find(s => s.name === serviceName);
        
        if (service && service.status === 'online') {
          // 检查应用层健康状态
          const isHealthy = await this.checkApplicationHealth(service);
          
          if (isHealthy) {
            logger.info(`Service ${serviceName} recovered successfully`);
            return;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        logger.debug(`Recovery check failed for ${serviceName}:`, error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error(`Service ${serviceName} failed to recover within ${maxWaitMs}ms`);
  }

  /**
   * 手动触发服务故障切换
   */
  public async triggerFailover(serviceName: string, reason = 'Manual trigger'): Promise<void> {
    const services = await this.getMonitoredServices();
    const service = services.find(s => s.name === serviceName);
    
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    
    await this.executeFailover(service, reason);
  }

  /**
   * 重置服务的故障状态
   */
  public resetServiceFailureState(serviceName: string): void {
    this.failedServices.delete(serviceName);
    this.restartAttempts.delete(serviceName);
    this.lastRestartTime.delete(serviceName);
    
    logger.info(`Reset failure state for service ${serviceName}`);
    this.emit('failure_state_reset', { serviceName });
  }

  /**
   * 获取故障切换管理器状态
   */
  public async getStatus(): Promise<FailoverManagerStatus> {
    const services = await this.getMonitoredServices();
    
    return {
      isMonitoring: this.healthCheckInterval !== null,
      monitoredServices: services.length,
      failedServices: Array.from(this.failedServices),
      restartAttempts: Object.fromEntries(this.restartAttempts),
      lastHealthCheck: new Date(),
      configuration: {
        healthCheckInterval: this.HEALTH_CHECK_INTERVAL,
        maxRestartAttempts: this.MAX_RESTART_ATTEMPTS,
        restartCooldown: this.RESTART_COOLDOWN,
        healthCheckTimeout: this.HEALTH_CHECK_TIMEOUT
      }
    };
  }
}

// 类型定义
interface ServiceInfo {
  name: string;
  pid: number;
  status: string;
  restarts: number;
  uptime: number;
  memory: number;
  cpu: number;
}

interface FailoverManagerStatus {
  isMonitoring: boolean;
  monitoredServices: number;
  failedServices: string[];
  restartAttempts: Record<string, number>;
  lastHealthCheck: Date;
  configuration: {
    healthCheckInterval: number;
    maxRestartAttempts: number;
    restartCooldown: number;
    healthCheckTimeout: number;
  };
}