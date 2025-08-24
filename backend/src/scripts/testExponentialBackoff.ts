#!/usr/bin/env node

/**
 * 指数退避重试策略验证脚本
 * 
 * 此脚本专门测试数据库连接的指数退避重试机制
 */

import { connectDB, getConnectionStatus } from '../config/mongodb';
import { logger } from '../config/logger';
import mongoose from 'mongoose';

// 测试配置
const TEST_CONFIG = {
  // 使用无效的MongoDB URL来触发重试机制
  invalidMongoUrl: 'mongodb://invalid-host:27017/test-retry',
  // 测试持续时间（毫秒）
  testDuration: 30000, // 30秒
  // 状态检查间隔（毫秒）
  statusCheckInterval: 2000, // 2秒
};

class ExponentialBackoffTester {
  private testStartTime: number = 0;
  private statusCheckTimer: NodeJS.Timeout | null = null;
  private retryAttempts: Array<{
    attempt: number;
    timestamp: number;
    delay: number;
  }> = [];

  /**
   * 开始测试指数退避重试
   */
  async startTest(): Promise<void> {
    console.log('🧪 开始指数退避重试策略测试');
    console.log(`测试配置:`, TEST_CONFIG);
    console.log('=' .repeat(60));

    this.testStartTime = Date.now();

    // 临时修改环境变量来触发重试
    const originalUrl = process.env.MONGODB_URL;
    process.env.MONGODB_URL = TEST_CONFIG.invalidMongoUrl;

    console.log('📡 使用无效URL触发重试机制...');
    console.log(`无效URL: ${TEST_CONFIG.invalidMongoUrl}`);

    // 开始监控重试过程
    this.startRetryMonitoring();

    try {
      // 这将触发重试机制
      await connectDB();
    } catch (error) {
      console.log('⚠️  预期的连接失败，重试机制已触发');
    }

    // 等待测试完成
    await this.waitForTestCompletion();

    // 恢复原始URL
    process.env.MONGODB_URL = originalUrl;
  }

  /**
   * 监控重试过程
   */
  private startRetryMonitoring(): void {
    let lastAttemptCount = 0;
    let lastAttemptTime = this.testStartTime;

    this.statusCheckTimer = setInterval(() => {
      const elapsed = Date.now() - this.testStartTime;
      
      if (elapsed >= TEST_CONFIG.testDuration) {
        this.stopTest();
        return;
      }

      const status = getConnectionStatus();
      const currentAttempts = status.reconnectAttempts;

      // 检测到新的重试尝试
      if (currentAttempts > lastAttemptCount) {
        const currentTime = Date.now();
        const delay = currentTime - lastAttemptTime;

        this.retryAttempts.push({
          attempt: currentAttempts,
          timestamp: elapsed,
          delay: delay
        });

        console.log(`[${this.formatTime(elapsed)}] 重试尝试 #${currentAttempts}:`);
        console.log(`  延迟时间: ${delay}ms`);
        console.log(`  连接状态: ${status.state}`);
        console.log(`  正在连接: ${status.isConnecting ? '是' : '否'}`);
        console.log('-'.repeat(40));

        lastAttemptCount = currentAttempts;
        lastAttemptTime = currentTime;
      }
    }, TEST_CONFIG.statusCheckInterval);
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
    console.log('🏁 指数退避测试完成');
    
    // 清理定时器
    if (this.statusCheckTimer) {
      clearInterval(this.statusCheckTimer);
      this.statusCheckTimer = null;
    }

    // 生成测试报告
    this.generateBackoffReport();
    
    // 退出进程
    process.exit(0);
  }

  /**
   * 生成指数退避测试报告
   */
  private generateBackoffReport(): void {
    console.log('\n📊 指数退避重试策略分析');
    console.log('=' .repeat(60));
    
    if (this.retryAttempts.length === 0) {
      console.log('⚠️  未检测到重试尝试，可能连接立即成功或失败');
      return;
    }

    console.log(`总重试次数: ${this.retryAttempts.length}`);
    
    // 分析延迟时间模式
    console.log('\n重试延迟分析:');
    this.retryAttempts.forEach((attempt, index) => {
      if (index > 0) {
        const expectedDelay = this.calculateExpectedDelay(attempt.attempt - 1);
        const actualDelay = attempt.delay;
        const deviation = Math.abs(actualDelay - expectedDelay);
        const deviationPercent = (deviation / expectedDelay) * 100;

        console.log(`  尝试 #${attempt.attempt}:`);
        console.log(`    实际延迟: ${actualDelay}ms`);
        console.log(`    预期延迟: ${expectedDelay}ms`);
        console.log(`    偏差: ${deviation}ms (${deviationPercent.toFixed(2)}%)`);
        console.log(`    时间点: ${this.formatTime(attempt.timestamp)}`);
      }
    });

    // 验证指数退避模式
    console.log('\n📈 指数退避模式验证:');
    let isExponential = true;
    
    for (let i = 1; i < this.retryAttempts.length; i++) {
      const current = this.retryAttempts[i];
      const previous = this.retryAttempts[i - 1];
      
      if (current.delay <= previous.delay) {
        isExponential = false;
        console.log(`❌ 延迟时间未递增: 尝试 #${previous.attempt} (${previous.delay}ms) -> 尝试 #${current.attempt} (${current.delay}ms)`);
      }
    }

    if (isExponential && this.retryAttempts.length > 1) {
      console.log('✅ 指数退避模式验证通过：延迟时间呈递增趋势');
    } else if (this.retryAttempts.length <= 1) {
      console.log('⚠️  重试次数不足，无法验证指数退避模式');
    }

    // 配置参数验证
    console.log('\n⚙️  配置参数验证:');
    console.log('  初始延迟: 1000ms');
    console.log('  最大延迟: 30000ms');
    console.log('  退避倍数: 2');
    console.log('  最大重试次数: 10');

    const maxDelay = Math.max(...this.retryAttempts.map(a => a.delay));
    console.log(`  实际最大延迟: ${maxDelay}ms`);
    
    if (maxDelay <= 30000) {
      console.log('✅ 最大延迟限制验证通过');
    } else {
      console.log('❌ 最大延迟超出配置限制');
    }
  }

  /**
   * 计算预期的指数退避延迟
   */
  private calculateExpectedDelay(attempt: number): number {
    const initialDelay = 1000;
    const maxDelay = 30000;
    const backoffMultiplier = 2;
    
    const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
    return Math.min(delay, maxDelay);
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
  const tester = new ExponentialBackoffTester();
  
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

export { ExponentialBackoffTester };