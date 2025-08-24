import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, readdir, stat, access } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../config/logger';
import { 
  ServiceStatus, 
  SystemMetrics, 
  LogFile, 
  OperationResult,
  DeploymentResult 
} from './schemas';

const execAsync = promisify(exec);

export class ManagementService {
  private readonly validServices = ['wordpecker-backend', 'wordpecker-frontend'];
  private readonly logsDir = join(process.cwd(), '../logs');

  /**
   * 验证服务名称
   */
  private validateService(service: string): boolean {
    return service === 'all' || this.validServices.includes(service);
  }

  /**
   * 执行PM2命令
   */
  private async executePM2Command(command: string): Promise<{ stdout: string; stderr: string }> {
    try {
      const result = await execAsync(command);
      return result;
    } catch (error) {
      logger.error('PM2命令执行失败', { command, error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error(`PM2命令执行失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 重启服务
   */
  async restartService(service: string): Promise<OperationResult> {
    if (!this.validateService(service)) {
      throw new Error('无效的服务名称');
    }

    const command = service === 'all' ? 'pm2 restart all' : `pm2 restart ${service}`;
    const { stdout, stderr } = await this.executePM2Command(command);

    logger.info('服务重启成功', { service, command });

    return {
      success: true,
      message: `服务 ${service} 重启成功`,
      timestamp: new Date().toISOString(),
      details: { stdout: stdout.trim(), stderr: stderr.trim() }
    };
  }

  /**
   * 停止服务
   */
  async stopService(service: string): Promise<OperationResult> {
    if (!this.validateService(service)) {
      throw new Error('无效的服务名称');
    }

    const command = service === 'all' ? 'pm2 stop all' : `pm2 stop ${service}`;
    const { stdout, stderr } = await this.executePM2Command(command);

    logger.info('服务停止成功', { service, command });

    return {
      success: true,
      message: `服务 ${service} 停止成功`,
      timestamp: new Date().toISOString(),
      details: { stdout: stdout.trim(), stderr: stderr.trim() }
    };
  }

  /**
   * 启动服务
   */
  async startService(service: string): Promise<OperationResult> {
    if (!this.validateService(service)) {
      throw new Error('无效的服务名称');
    }

    let command: string;
    if (service === 'all') {
      command = 'pm2 start ecosystem.config.js --env production';
    } else {
      command = `pm2 start ${service}`;
    }

    const { stdout, stderr } = await this.executePM2Command(command);

    logger.info('服务启动成功', { service, command });

    return {
      success: true,
      message: `服务 ${service} 启动成功`,
      timestamp: new Date().toISOString(),
      details: { stdout: stdout.trim(), stderr: stderr.trim() }
    };
  }

  /**
   * 扩缩容服务
   */
  async scaleService(service: string, instances: number): Promise<OperationResult> {
    if (!this.validServices.includes(service)) {
      throw new Error('无效的服务名称');
    }

    if (instances < 1 || instances > 5) {
      throw new Error('实例数量必须在1-5之间');
    }

    const command = `pm2 scale ${service} ${instances}`;
    const { stdout, stderr } = await this.executePM2Command(command);

    logger.info('服务扩缩容成功', { service, instances, command });

    return {
      success: true,
      message: `服务 ${service} 扩缩容至 ${instances} 个实例`,
      timestamp: new Date().toISOString(),
      details: { stdout: stdout.trim(), stderr: stderr.trim() }
    };
  }

  /**
   * 获取服务状态
   */
  async getServiceStatus(): Promise<ServiceStatus[]> {
    try {
      const { stdout } = await execAsync('pm2 jlist');
      const processes = JSON.parse(stdout);

      return processes.map((proc: any) => ({
        name: proc.name,
        status: proc.pm2_env.status,
        uptime: proc.pm2_env.pm_uptime,
        memory: proc.monit.memory,
        cpu: proc.monit.cpu,
        restarts: proc.pm2_env.restart_time,
        pid: proc.pid,
        instances: proc.pm2_env.instances || 1,
        exec_mode: proc.pm2_env.exec_mode
      }));
    } catch (error) {
      logger.error('获取服务状态失败', { error: error.message });
      throw new Error(`获取服务状态失败: ${error.message}`);
    }
  }

  /**
   * 获取系统指标
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      // 并行执行所有系统命令以提高性能
      const [cpuInfo, memInfo, diskInfo, networkInfo, loadInfo] = await Promise.all([
        execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | awk -F'%' '{print $1}'").catch(() => ({ stdout: '0' })),
        execAsync("free -m | grep Mem | awk '{printf \"{\\\"total\\\":%s,\\\"used\\\":%s,\\\"free\\\":%s,\\\"percentage\\\":%.1f}\", $2, $3, $4, $3/$2*100}'").catch(() => ({ stdout: '{"total":0,"used":0,"free":0,"percentage":0}' })),
        execAsync("df -h / | awk 'NR==2{printf \"{\\\"total\\\":\\\"%s\\\",\\\"used\\\":\\\"%s\\\",\\\"available\\\":\\\"%s\\\",\\\"percentage\\\":\\\"%s\\\"}\", $2, $3, $4, $5}'").catch(() => ({ stdout: '{"total":"0","used":"0","available":"0","percentage":"0%"}' })),
        execAsync("cat /proc/net/dev | grep -E '(eth0|ens|enp)' | head -1 | awk '{printf \"{\\\"bytesReceived\\\":%s,\\\"bytesSent\\\":%s}\", $2, $10}'").catch(() => ({ stdout: '{"bytesReceived":0,"bytesSent":0}' })),
        execAsync("uptime | awk -F'load average:' '{print $2}' | awk '{printf \"{\\\"1min\\\":%s,\\\"5min\\\":%s,\\\"15min\\\":%s}\", $1, $2, $3}'").catch(() => ({ stdout: '{"1min":0,"5min":0,"15min":0}' }))
      ]);

      return {
        cpu: {
          usage: parseFloat(cpuInfo.stdout.trim()) || 0,
          cores: require('os').cpus().length
        },
        memory: JSON.parse(memInfo.stdout || '{"total":0,"used":0,"free":0,"percentage":0}'),
        disk: JSON.parse(diskInfo.stdout || '{"total":"0","used":"0","available":"0","percentage":"0%"}'),
        network: JSON.parse(networkInfo.stdout || '{"bytesReceived":0,"bytesSent":0}'),
        load: JSON.parse(loadInfo.stdout || '{"1min":0,"5min":0,"15min":0}'),
        uptime: require('os').uptime(),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('获取系统指标失败', { error: error.message });
      throw new Error(`获取系统指标失败: ${error.message}`);
    }
  }

  /**
   * 获取PM2日志
   */
  async getPM2Logs(service?: string, lines: number = 100): Promise<string> {
    try {
      let command: string;
      if (service) {
        command = `pm2 logs ${service} --lines ${lines} --nostream`;
      } else {
        command = `pm2 logs --lines ${lines} --nostream`;
      }

      const { stdout } = await execAsync(command);
      return stdout;
    } catch (error) {
      logger.error('获取PM2日志失败', { error: error.message, service, lines });
      throw new Error(`获取PM2日志失败: ${error.message}`);
    }
  }

  /**
   * 获取日志文件列表
   */
  async getLogFiles(): Promise<LogFile[]> {
    try {
      // 检查日志目录是否存在
      await access(this.logsDir);
      
      const files = await readdir(this.logsDir);
      const logFiles: LogFile[] = [];

      for (const file of files) {
        try {
          const filePath = join(this.logsDir, file);
          const stats = await stat(filePath);

          if (stats.isFile() && file.endsWith('.log')) {
            logFiles.push({
              name: file,
              size: stats.size,
              modified: stats.mtime,
              path: `/api/management/logs/download/${encodeURIComponent(file)}`
            });
          }
        } catch (err) {
          // 忽略无法访问的文件
          continue;
        }
      }

      return logFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime());
    } catch (error) {
      logger.error('获取日志文件列表失败', { error: error.message });
      throw new Error(`获取日志文件列表失败: ${error.message}`);
    }
  }

  /**
   * 读取日志文件内容
   */
  async readLogFile(filename: string, lines: number = 100): Promise<string> {
    // 安全检查
    if (!filename.endsWith('.log') || filename.includes('..') || filename.includes('/')) {
      throw new Error('无效的文件名');
    }

    try {
      const filePath = join(this.logsDir, filename);
      
      // 检查文件是否存在
      await access(filePath);
      
      // 使用tail命令获取最后N行
      const { stdout } = await execAsync(`tail -n ${lines} "${filePath}"`);
      return stdout;
    } catch (error) {
      logger.error('读取日志文件失败', { error: error.message, filename, lines });
      throw new Error(`读取日志文件失败: ${error.message}`);
    }
  }

  /**
   * 下载日志文件
   */
  async downloadLogFile(filename: string): Promise<string> {
    // 安全检查
    if (!filename.endsWith('.log') || filename.includes('..') || filename.includes('/')) {
      throw new Error('无效的文件名');
    }

    try {
      const filePath = join(this.logsDir, filename);
      
      // 检查文件是否存在
      await access(filePath);
      
      // 读取文件内容
      const content = await readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      logger.error('下载日志文件失败', { error: error.message, filename });
      throw new Error(`下载日志文件失败: ${error.message}`);
    }
  }

  /**
   * 清理日志文件
   */
  async cleanupLogs(days: number = 7): Promise<OperationResult> {
    try {
      // 清理超过指定天数的日志文件
      const command = `find ${this.logsDir} -name "*.log" -mtime +${days} -delete`;
      const { stdout, stderr } = await execAsync(command);

      // 清理PM2日志
      await execAsync('pm2 flush');

      logger.info('日志文件清理成功', { days });

      return {
        success: true,
        message: `已清理超过 ${days} 天的日志文件`,
        timestamp: new Date().toISOString(),
        details: { stdout: stdout.trim(), stderr: stderr.trim() }
      };
    } catch (error) {
      logger.error('清理日志文件失败', { error: error.message, days });
      throw new Error(`清理日志文件失败: ${error.message}`);
    }
  }

  /**
   * 部署应用（为未来扩展预留）
   */
  async deployApplication(version?: string, branch: string = 'main'): Promise<DeploymentResult> {
    try {
      logger.info('开始部署应用', { version, branch });

      // 这里可以集成现有的部署脚本
      const deployScript = join(process.cwd(), '../scripts/deploy.sh');
      const command = `bash ${deployScript}`;
      
      const { stdout, stderr } = await execAsync(command);

      logger.info('应用部署成功', { version, branch });

      return {
        success: true,
        message: `应用部署成功`,
        timestamp: new Date().toISOString(),
        version: version || 'latest',
        details: { stdout: stdout.trim(), stderr: stderr.trim() }
      };
    } catch (error) {
      logger.error('应用部署失败', { error: error.message, version, branch });
      throw new Error(`应用部署失败: ${error.message}`);
    }
  }
}