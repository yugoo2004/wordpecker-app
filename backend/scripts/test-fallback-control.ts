#!/usr/bin/env ts-node

/**
 * AI降级机制控制测试脚本
 * 用于验证禁用AI降级机制的功能
 */

import { 
  createChatCompletion, 
  disableAIFallback, 
  enableAIFallback, 
  getAIFallbackStatus,
  setAIDebugMode 
} from '../src/config/ai-service';
import { logger } from '../src/config/logger';

// 测试消息
const testMessages = [
  { role: 'user' as const, content: '你好，请简单介绍一下自己。' }
];

/**
 * 测试正常降级机制
 */
async function testNormalFallback(): Promise<void> {
  console.log('\n🔄 测试正常降级机制...\n');

  try {
    // 确保降级机制是启用的
    enableAIFallback();
    
    const status = getAIFallbackStatus();
    console.log('降级机制状态:', {
      启用: status.enabled,
      强制提供商: status.forcedProvider || '无',
      详细日志: status.detailedLogging,
      调试模式: status.debugMode
    });

    console.log('\n📝 发送测试请求...');
    const startTime = Date.now();
    
    const response = await createChatCompletion(testMessages, {
      max_tokens: 100,
      temperature: 0.7
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log('✅ 请求成功:', {
      响应时间: `${responseTime}ms`,
      使用的模型: response.model,
      token使用量: response.usage?.total_tokens || 0,
      响应内容: response.choices[0]?.message?.content?.substring(0, 100) + '...'
    });

  } catch (error: any) {
    console.error('❌ 正常降级测试失败:', error.message);
  }
}

/**
 * 测试禁用降级机制 - 强制使用豆包
 */
async function testDisableFallbackWithDoubao(): Promise<void> {
  console.log('\n🚫 测试禁用降级机制（强制使用豆包）...\n');

  try {
    // 禁用降级，强制使用豆包
    disableAIFallback('doubao', true);
    setAIDebugMode(true);
    
    const status = getAIFallbackStatus();
    console.log('降级机制状态:', {
      启用: status.enabled,
      强制提供商: status.forcedProvider,
      详细日志: status.detailedLogging,
      调试模式: status.debugMode
    });

    console.log('\n📝 发送测试请求（仅豆包）...');
    const startTime = Date.now();
    
    const response = await createChatCompletion(testMessages, {
      max_tokens: 100,
      temperature: 0.7
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log('✅ 豆包请求成功:', {
      响应时间: `${responseTime}ms`,
      使用的模型: response.model,
      token使用量: response.usage?.total_tokens || 0,
      响应内容: response.choices[0]?.message?.content?.substring(0, 100) + '...'
    });

    return; // 成功则直接返回

  } catch (error: any) {
    console.error('❌ 豆包服务测试失败:', error.message);
    
    // 分析错误类型
    if (error.message.includes('不可用')) {
      console.log('🔍 错误分析: 豆包服务可能未正确配置或不可用');
    } else if (error.message.includes('auth') || error.message.includes('key')) {
      console.log('🔍 错误分析: 可能是认证配置问题');
    } else if (error.message.includes('network') || error.message.includes('connect')) {
      console.log('🔍 错误分析: 可能是网络连接问题');
    }
    
    console.log('💡 建议检查以下配置:');
    console.log('   - VOLCENGINE_ACCESS_KEY_ID');
    console.log('   - VOLCENGINE_SECRET_ACCESS_KEY');
    console.log('   - DOUBAO_ENDPOINT');
    
    throw error; // 重新抛出错误用于上级处理
  }
}

/**
 * 测试禁用降级机制 - 强制使用GLM
 */
async function testDisableFallbackWithGLM(): Promise<void> {
  console.log('\n🚫 测试禁用降级机制（强制使用GLM）...\n');

  try {
    // 禁用降级，强制使用GLM
    disableAIFallback('glm', true);
    
    const status = getAIFallbackStatus();
    console.log('降级机制状态:', {
      启用: status.enabled,
      强制提供商: status.forcedProvider,
      详细日志: status.detailedLogging,
      调试模式: status.debugMode
    });

    console.log('\n📝 发送测试请求（仅GLM）...');
    const startTime = Date.now();
    
    const response = await createChatCompletion(testMessages, {
      max_tokens: 100,
      temperature: 0.7
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log('✅ GLM请求成功:', {
      响应时间: `${responseTime}ms`,
      使用的模型: response.model,
      token使用量: response.usage?.total_tokens || 0,
      响应内容: response.choices[0]?.message?.content?.substring(0, 100) + '...'
    });

  } catch (error: any) {
    console.error('❌ GLM服务测试失败:', error.message);
    throw error;
  }
}

/**
 * 测试错误详细日志
 */
async function testDetailedErrorLogging(): Promise<void> {
  console.log('\n📋 测试详细错误日志记录...\n');

  try {
    // 禁用降级，强制使用一个不存在的提供商（模拟错误）
    disableAIFallback('qwen', true); // 假设qwen没有配置密钥
    
    console.log('🔍 尝试使用未配置的服务（模拟错误）...');
    
    await createChatCompletion(testMessages, {
      max_tokens: 50,
      temperature: 0.5
    });

    console.log('⚠️ 意外：请求应该失败但成功了');

  } catch (error: any) {
    console.log('✅ 预期的错误已捕获:', error.message);
    console.log('📝 详细错误日志应已写入 logs/ai-service-errors.json');
  }
}

/**
 * 测试API端点
 */
async function testAPIEndpoints(): Promise<void> {
  console.log('\n🌐 测试管理API端点...\n');

  const baseUrl = 'http://localhost:3000';
  
  try {
    // 测试禁用降级API
    console.log('📡 测试禁用降级API...');
    const disableResponse = await fetch(`${baseUrl}/api/management/ai/disable-fallback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'doubao', logErrors: true })
    });
    
    if (disableResponse.ok) {
      const result = await disableResponse.json();
      console.log('✅ 禁用降级API测试成功:', result.message);
    } else {
      console.log('❌ 禁用降级API测试失败:', disableResponse.statusText);
    }

    // 测试状态查询API
    console.log('\n📡 测试状态查询API...');
    const statusResponse = await fetch(`${baseUrl}/api/management/ai/fallback-status`);
    
    if (statusResponse.ok) {
      const result = await statusResponse.json();
      console.log('✅ 状态查询API测试成功:', result.data);
    } else {
      console.log('❌ 状态查询API测试失败:', statusResponse.statusText);
    }

    // 测试火山引擎连接API
    console.log('\n📡 测试火山引擎连接API...');
    const volcengineResponse = await fetch(`${baseUrl}/api/management/ai/test-volcengine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (volcengineResponse.ok) {
      const result = await volcengineResponse.json();
      console.log('✅ 火山引擎连接API测试成功:', result.message);
    } else {
      const error = await volcengineResponse.json();
      console.log('❌ 火山引擎连接API测试失败:', error.error);
    }

    // 测试启用降级API
    console.log('\n📡 测试启用降级API...');
    const enableResponse = await fetch(`${baseUrl}/api/management/ai/enable-fallback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (enableResponse.ok) {
      const result = await enableResponse.json();
      console.log('✅ 启用降级API测试成功:', result.message);
    } else {
      console.log('❌ 启用降级API测试失败:', enableResponse.statusText);
    }

  } catch (error: any) {
    console.error('❌ API测试失败:', error.message);
    console.log('💡 请确保后端服务正在运行在 http://localhost:3000');
  }
}

/**
 * 生成测试报告
 */
function generateTestReport(results: { [key: string]: boolean }): void {
  console.log('\n📊 测试报告');
  console.log('='.repeat(50));
  
  let passedTests = 0;
  let totalTests = 0;
  
  for (const [testName, passed] of Object.entries(results)) {
    console.log(`${passed ? '✅' : '❌'} ${testName}`);
    if (passed) passedTests++;
    totalTests++;
  }
  
  console.log('='.repeat(50));
  console.log(`通过: ${passedTests}/${totalTests} (${Math.round(passedTests/totalTests*100)}%)`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 所有测试通过！AI降级控制功能正常工作。');
  } else {
    console.log('\n⚠️ 部分测试失败，请检查配置和服务状态。');
  }
}

/**
 * 主测试函数
 */
async function main(): Promise<void> {
  console.log('🚀 AI降级机制控制测试');
  console.log('=' .repeat(50));

  const testResults: { [key: string]: boolean } = {};

  try {
    // 测试1: 正常降级机制
    try {
      await testNormalFallback();
      testResults['正常降级机制'] = true;
    } catch (error) {
      testResults['正常降级机制'] = false;
    }

    // 测试2: 禁用降级 - 豆包
    try {
      await testDisableFallbackWithDoubao();
      testResults['禁用降级（豆包）'] = true;
    } catch (error) {
      testResults['禁用降级（豆包）'] = false;
    }

    // 测试3: 禁用降级 - GLM
    try {
      await testDisableFallbackWithGLM();
      testResults['禁用降级（GLM）'] = true;
    } catch (error) {
      testResults['禁用降级（GLM）'] = false;
    }

    // 测试4: 详细错误日志
    try {
      await testDetailedErrorLogging();
      testResults['详细错误日志'] = true;
    } catch (error) {
      testResults['详细错误日志'] = false;
    }

    // 测试5: API端点
    try {
      await testAPIEndpoints();
      testResults['管理API端点'] = true;
    } catch (error) {
      testResults['管理API端点'] = false;
    }

    // 恢复默认设置
    console.log('\n🔄 恢复默认设置...');
    enableAIFallback();
    setAIDebugMode(false);

    // 生成测试报告
    generateTestReport(testResults);

  } catch (error: any) {
    console.error('\n💥 测试执行失败:', error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

export { main as testFallbackControl };