#!/usr/bin/env ts-node

/**
 * API 监控端点测试脚本
 * 测试新增的统计、性能指标和配额监控端点
 */

import fetch from 'node-fetch';
import { environment } from '../config/environment';

const BASE_URL = `http://localhost:${environment.port || 3000}/api/describe`;

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  responseTime: number;
  error?: string;
}

async function testEndpoint(
  endpoint: string, 
  method: string = 'GET',
  body?: any
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'user-id': 'test-user-monitoring'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    
    const responseTime = Date.now() - startTime;
    const responseData = await response.json();
    
    console.log(`${method} ${endpoint} - ${response.status} (${responseTime}ms)`);
    
    if (response.ok) {
      console.log('✅ 响应成功');
      if (responseData.success !== undefined) {
        console.log(`   成功状态: ${responseData.success}`);
      }
      if (responseData.statistics) {
        console.log('   统计数据:', JSON.stringify(responseData.statistics, null, 2));
      }
      if (responseData.quota) {
        console.log('   配额信息:', JSON.stringify(responseData.quota, null, 2));
      }
      if (responseData.summary) {
        console.log('   性能摘要:', JSON.stringify(responseData.summary, null, 2));
      }
    } else {
      console.log('❌ 响应失败');
      console.log('   错误信息:', responseData.error || '未知错误');
    }
    
    return {
      endpoint,
      method,
      status: response.status,
      success: response.ok,
      responseTime,
      error: response.ok ? undefined : responseData.error
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`${method} ${endpoint} - 网络错误 (${responseTime}ms)`);
    console.log('❌ 请求失败:', error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误');
    
    return {
      endpoint,
      method,
      status: 0,
      success: false,
      responseTime,
      error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '网络错误'
    };
  }
}

async function testMonitoringEndpoints() {
  console.log('🧪 开始测试 API 监控端点...\n');
  console.log(`基础URL: ${BASE_URL}\n`);

  const results: TestResult[] = [];

  try {
    // 1. 首先生成一些测试数据
    console.log('📊 1. 生成测试数据');
    console.log('发送一些随机图片请求来生成统计数据...\n');
    
    const testQueries = ['nature', 'technology', 'business'];
    for (const query of testQueries) {
      await testEndpoint(`/random?query=${query}&sessionId=test-monitoring-session`);
      await new Promise(resolve => setTimeout(resolve, 200)); // 短暂延迟
    }
    
    console.log('\n' + '='.repeat(60) + '\n');

    // 2. 测试统计端点
    console.log('📈 2. 测试统计端点 (/stats)');
    const statsResult = await testEndpoint('/stats');
    results.push(statsResult);
    
    console.log('\n' + '-'.repeat(40) + '\n');

    // 3. 测试性能指标端点
    console.log('⚡ 3. 测试性能指标端点 (/metrics)');
    const metricsResult = await testEndpoint('/metrics');
    results.push(metricsResult);
    
    console.log('\n' + '-'.repeat(40) + '\n');

    // 4. 测试性能指标端点（带限制参数）
    console.log('⚡ 4. 测试性能指标端点（限制5条记录）');
    const metricsLimitResult = await testEndpoint('/metrics?limit=5');
    results.push(metricsLimitResult);
    
    console.log('\n' + '-'.repeat(40) + '\n');

    // 5. 测试配额监控端点
    console.log('💰 5. 测试配额监控端点 (/quota)');
    const quotaResult = await testEndpoint('/quota');
    results.push(quotaResult);
    
    console.log('\n' + '-'.repeat(40) + '\n');

    // 6. 测试API验证端点（已存在，但包含新的统计信息）
    console.log('🔍 6. 测试API验证端点 (/validate-api)');
    const validateResult = await testEndpoint('/validate-api');
    results.push(validateResult);
    
    console.log('\n' + '-'.repeat(40) + '\n');

    // 7. 测试重置统计端点（仅在非生产环境）
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔄 7. 测试重置统计端点 (/reset-stats)');
      const resetResult = await testEndpoint('/reset-stats', 'POST');
      results.push(resetResult);
      
      console.log('\n' + '-'.repeat(40) + '\n');
    }

    // 8. 测试错误处理 - 无效的限制参数
    console.log('❌ 8. 测试错误处理 - 无效的限制参数');
    const invalidLimitResult = await testEndpoint('/metrics?limit=invalid');
    results.push(invalidLimitResult);
    
    console.log('\n' + '='.repeat(60) + '\n');

    // 测试结果总结
    console.log('📋 测试结果总结:');
    console.log('='.repeat(60));
    
    const successfulTests = results.filter(r => r.success).length;
    const totalTests = results.length;
    
    console.log(`总测试数: ${totalTests}`);
    console.log(`成功测试数: ${successfulTests}`);
    console.log(`失败测试数: ${totalTests - successfulTests}`);
    console.log(`成功率: ${((successfulTests / totalTests) * 100).toFixed(2)}%`);
    
    console.log('\n详细结果:');
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.method} ${result.endpoint} - ${result.status} (${result.responseTime}ms)`);
      if (result.error) {
        console.log(`   错误: ${result.error}`);
      }
    });

    // 性能统计
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    const maxResponseTime = Math.max(...results.map(r => r.responseTime));
    const minResponseTime = Math.min(...results.map(r => r.responseTime));
    
    console.log('\n性能统计:');
    console.log(`平均响应时间: ${Math.round(avgResponseTime)}ms`);
    console.log(`最快响应时间: ${minResponseTime}ms`);
    console.log(`最慢响应时间: ${maxResponseTime}ms`);

    if (successfulTests === totalTests) {
      console.log('\n🎉 所有监控端点测试通过！');
    } else {
      console.log('\n⚠️ 部分测试失败，请检查错误信息');
    }

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testMonitoringEndpoints()
    .then(() => {
      console.log('\n✅ 监控端点测试完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 测试失败:', error);
      process.exit(1);
    });
}

export { testMonitoringEndpoints };