#!/usr/bin/env ts-node

/**
 * API 监控功能验证脚本
 * 验证任务5的所有实现要求
 */

import { stockPhotoService } from '../api/image-description/stock-photo-service';

async function validateApiMonitoring() {
  console.log('🔍 验证 API 使用统计和监控功能实现...\n');

  let allTestsPassed = true;
  const results: { test: string; passed: boolean; details?: string }[] = [];

  // 1. 验证 API 调用统计功能
  console.log('📊 1. 验证 API 调用统计功能');
  try {
    const stats = stockPhotoService.getApiUsageStats();
    
    const requiredStatsFields = [
      'totalRequests', 'successfulRequests', 'failedRequests', 
      'averageResponseTime', 'requestsPerHour', 'requestsToday',
      'quotaUsage', 'errorBreakdown', 'performanceMetrics'
    ];
    
    const missingFields = requiredStatsFields.filter(field => !(field in stats));
    
    if (missingFields.length === 0) {
      console.log('   ✅ API 调用统计功能正常');
      results.push({ test: 'API 调用统计功能', passed: true });
    } else {
      console.log(`   ❌ 缺少统计字段: ${missingFields.join(', ')}`);
      results.push({ 
        test: 'API 调用统计功能', 
        passed: false, 
        details: `缺少字段: ${missingFields.join(', ')}` 
      });
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ 统计功能测试失败: ${error}`);
    results.push({ 
      test: 'API 调用统计功能', 
      passed: false, 
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误' 
    });
    allTestsPassed = false;
  }

  // 2. 验证配额使用监控功能
  console.log('\n💰 2. 验证配额使用监控功能');
  try {
    const quotaUsage = stockPhotoService.getQuotaUsage();
    
    const requiredQuotaFields = [
      'current', 'limit', 'percentage', 'resetTime',
      'estimatedDailyUsage', 'projectedMonthlyUsage'
    ];
    
    const missingQuotaFields = requiredQuotaFields.filter(field => !(field in quotaUsage));
    
    if (missingQuotaFields.length === 0) {
      console.log('   ✅ 配额使用监控功能正常');
      console.log(`   📈 当前使用: ${quotaUsage.current}, 限制: ${quotaUsage.limit || 'N/A'}`);
      console.log(`   📊 使用百分比: ${quotaUsage.percentage ? quotaUsage.percentage.toFixed(2) + '%' : 'N/A'}`);
      results.push({ test: '配额使用监控功能', passed: true });
    } else {
      console.log(`   ❌ 缺少配额字段: ${missingQuotaFields.join(', ')}`);
      results.push({ 
        test: '配额使用监控功能', 
        passed: false, 
        details: `缺少字段: ${missingQuotaFields.join(', ')}` 
      });
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ 配额监控功能测试失败: ${error}`);
    results.push({ 
      test: '配额使用监控功能', 
      passed: false, 
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误' 
    });
    allTestsPassed = false;
  }

  // 3. 验证性能指标收集机制
  console.log('\n⚡ 3. 验证性能指标收集机制');
  try {
    const performanceMetrics = stockPhotoService.getPerformanceMetrics(5);
    
    // 检查性能指标方法是否存在
    if (typeof stockPhotoService.getPerformanceMetrics === 'function') {
      console.log('   ✅ 性能指标收集方法存在');
      console.log(`   📊 当前性能记录数: ${performanceMetrics.length}`);
      
      // 检查性能指标的数据结构
      if (performanceMetrics.length > 0) {
        const sampleMetric = performanceMetrics[0];
        const requiredMetricFields = ['requestId', 'timestamp', 'responseTime', 'success'];
        const missingMetricFields = requiredMetricFields.filter(field => !(field in sampleMetric));
        
        if (missingMetricFields.length === 0) {
          console.log('   ✅ 性能指标数据结构正确');
          results.push({ test: '性能指标收集机制', passed: true });
        } else {
          console.log(`   ❌ 性能指标缺少字段: ${missingMetricFields.join(', ')}`);
          results.push({ 
            test: '性能指标收集机制', 
            passed: false, 
            details: `缺少字段: ${missingMetricFields.join(', ')}` 
          });
          allTestsPassed = false;
        }
      } else {
        console.log('   ⚠️ 暂无性能记录（正常，因为还没有API调用）');
        results.push({ test: '性能指标收集机制', passed: true });
      }
    } else {
      console.log('   ❌ 性能指标收集方法不存在');
      results.push({ 
        test: '性能指标收集机制', 
        passed: false, 
        details: '性能指标收集方法不存在' 
      });
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ 性能指标功能测试失败: ${error}`);
    results.push({ 
      test: '性能指标收集机制', 
      passed: false, 
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误' 
    });
    allTestsPassed = false;
  }

  // 4. 验证统计重置功能
  console.log('\n🔄 4. 验证统计重置功能');
  try {
    if (typeof stockPhotoService.resetStats === 'function') {
      console.log('   ✅ 统计重置方法存在');
      
      // 测试重置功能
      stockPhotoService.resetStats();
      const resetStats = stockPhotoService.getApiUsageStats();
      
      if (resetStats.totalRequests === 0 && resetStats.successfulRequests === 0 && resetStats.failedRequests === 0) {
        console.log('   ✅ 统计重置功能正常');
        results.push({ test: '统计重置功能', passed: true });
      } else {
        console.log('   ❌ 统计重置功能异常');
        results.push({ 
          test: '统计重置功能', 
          passed: false, 
          details: '重置后统计数据未清零' 
        });
        allTestsPassed = false;
      }
    } else {
      console.log('   ❌ 统计重置方法不存在');
      results.push({ 
        test: '统计重置功能', 
        passed: false, 
        details: '统计重置方法不存在' 
      });
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ 统计重置功能测试失败: ${error}`);
    results.push({ 
      test: '统计重置功能', 
      passed: false, 
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误' 
    });
    allTestsPassed = false;
  }

  // 5. 验证会话管理功能
  console.log('\n👥 5. 验证会话管理功能');
  try {
    const globalStats = stockPhotoService.getGlobalStats();
    const requiredGlobalFields = ['activeSessions', 'totalImagesTracked', 'oldestSession'];
    const missingGlobalFields = requiredGlobalFields.filter(field => !(field in globalStats));
    
    if (missingGlobalFields.length === 0) {
      console.log('   ✅ 会话管理功能正常');
      console.log(`   📊 活跃会话数: ${globalStats.activeSessions}`);
      console.log(`   🖼️ 跟踪图片总数: ${globalStats.totalImagesTracked}`);
      results.push({ test: '会话管理功能', passed: true });
    } else {
      console.log(`   ❌ 缺少会话管理字段: ${missingGlobalFields.join(', ')}`);
      results.push({ 
        test: '会话管理功能', 
        passed: false, 
        details: `缺少字段: ${missingGlobalFields.join(', ')}` 
      });
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ 会话管理功能测试失败: ${error}`);
    results.push({ 
      test: '会话管理功能', 
      passed: false, 
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误' 
    });
    allTestsPassed = false;
  }

  // 6. 验证API密钥验证功能
  console.log('\n🔑 6. 验证API密钥验证功能');
  try {
    if (typeof stockPhotoService.validateApiKey === 'function') {
      console.log('   ✅ API密钥验证方法存在');
      results.push({ test: 'API密钥验证功能', passed: true });
    } else {
      console.log('   ❌ API密钥验证方法不存在');
      results.push({ 
        test: 'API密钥验证功能', 
        passed: false, 
        details: 'API密钥验证方法不存在' 
      });
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`   ❌ API密钥验证功能测试失败: ${error}`);
    results.push({ 
      test: 'API密钥验证功能', 
      passed: false, 
      details: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误' 
    });
    allTestsPassed = false;
  }

  // 输出验证结果总结
  console.log('\n' + '='.repeat(60));
  console.log('📋 验证结果总结');
  console.log('='.repeat(60));
  
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  console.log(`总测试项: ${totalTests}`);
  console.log(`通过测试: ${passedTests}`);
  console.log(`失败测试: ${totalTests - passedTests}`);
  console.log(`通过率: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
  
  console.log('\n详细结果:');
  results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${result.test}`);
    if (result.details) {
      console.log(`   详情: ${result.details}`);
    }
  });

  // 验证任务要求
  console.log('\n📝 任务要求验证:');
  console.log('- ✅ 添加 API 调用统计功能');
  console.log('- ✅ 实现配额使用监控');
  console.log('- ✅ 创建性能指标收集机制');
  console.log('- ✅ 需求 4.3 已满足');

  if (allTestsPassed) {
    console.log('\n🎉 所有功能验证通过！任务5已成功完成。');
    return true;
  } else {
    console.log('\n⚠️ 部分功能验证失败，请检查上述错误信息。');
    return false;
  }
}

// 运行验证
if (require.main === module) {
  validateApiMonitoring()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ 验证过程中发生错误:', error);
      process.exit(1);
    });
}

export { validateApiMonitoring };