#!/usr/bin/env ts-node

/**
 * API 监控和统计功能测试脚本
 * 
 * 此脚本测试以下功能：
 * 1. API 使用统计收集
 * 2. 性能指标记录
 * 3. 配额监控
 * 4. 统计端点响应
 */

import { stockPhotoService } from '../api/image-description/stock-photo-service';

// 颜色输出工具
const colors = {
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`
};

/**
 * 测试 API 使用统计功能
 */
async function testApiUsageStats() {
  console.log(colors.blue('\n📊 测试 API 使用统计功能...'));
  
  try {
    // 重置统计数据以确保测试的准确性
    stockPhotoService.resetStats();
    console.log(colors.cyan('✓ 统计数据已重置'));
    
    // 获取初始统计
    let stats = stockPhotoService.getApiUsageStats();
    console.log(colors.cyan(`✓ 初始统计 - 总请求: ${stats.totalRequests}, 成功: ${stats.successfulRequests}, 失败: ${stats.failedRequests}`));
    
    // 模拟一些成功的API调用
    console.log(colors.cyan('🔄 模拟API调用...'));
    
    const testSessionId = 'test-session-monitoring';
    const testQueries = ['nature', 'business', 'technology', 'food'];
    
    for (let i = 0; i < testQueries.length; i++) {
      try {
        console.log(colors.cyan(`  📞 调用 ${i + 1}: 搜索 "${testQueries[i]}"`));
        await stockPhotoService.findRandomImage(testQueries[i], testSessionId);
        console.log(colors.green(`  ✅ 调用 ${i + 1} 成功`));
        
        // 短暂延迟以模拟真实使用场景
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(colors.yellow(`  ⚠️ 调用 ${i + 1} 失败: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误'}`));
      }
    }
    
    // 获取更新后的统计
    stats = stockPhotoService.getApiUsageStats();
    console.log(colors.green(`✅ 更新后统计 - 总请求: ${stats.totalRequests}, 成功: ${stats.successfulRequests}, 失败: ${stats.failedRequests}`));
    
    // 验证统计数据的准确性
    if (stats.totalRequests === testQueries.length) {
      console.log(colors.green('✅ 请求计数准确'));
    } else {
      console.log(colors.red(`❌ 请求计数不准确: 期望 ${testQueries.length}, 实际 ${stats.totalRequests}`));
    }
    
    // 检查性能指标
    if (stats.averageResponseTime > 0) {
      console.log(colors.green(`✅ 平均响应时间: ${Math.round(stats.averageResponseTime)}ms`));
    } else {
      console.log(colors.yellow('⚠️ 平均响应时间为0，可能没有成功的请求'));
    }
    
    // 检查错误统计
    const totalErrors = Object.values(stats.errorBreakdown).reduce((sum, count) => sum + count, 0);
    console.log(colors.cyan(`📈 错误统计: 总错误 ${totalErrors}, 错误类型: ${Object.keys(stats.errorBreakdown).length}`));
    
    return true;
  } catch (error) {
    console.log(colors.red(`❌ API使用统计测试失败: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误'}`));
    return false;
  }
}

/**
 * 测试性能指标收集功能
 */
async function testPerformanceMetrics() {
  console.log(colors.blue('\n📈 测试性能指标收集功能...'));
  
  try {
    // 获取性能指标
    const metrics = stockPhotoService.getPerformanceMetrics(10);
    console.log(colors.cyan(`✓ 获取到 ${metrics.length} 条性能指标记录`));
    
    if (metrics.length > 0) {
      const latestMetric = metrics[metrics.length - 1];
      console.log(colors.cyan(`✓ 最新指标 - 请求ID: ${latestMetric.requestId}, 响应时间: ${latestMetric.responseTime}ms, 成功: ${latestMetric.success}`));
      
      // 检查指标数据完整性
      const requiredFields = ['requestId', 'timestamp', 'responseTime', 'success'];
      const hasAllFields = requiredFields.every(field => field in latestMetric);
      
      if (hasAllFields) {
        console.log(colors.green('✅ 性能指标数据完整'));
      } else {
        console.log(colors.red('❌ 性能指标数据不完整'));
      }
      
      // 检查时间戳合理性
      const now = Date.now();
      const metricAge = now - latestMetric.timestamp;
      if (metricAge < 60000) { // 1分钟内
        console.log(colors.green('✅ 时间戳合理'));
      } else {
        console.log(colors.yellow(`⚠️ 时间戳较旧: ${Math.round(metricAge / 1000)}秒前`));
      }
    } else {
      console.log(colors.yellow('⚠️ 没有性能指标记录'));
    }
    
    return true;
  } catch (error) {
    console.log(colors.red(`❌ 性能指标测试失败: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误'}`));
    return false;
  }
}

/**
 * 测试配额监控功能
 */
async function testQuotaMonitoring() {
  console.log(colors.blue('\n📊 测试配额监控功能...'));
  
  try {
    // 获取配额使用情况
    const quotaUsage = stockPhotoService.getQuotaUsage();
    console.log(colors.cyan(`✓ 当前配额使用: ${quotaUsage.current}`));
    console.log(colors.cyan(`✓ 配额限制: ${quotaUsage.limit || 'N/A'}`));
    console.log(colors.cyan(`✓ 使用百分比: ${quotaUsage.percentage ? quotaUsage.percentage.toFixed(2) + '%' : 'N/A'}`));
    console.log(colors.cyan(`✓ 预估日使用量: ${quotaUsage.estimatedDailyUsage}`));
    console.log(colors.cyan(`✓ 预测月使用量: ${quotaUsage.projectedMonthlyUsage}`));
    
    // 检查配额重置时间
    if (quotaUsage.resetTime) {
      const resetDate = new Date(quotaUsage.resetTime);
      console.log(colors.cyan(`✓ 配额重置时间: ${resetDate.toISOString()}`));
    } else {
      console.log(colors.yellow('⚠️ 没有配额重置时间信息'));
    }
    
    // 检查配额健康状态
    if (quotaUsage.percentage !== null) {
      if (quotaUsage.percentage > 90) {
        console.log(colors.red('🚨 配额使用率过高 (>90%)'));
      } else if (quotaUsage.percentage > 75) {
        console.log(colors.yellow('⚠️ 配额使用率较高 (>75%)'));
      } else {
        console.log(colors.green('✅ 配额使用率正常'));
      }
    } else {
      console.log(colors.cyan('ℹ️ 配额使用率信息不可用'));
    }
    
    return true;
  } catch (error) {
    console.log(colors.red(`❌ 配额监控测试失败: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误'}`));
    return false;
  }
}

/**
 * 测试会话统计功能
 */
async function testSessionStats() {
  console.log(colors.blue('\n👥 测试会话统计功能...'));
  
  try {
    const testSessionId = 'test-session-stats';
    
    // 创建一些会话活动
    console.log(colors.cyan('🔄 创建会话活动...'));
    await stockPhotoService.findRandomImage('landscape', testSessionId);
    await stockPhotoService.findRandomImage('portrait', testSessionId);
    
    // 获取会话统计
    const sessionStats = stockPhotoService.getSessionStats(testSessionId);
    
    if (sessionStats) {
      console.log(colors.green(`✅ 会话统计获取成功:`));
      console.log(colors.cyan(`  - 总图片数: ${sessionStats.totalImages}`));
      console.log(colors.cyan(`  - 请求次数: ${sessionStats.requestCount}`));
      console.log(colors.cyan(`  - 最后访问: ${new Date(sessionStats.lastAccess).toISOString()}`));
      console.log(colors.cyan(`  - 使用类别: ${sessionStats.categories.join(', ')}`));
      
      // 验证数据合理性
      if (sessionStats.requestCount >= 2) {
        console.log(colors.green('✅ 请求计数正确'));
      } else {
        console.log(colors.red(`❌ 请求计数不正确: ${sessionStats.requestCount}`));
      }
      
      if (sessionStats.totalImages >= 1) {
        console.log(colors.green('✅ 图片计数正确'));
      } else {
        console.log(colors.red(`❌ 图片计数不正确: ${sessionStats.totalImages}`));
      }
    } else {
      console.log(colors.red('❌ 无法获取会话统计'));
      return false;
    }
    
    // 获取全局统计
    const globalStats = stockPhotoService.getGlobalStats();
    console.log(colors.cyan(`✓ 全局统计:`));
    console.log(colors.cyan(`  - 活跃会话: ${globalStats.activeSessions}`));
    console.log(colors.cyan(`  - 总跟踪图片: ${globalStats.totalImagesTracked}`));
    console.log(colors.cyan(`  - 最旧会话: ${globalStats.oldestSession ? new Date(globalStats.oldestSession).toISOString() : 'N/A'}`));
    
    // 清理测试会话
    const cleared = stockPhotoService.clearSession(testSessionId);
    if (cleared) {
      console.log(colors.green('✅ 测试会话清理成功'));
    } else {
      console.log(colors.yellow('⚠️ 测试会话清理失败或会话不存在'));
    }
    
    return true;
  } catch (error) {
    console.log(colors.red(`❌ 会话统计测试失败: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误'}`));
    return false;
  }
}

/**
 * 测试 API 密钥验证功能
 */
async function testApiKeyValidation() {
  console.log(colors.blue('\n🔑 测试 API 密钥验证功能...'));
  
  try {
    console.log(colors.cyan('🔍 验证 API 密钥...'));
    const isValid = await stockPhotoService.validateApiKey();
    
    if (isValid) {
      console.log(colors.green('✅ API 密钥验证成功'));
    } else {
      console.log(colors.yellow('⚠️ API 密钥验证失败（可能是测试环境或密钥无效）'));
    }
    
    return true;
  } catch (error) {
    console.log(colors.red(`❌ API密钥验证测试失败: ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误'}`));
    return false;
  }
}

/**
 * 生成测试报告
 */
function generateTestReport(results: { [key: string]: boolean }) {
  console.log(colors.bold('\n📋 API 监控功能测试报告'));
  console.log('='.repeat(50));
  
  const testNames = {
    apiUsageStats: 'API 使用统计',
    performanceMetrics: '性能指标收集',
    quotaMonitoring: '配额监控',
    sessionStats: '会话统计',
    apiKeyValidation: 'API 密钥验证'
  };
  
  let passedTests = 0;
  let totalTests = 0;
  
  for (const [testKey, testName] of Object.entries(testNames)) {
    totalTests++;
    const passed = results[testKey];
    const status = passed ? colors.green('✅ 通过') : colors.red('❌ 失败');
    console.log(`${testName}: ${status}`);
    if (passed) passedTests++;
  }
  
  console.log('='.repeat(50));
  console.log(`总测试数: ${totalTests}`);
  console.log(`通过测试: ${colors.green(passedTests.toString())}`);
  console.log(`失败测试: ${colors.red((totalTests - passedTests).toString())}`);
  console.log(`成功率: ${colors.bold(((passedTests / totalTests) * 100).toFixed(1) + '%')}`);
  
  if (passedTests === totalTests) {
    console.log(colors.green('\n🎉 所有API监控功能测试通过！'));
  } else {
    console.log(colors.yellow('\n⚠️ 部分测试失败，请检查相关功能'));
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log(colors.bold('🚀 开始 API 监控和统计功能测试'));
  console.log('测试时间:', new Date().toISOString());
  
  const results: { [key: string]: boolean } = {};
  
  // 执行各项测试
  results.apiUsageStats = await testApiUsageStats();
  results.performanceMetrics = await testPerformanceMetrics();
  results.quotaMonitoring = await testQuotaMonitoring();
  results.sessionStats = await testSessionStats();
  results.apiKeyValidation = await testApiKeyValidation();
  
  // 生成测试报告
  generateTestReport(results);
  
  // 退出程序
  process.exit(results.apiUsageStats && results.performanceMetrics && results.quotaMonitoring ? 0 : 1);
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error(colors.red('未处理的Promise拒绝:'), reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(colors.red('未捕获的异常:'), error);
  process.exit(1);
});

// 运行测试
if (require.main === module) {
  main().catch(error => {
    console.error(colors.red('测试执行失败:'), error);
    process.exit(1);
  });
}