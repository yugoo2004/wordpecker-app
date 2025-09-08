#!/usr/bin/env node

/**
 * 数据库连接池配置验证脚本
 * 
 * 此脚本用于验证MongoDB连接池的配置和性能
 */

import { connectDB, checkDatabaseHealth, getConnectionStatus } from '../config/mongodb';
import { logger } from '../config/logger';
import mongoose from 'mongoose';

// 测试配置
const TEST_CONFIG = {
  // 并发连接数
  concurrentConnections: 20,
  // 每个连接的操作次数
  operationsPerConnection: 5,
  // 操作间隔（毫秒）
  operationInterval: 100,
  // 测试持续时间（毫秒）
  testDuration: 30000, // 30秒
};

interface ConnectionPoolStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  connectionPoolSize: number;
  activeConnections: number;
  errors: string[];
}

class ConnectionPoolTester {
  private stats: ConnectionPoolStats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageResponseTime: 0,
    maxResponseTime: 0,
    minResponseTime: Infinity,
    connectionPoolSize: 0,
    activeConnections: 0,
    errors: []
  };

  private responseTimes: number[] = [];
  private testStartTime: number = 0;

  /**
   * 开始连接池测试
   */
  async startTest(): Promise<void> {
    console.log('🏊 开始数据库连接池配置验证测试');
    console.log(`测试配置:`, TEST_CONFIG);
    console.log('=' .repeat(60));

    this.testStartTime = Date.now();

    try {
      // 确保数据库连接
      console.log('📡 建立数据库连接...');
      await connectDB();
      console.log('✅ 数据库连接成功');

      // 获取连接池信息
      await this.getConnectionPoolInfo();

      // 运行并发操作测试
      console.log('\n🚀 开始并发操作测试...');
      await this.runConcurrentOperations();

      // 生成测试报告
      this.generatePoolReport();

    } catch (error) {
      console.error('❌ 连接池测试失败:', error);
      process.exit(1);
    }
  }

  /**
   * 获取连接池信息
   */
  private async getConnectionPoolInfo(): Promise<void> {
    try {
      const connection = mongoose.connection;
      
      console.log('\n📊 连接池配置信息:');
      console.log(`  数据库名称: ${connection.name}`);
      console.log(`  主机地址: ${connection.host}:${connection.port}`);
      console.log(`  连接状态: ${this.getConnectionStateText(connection.readyState)}`);
      
      // 获取连接池配置（从mongoose配置中）
      console.log(`  最大连接池大小: 15 (配置值)`);
      console.log(`  最小连接池大小: 3 (配置值)`);
      console.log(`  最大空闲时间: 30000ms (配置值)`);
      console.log(`  连接超时: 10000ms (配置值)`);
      console.log(`  Socket超时: 45000ms (配置值)`);
      console.log(`  心跳频率: 10000ms (配置值)`);

      // 尝试获取连接池统计信息
      if (connection.db) {
        const admin = connection.db.admin();
        try {
          const serverStatus = await admin.serverStatus();
          if (serverStatus.connections) {
            console.log(`  当前连接数: ${serverStatus.connections.current}`);
            console.log(`  可用连接数: ${serverStatus.connections.available}`);
            console.log(`  总连接数: ${serverStatus.connections.totalCreated}`);
          }
        } catch (error) {
          console.log('  ⚠️  无法获取服务器连接统计信息');
        }
      }

    } catch (error) {
      console.error('获取连接池信息失败:', error);
    }
  }

  /**
   * 运行并发操作测试
   */
  private async runConcurrentOperations(): Promise<void> {
    const promises: Promise<void>[] = [];

    // 创建并发操作
    for (let i = 0; i < TEST_CONFIG.concurrentConnections; i++) {
      promises.push(this.runConnectionOperations(i));
    }

    // 等待所有操作完成
    await Promise.all(promises);
  }

  /**
   * 运行单个连接的操作
   */
  private async runConnectionOperations(connectionId: number): Promise<void> {
    for (let i = 0; i < TEST_CONFIG.operationsPerConnection; i++) {
      try {
        const startTime = Date.now();
        
        // 执行数据库操作（健康检查）
        const health = await checkDatabaseHealth();
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        this.recordOperation(true, responseTime);

        if (!health.healthy) {
          this.stats.errors.push(`Connection ${connectionId}, Operation ${i}: Database unhealthy`);
        }

        // 操作间隔
        if (i < TEST_CONFIG.operationsPerConnection - 1) {
          await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.operationInterval));
        }

      } catch (error) {
        this.recordOperation(false, 0);
        this.stats.errors.push(`Connection ${connectionId}, Operation ${i}: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error)}`);
      }
    }
  }

  /**
   * 记录操作结果
   */
  private recordOperation(success: boolean, responseTime: number): void {
    this.stats.totalOperations++;
    
    if (success) {
      this.stats.successfulOperations++;
      this.responseTimes.push(responseTime);
      
      // 更新响应时间统计
      this.stats.maxResponseTime = Math.max(this.stats.maxResponseTime, responseTime);
      this.stats.minResponseTime = Math.min(this.stats.minResponseTime, responseTime);
    } else {
      this.stats.failedOperations++;
    }
  }

  /**
   * 生成连接池测试报告
   */
  private generatePoolReport(): void {
    console.log('\n📊 连接池性能测试报告');
    console.log('=' .repeat(60));

    // 计算平均响应时间
    if (this.responseTimes.length > 0) {
      this.stats.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;
    }

    // 基本统计
    console.log('📈 操作统计:');
    console.log(`  总操作数: ${this.stats.totalOperations}`);
    console.log(`  成功操作: ${this.stats.successfulOperations}`);
    console.log(`  失败操作: ${this.stats.failedOperations}`);
    console.log(`  成功率: ${((this.stats.successfulOperations / this.stats.totalOperations) * 100).toFixed(2)}%`);

    // 性能统计
    console.log('\n⚡ 性能指标:');
    console.log(`  平均响应时间: ${this.stats.averageResponseTime.toFixed(2)}ms`);
    console.log(`  最大响应时间: ${this.stats.maxResponseTime}ms`);
    console.log(`  最小响应时间: ${this.stats.minResponseTime === Infinity ? 'N/A' : this.stats.minResponseTime}ms`);

    // 响应时间分布
    if (this.responseTimes.length > 0) {
      console.log('\n📊 响应时间分布:');
      const sorted = this.responseTimes.sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p90 = sorted[Math.floor(sorted.length * 0.9)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      console.log(`  P50 (中位数): ${p50}ms`);
      console.log(`  P90: ${p90}ms`);
      console.log(`  P95: ${p95}ms`);
      console.log(`  P99: ${p99}ms`);
    }

    // 并发性能评估
    console.log('\n🏃 并发性能评估:');
    const totalTime = Date.now() - this.testStartTime;
    const operationsPerSecond = (this.stats.totalOperations / totalTime) * 1000;
    console.log(`  测试总时间: ${totalTime}ms`);
    console.log(`  每秒操作数: ${operationsPerSecond.toFixed(2)} ops/sec`);
    console.log(`  并发连接数: ${TEST_CONFIG.concurrentConnections}`);

    // 连接池效率评估
    console.log('\n🔗 连接池效率评估:');
    if (this.stats.averageResponseTime < 100) {
      console.log('✅ 响应时间优秀 (< 100ms)');
    } else if (this.stats.averageResponseTime < 500) {
      console.log('⚠️  响应时间良好 (100-500ms)');
    } else {
      console.log('❌ 响应时间需要优化 (> 500ms)');
    }

    if (this.stats.successfulOperations / this.stats.totalOperations > 0.99) {
      console.log('✅ 连接稳定性优秀 (成功率 > 99%)');
    } else if (this.stats.successfulOperations / this.stats.totalOperations > 0.95) {
      console.log('⚠️  连接稳定性良好 (成功率 > 95%)');
    } else {
      console.log('❌ 连接稳定性需要改进 (成功率 < 95%)');
    }

    // 错误报告
    if (this.stats.errors.length > 0) {
      console.log('\n❌ 错误报告:');
      const errorCounts = this.stats.errors.reduce((acc, error) => {
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Object.entries(errorCounts).forEach(([error, count]) => {
        console.log(`  ${error}: ${count} 次`);
      });
    } else {
      console.log('\n✅ 无错误发生');
    }

    // 优化建议
    console.log('\n💡 优化建议:');
    if (this.stats.averageResponseTime > 200) {
      console.log('  - 考虑增加连接池大小');
      console.log('  - 检查网络延迟');
      console.log('  - 优化数据库查询');
    }
    
    if (this.stats.failedOperations > 0) {
      console.log('  - 检查数据库连接稳定性');
      console.log('  - 增加重试机制');
      console.log('  - 监控数据库服务器状态');
    }

    if (operationsPerSecond < 50) {
      console.log('  - 考虑优化连接池配置');
      console.log('  - 检查数据库服务器性能');
    }
  }

  /**
   * 获取连接状态文本
   */
  private getConnectionStateText(state: number): string {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    return states[state as keyof typeof states] || 'unknown';
  }
}

// 主函数
async function main(): Promise<void> {
  const tester = new ConnectionPoolTester();
  
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

export { ConnectionPoolTester };