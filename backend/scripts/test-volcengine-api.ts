#!/usr/bin/env ts-node

/**
 * 火山引擎 API 配置测试脚本
 * 测试豆包1.6、SeeDream 3.0、火山引擎TTS的 Access Key 认证
 */

import dotenv from 'dotenv';
import path from 'path';

// 从项目根目录加载 .env 文件
const projectRoot = path.resolve(__dirname, '../..');
const envPath = path.join(projectRoot, '.env');
dotenv.config({ path: envPath });

import { getDoubaoService } from '../src/services/doubao-service';
import { getVolcengineTTSService } from '../src/services/volcengine-tts-service';
import { getSeedreamImageService } from '../src/services/seedream-image-service';
import { logger } from '../src/config/logger';

interface TestResult {
  service: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: any;
}

async function testDoubaoService(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    logger.info('测试豆包1.6服务...');
    
    const doubaoService = getDoubaoService();
    
    // 测试简单的聊天完成
    const response = await doubaoService.createChatCompletion([
      { role: 'system', content: '你是一个有用的助手。' },
      { role: 'user', content: '请用一句话介绍自己。' }
    ], {
      max_tokens: 100,
      temperature: 0.7
    });

    const duration = Date.now() - startTime;
    
    if (response.choices && response.choices.length > 0) {
      return {
        service: '豆包1.6',
        success: true,
        duration,
        details: {
          responseLength: response.choices[0].message.content.length,
          tokensUsed: response.usage?.total_tokens || 0
        }
      };
    } else {
      throw new Error('响应格式无效');
    }

  } catch (error: any) {
    return {
      service: '豆包1.6',
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

async function testVolcengineTTS(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    logger.info('测试火山引擎TTS服务...');
    
    const ttsService = getVolcengineTTSService();
    
    // 测试语音合成
    const audioBuffer = await ttsService.generateSpeech('你好，这是火山引擎语音合成测试。', {
      voice: 'BV700_streaming',
      language: 'zh',
      speed: 1.0
    });

    const duration = Date.now() - startTime;
    
    if (audioBuffer && audioBuffer.length > 0) {
      return {
        service: '火山引擎TTS',
        success: true,
        duration,
        details: {
          audioSize: audioBuffer.length,
          format: 'mp3'
        }
      };
    } else {
      throw new Error('音频生成失败');
    }

  } catch (error: any) {
    return {
      service: '火山引擎TTS',
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

async function testSeedreamService(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    logger.info('测试SeeDream 3.0图像生成服务...');
    
    const imageService = getSeedreamImageService();
    
    // 测试图像生成
    const result = await imageService.generateImage(
      'A beautiful sunset over mountains, digital art style',
      {
        size: '512x512',
        style: 'vivid'
      }
    );

    const duration = Date.now() - startTime;
    
    if (result && (result.url || result.buffer)) {
      return {
        service: 'SeeDream 3.0',
        success: true,
        duration,
        details: {
          hasUrl: !!result.url,
          hasBuffer: !!result.buffer,
          size: result.metadata.size
        }
      };
    } else {
      throw new Error('图像生成失败');
    }

  } catch (error: any) {
    return {
      service: 'SeeDream 3.0',
      success: false,
      duration: Date.now() - startTime,
      error: error.message
    };
  }
}

async function runAllTests(): Promise<void> {
  console.log('🚀 开始测试火山引擎 API 配置...\n');
  
  const results: TestResult[] = [];
  
  // 测试豆包1.6
  console.log('📝 测试豆包1.6文本生成...');
  const doubaoResult = await testDoubaoService();
  results.push(doubaoResult);
  
  if (doubaoResult.success) {
    console.log(`✅ 豆包1.6测试成功 (${doubaoResult.duration}ms)`);
    console.log(`   响应长度: ${doubaoResult.details?.responseLength} 字符`);
    console.log(`   Token使用: ${doubaoResult.details?.tokensUsed}\n`);
  } else {
    console.log(`❌ 豆包1.6测试失败: ${doubaoResult.error}\n`);
  }

  // 测试火山引擎TTS
  console.log('🔊 测试火山引擎TTS语音合成...');
  const ttsResult = await testVolcengineTTS();
  results.push(ttsResult);
  
  if (ttsResult.success) {
    console.log(`✅ 火山引擎TTS测试成功 (${ttsResult.duration}ms)`);
    console.log(`   音频大小: ${ttsResult.details?.audioSize} 字节\n`);
  } else {
    console.log(`❌ 火山引擎TTS测试失败: ${ttsResult.error}\n`);
  }

  // 测试SeeDream 3.0
  console.log('🎨 测试SeeDream 3.0图像生成...');
  const imageResult = await testSeedreamService();
  results.push(imageResult);
  
  if (imageResult.success) {
    console.log(`✅ SeeDream 3.0测试成功 (${imageResult.duration}ms)`);
    console.log(`   图像尺寸: ${imageResult.details?.size}\n`);
  } else {
    console.log(`❌ SeeDream 3.0测试失败: ${imageResult.error}\n`);
  }

  // 测试结果总结
  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;
  
  console.log('📊 测试结果总结:');
  console.log(`   成功: ${successCount}/${totalCount}`);
  console.log(`   成功率: ${Math.round((successCount / totalCount) * 100)}%`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 所有服务测试通过！火山引擎 API 配置成功！');
  } else {
    console.log('\n⚠️  部分服务测试失败，请检查配置或网络连接。');
  }

  // 保存测试报告
  const report = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      total: totalCount,
      success: successCount,
      successRate: (successCount / totalCount) * 100
    }
  };

  const reportPath = `./volcengine-api-test-report-${Date.now()}.json`;
  try {
    await require('fs').promises.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 测试报告已保存到: ${reportPath}`);
  } catch (error) {
    console.log(`\n⚠️  无法保存测试报告: ${error}`);
  }
}

// 运行测试
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('测试运行失败:', error);
    process.exit(1);
  });
}

export { runAllTests, testDoubaoService, testVolcengineTTS, testSeedreamService };