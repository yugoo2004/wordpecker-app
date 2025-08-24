#!/usr/bin/env ts-node

/**
 * AI 服务冗余机制测试脚本
 * 用于验证 GLM-4.5 和 Moonshot 的故障转移功能
 */

import { createChatCompletion, getAIServiceStatus, resetAIFailureStatus } from '../src/config/ai-service';
import { generateSpeech, getVoiceServiceStatus } from '../src/config/voice-service';
import { logger } from '../src/config/logger';

// 测试消息
const testMessages = [
  { role: 'user' as const, content: '你好，请简单介绍一下自己。' },
];

const testText = '你好，这是一个语音测试。';

async function testAIService() {
  console.log('\n🤖 测试 AI 文本生成服务冗余机制...\n');

  try {
    // 获取初始状态
    const initialStatus = getAIServiceStatus();
    console.log('初始服务状态:', {
      当前提供商: initialStatus.currentProvider,
      可用提供商: initialStatus.availableProviders,
      失败提供商: initialStatus.failedProviders
    });

    // 测试正常请求
    console.log('\n📝 发送测试请求...');
    const startTime = Date.now();
    
    const response = await createChatCompletion(testMessages, {
      max_tokens: 100,
      temperature: 0.7
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log('✅ AI 请求成功!');
    console.log(`⏱️  响应时间: ${responseTime}ms`);
    console.log(`📊 使用的模型: ${response.model || '未知'}`);
    console.log(`💬 响应内容: ${response.choices[0]?.message?.content?.substring(0, 100)}...`);
    console.log(`🔢 Token 使用: ${response.usage?.total_tokens || 0}`);

    // 获取最终状态
    const finalStatus = getAIServiceStatus();
    console.log('\n最终服务状态:', {
      当前提供商: finalStatus.currentProvider,
      可用提供商: finalStatus.availableProviders,
      失败提供商: finalStatus.failedProviders
    });

    return true;
  } catch (error: any) {
    console.error('❌ AI 服务测试失败:', error.message);
    
    // 获取错误状态
    const errorStatus = getAIServiceStatus();
    console.log('错误时服务状态:', {
      当前提供商: errorStatus.currentProvider,
      可用提供商: errorStatus.availableProviders,
      失败提供商: errorStatus.failedProviders
    });

    return false;
  }
}

async function testVoiceService() {
  console.log('\n🎵 测试语音生成服务冗余机制...\n');

  try {
    // 获取初始状态
    const initialStatus = getVoiceServiceStatus();
    console.log('初始语音服务状态:', {
      当前提供商: initialStatus.currentProvider,
      可用提供商: initialStatus.availableProviders,
      失败提供商: initialStatus.failedProviders
    });

    // 测试语音生成
    console.log('\n🎤 生成测试语音...');
    const startTime = Date.now();
    
    const audioBuffer = await generateSpeech(testText, {
      voice: 'alloy',
      speed: 1.0,
      format: 'mp3'
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    console.log('✅ 语音生成成功!');
    console.log(`⏱️  响应时间: ${responseTime}ms`);
    console.log(`📦 音频大小: ${audioBuffer.length} bytes`);

    // 获取最终状态
    const finalStatus = getVoiceServiceStatus();
    console.log('\n最终语音服务状态:', {
      当前提供商: finalStatus.currentProvider,
      可用提供商: finalStatus.availableProviders,
      失败提供商: finalStatus.failedProviders
    });

    return true;
  } catch (error: any) {
    console.error('❌ 语音服务测试失败:', error.message);
    
    // 获取错误状态
    const errorStatus = getVoiceServiceStatus();
    console.log('错误时语音服务状态:', {
      当前提供商: errorStatus.currentProvider,
      可用提供商: errorStatus.availableProviders,
      失败提供商: errorStatus.failedProviders
    });

    return false;
  }
}

async function testFailoverScenario() {
  console.log('\n🔄 测试故障转移场景...\n');

  // 这里可以添加模拟故障的测试
  // 例如：临时修改 API 密钥来模拟服务失败
  console.log('💡 提示: 要测试故障转移，可以：');
  console.log('1. 临时修改 GLM_API_KEY 为无效值');
  console.log('2. 重新运行测试脚本');
  console.log('3. 观察是否自动切换到 Moonshot');
  console.log('4. 使用 resetAIFailureStatus() 恢复服务状态');
}

async function main() {
  console.log('🚀 WordPecker AI 服务冗余机制测试');
  console.log('=====================================');

  try {
    // 测试 AI 文本生成服务
    const aiSuccess = await testAIService();
    
    // 测试语音生成服务
    const voiceSuccess = await testVoiceService();
    
    // 测试故障转移场景说明
    await testFailoverScenario();

    // 总结
    console.log('\n📊 测试结果总结');
    console.log('=================');
    console.log(`AI 文本服务: ${aiSuccess ? '✅ 通过' : '❌ 失败'}`);
    console.log(`语音生成服务: ${voiceSuccess ? '✅ 通过' : '❌ 失败'}`);
    
    if (aiSuccess && voiceSuccess) {
      console.log('\n🎉 所有服务测试通过！冗余机制工作正常。');
      process.exit(0);
    } else {
      console.log('\n⚠️  部分服务测试失败，请检查配置和网络连接。');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n💥 测试过程中发生未预期的错误:', error.message);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  main().catch(console.error);
}

export { testAIService, testVoiceService };