#!/usr/bin/env node

/**
 * 数据库连接重试机制测试脚本
 * 
 * 此脚本用于测试数据库连接的重试机制、指数退避策略和自动重连功能
 */

import { connectDB, checkDatabaseHealth, getConnectionStatus } from '../config/mongodb';
import { logger } from '../config/logger';
import mongoose from 'mongoose';

// 测试配置
const TEST_CONFIG = {
  // 测试持续时间（毫秒）
  testDuration: 60000, // 1分钟
  // 状态检查间隔（毫秒）
  statusCheckInterval: 5000, // 5秒
  // 是否模拟连接中断
  simulateDisconnection: true,
  // 连接中断延迟（毫秒）
  disconnectionDelay: 20000, // 20秒后模拟断开
};

class DatabaseRetryTester {
  private testStartTime: number = 0;
  private statusCheckTimer: NodeJS.Timeout | null = null;
  private disconnectionTimer: NodeJS.Timeout | null = null;
  private testResults: Array<{
    timestamp: number;
    status: any;
    health: any;
  }> = [];

  /**
   * 开始测试
   */
  async startTest(): Promise<void> {
    console.log('🚀 开始数据库连接重试机制测试');
    console.log(`测试配置:`, TEST_CONFIG);
    console.log('=' .repeat(60));

    this.testStartTime = Date.now();

    // 开始定期状态检查
    this.startStatusMonitoring();

    // 如果启用了连接中断模拟，设置定时器
    if (TEST_CONFIG.simulateDisconnection) {
      this.scheduleDisconnectionTest();
    }

    try {
      // 尝试连接数据库
      console.log('📡 尝试连接数据库...');
      await connectDB();
      console.log('✅ 数据库连接成功');
    } catch (error) {
      console.error('❌ 数据库连接失败:', error);
    }

    // 等待测试完成
    await this.waitForTestCompletion();
  }

  /**
   * 开始状态监控
   */
  private startStatusMonitoring(): void {
    this.statusCheckTimer = setInterval(async () => {
      const elapsed = Date.now() - this.testStartTime;
      
      if (elapsed >= TEST_CONFIG.testDuration) {
        this.stopTest();
        return;
      }

      await this.checkAndLogStatus();
    }, TEST_CONFIG.statusCheckInterval);
  }

  /**
   * 检查并记录状态
   */
  private async checkAndLogStatus(): Promise<void> {
    try {
      const status = getConnectionStatus();
      const health = await checkDatabaseHealth();
      const elapsed = Date.now() - this.testStartTime;

      // 记录测试结果
      this.testResults.push({
        timestamp: elapsed,
        status,
        health
      });

      // 输出状态信息
      console.log(`[${this.formatTime(elapsed)}] 状态检查:`);
      console.log(`  连接状态: ${status.state}`);
      console.log(`  健康状态: ${health.healthy ? '健康' : '不健康'}`);
      console.log(`  重连次数: ${status.reconnectAttempts}`);
      console.log(`  正在连接: ${status.isConnecting ? '是' : '否'}`);
      
      if (!health.healthy && health.details.error) {
        console.log(`  错误信息: ${health.details.error}`);
      }
      
      console.log('-'.repeat(40));
    } catch (error) {
      console.error('状态检查失败:', error);
    }
  }

  /**
   * 安排连接中断测试
   */
  private scheduleDisconnectionTest(): void {
    this.disconnectionTimer = setTimeout(async () => {
      console.log('🔌 模拟数据库连接中断...');
      
      try {
        // 强制关闭连接来模拟网络中断
        await mongoose.connection.close();
        console.log('⚠️  数据库连接已断开，等待自动重连...');
      } catch (error) {
        console.error('断开连接时出错:', error);
      }
    }, TEST_CONFIG.disconnectionDelay);
  }

  /**
   * 等待测试完成
   */
  private async waitForTestCompletion(): Promise<void> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        const elapsed = Date.now() - this.testStartTime;
        if (elapsed >= TEST_CONFIG.testDuration) {
          this.stopTest();
          resolve();
        } else {
          setTimeout(checkCompletion, 1000);
        }
      };
      
      checkCompletion();
    });
  }

  /**
   * 停止测试
   */
  private stopTest(): void {
    console.log('🏁 测试完成');
    
    // 清理定时器
    if (this.statusCheckTimer) {
      clearInterval(this.statusCheckTimer);
      this.statusCheckTimer = null;
    }
    
    if (this.disconnectionTimer) {
      clearTimeout(this.disconnectionTimer);
      this.disconnectionTimer = null;
    }

    // 生成测试报告
    this.generateTestReport();
    
    // 退出进程
    process.exit(0);
  }

  /**
   * 生成测试报告
   */
  private generateTestReport(): void {
    console.log('\n📊 测试报告');
    console.log('=' .repeat(60));
    
    const totalChecks = this.testResults.length;
    const healthyChecks = this.testResults.filter(r => r.health.healthy).length;
    const unhealthyChecks = totalChecks - healthyChecks;
    
    console.log(`总检查次数: ${totalChecks}`);
    console.log(`健康检查次数: ${healthyChecks}`);
    console.log(`不健康检查次数: ${unhealthyChecks}`);
    console.log(`健康率: ${totalChecks > 0 ? ((healthyChecks / totalChecks) * 100).toFixed(2) : 0}%`);
    
    // 连接状态统计
    const stateStats = this.testResults.reduce((acc, result) => {
      const state = result.status.state;
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n连接状态分布:');
    Object.entries(stateStats).forEach(([state, count]) => {
      const percentage = ((count / totalChecks) * 100).toFixed(2);
      console.log(`  ${state}: ${count} 次 (${percentage}%)`);
    });
    
    // 重连统计
    const maxReconnectAttempts = Math.max(...this.testResults.map(r => r.status.reconnectAttempts));
    console.log(`\n最大重连尝试次数: ${maxReconnectAttempts}`);
    
    // 错误统计
    const errors = this.testResults
      .filter(r => !r.health.healthy && r.health.details.error)
      .map(r => r.health.details.error);
    
    if (errors.length > 0) {
      console.log('\n遇到的错误:');
      const errorCounts = errors.reduce((acc, error) => {
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`  ${error}: ${count} 次`);
      });
    }
    
    // 性能指标
    if (TEST_CONFIG.simulateDisconnection && maxReconnectAttempts > 0) {
      console.log('\n🔄 重连机制测试结果:');
      console.log(`✅ 重连机制已激活 (最大尝试次数: ${maxReconnectAttempts})`);
      
      // 查找重连成功的时间点
      const reconnectSuccess = this.testResults.find((result, index) => {
        if (index === 0) return false;
        const prevResult = this.testResults[index - 1];
        return !prevResult.health.healthy && result.health.healthy;
      });
      
      if (reconnectSuccess) {
        console.log(`✅ 重连成功时间: ${this.formatTime(reconnectSuccess.timestamp)}`);
      }
    }
    
    console.log('\n测试详细数据已保存到内存中，可通过日志查看完整记录。');
  }

  /**
   * 格式化时间显示
   */
  private formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${remainingSeconds}s`;
    }
  }
}

// 主函数
async function main(): Promise<void> {
  const tester = new DatabaseRetryTester();
  
  // 处理进程退出信号
  process.on('SIGINT', () => {
    console.log('\n⚠️  收到中断信号，正在停止测试...');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n⚠️  收到终止信号，正在停止测试...');
    process.exit(0);
  });
  
  try {
    await tester.startTest();
  } catch (error) {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本，则执行主函数
if (require.main === module) {
  main().catch(error => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });
}

export { DatabaseRetryTester };