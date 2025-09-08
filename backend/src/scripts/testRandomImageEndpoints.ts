#!/usr/bin/env ts-node

/**
 * 测试新的随机图片API端点
 * 验证三个新端点的功能：
 * 1. GET /api/image-description/random
 * 2. GET /api/image-description/random/:category  
 * 3. GET /api/image-description/validate-api
 */

import { stockPhotoService } from '../api/image-description/stock-photo-service';

async function testRandomImageEndpoints() {
  console.log('🧪 开始测试随机图片API端点...\n');

  // 检查环境变量
  const pexelsApiKey = process.env.PEXELS_API_KEY;
  if (!pexelsApiKey || pexelsApiKey === 'your_pexels_api_key_here') {
    console.log('⚠️ 警告: PEXELS_API_KEY 未配置或使用占位符值');
    console.log('📝 这将测试API端点的结构和错误处理，但不会进行实际的API调用');
    console.log('🔧 要进行完整测试，请在 .env 文件中配置有效的 Pexels API 密钥\n');
  }

  try {
    // 测试1: API配置验证
    console.log('📋 测试1: API配置验证');
    console.log('=' .repeat(50));
    
    const isValidKey = await stockPhotoService.validateApiKey();
    console.log(`✅ API密钥验证结果: ${isValidKey ? '有效' : '无效'}`);
    
    const usageStats = stockPhotoService.getApiUsageStats();
    console.log(`📊 API使用统计:`, {
      总请求数: usageStats.totalRequests,
      成功请求数: usageStats.successfulRequests,
      失败请求数: usageStats.failedRequests,
      平均响应时间: usageStats.averageResponseTime + 'ms'
    });
    
    const globalStats = stockPhotoService.getGlobalStats();
    console.log(`🌍 全局统计:`, {
      活跃会话数: globalStats.activeSessions,
      跟踪图片总数: globalStats.totalImagesTracked
    });
    
    console.log('\n');

    // 测试2: 随机图片获取（无查询参数）
    console.log('📋 测试2: 随机图片获取（无查询参数）');
    console.log('=' .repeat(50));
    
    const randomImage1 = await stockPhotoService.findRandomImage();
    console.log(`✅ 随机图片1:`, {
      ID: randomImage1.id,
      URL: randomImage1.url.substring(0, 50) + '...',
      描述: randomImage1.alt_description,
      搜索词: randomImage1.prompt,
      来源: randomImage1.source
    });
    
    console.log('\n');

    // 测试3: 随机图片获取（带查询参数）
    console.log('📋 测试3: 随机图片获取（带查询参数）');
    console.log('=' .repeat(50));
    
    const randomImage2 = await stockPhotoService.findRandomImage('nature', 'test-session-1');
    console.log(`✅ 自然主题随机图片:`, {
      ID: randomImage2.id,
      URL: randomImage2.url.substring(0, 50) + '...',
      描述: randomImage2.alt_description,
      搜索词: randomImage2.prompt,
      来源: randomImage2.source
    });
    
    console.log('\n');

    // 测试4: 分类随机图片获取
    console.log('📋 测试4: 分类随机图片获取');
    console.log('=' .repeat(50));
    
    const categories = ['business', 'technology', 'food', 'travel'];
    
    for (const category of categories) {
      try {
        const categoryImage = await stockPhotoService.findRandomImage(category, 'test-session-2');
        console.log(`✅ ${category} 类别图片:`, {
          ID: categoryImage.id,
          URL: categoryImage.url.substring(0, 50) + '...',
          描述: categoryImage.alt_description,
          搜索词: categoryImage.prompt
        });
      } catch (error) {
        console.log(`❌ ${category} 类别图片获取失败:`, error instanceof Error ? (error instanceof Error ? error.message : String(error)) : error);
      }
    }
    
    console.log('\n');

    // 测试5: 会话管理功能
    console.log('📋 测试5: 会话管理功能');
    console.log('=' .repeat(50));
    
    const sessionStats1 = stockPhotoService.getSessionStats('test-session-1');
    const sessionStats2 = stockPhotoService.getSessionStats('test-session-2');
    
    console.log(`📊 会话1统计:`, sessionStats1);
    console.log(`📊 会话2统计:`, sessionStats2);
    
    // 测试会话清理
    const cleared1 = stockPhotoService.clearSession('test-session-1');
    const cleared2 = stockPhotoService.clearSession('test-session-2');
    
    console.log(`🧹 会话清理结果: 会话1=${cleared1}, 会话2=${cleared2}`);
    
    console.log('\n');

    // 测试6: 错误处理
    console.log('📋 测试6: 错误处理');
    console.log('=' .repeat(50));
    
    try {
      // 尝试使用一个不太可能找到图片的搜索词
      await stockPhotoService.findRandomImage('xyzabc123nonexistentquery456');
      console.log('⚠️ 预期的错误没有发生');
    } catch (error) {
      console.log(`✅ 错误处理正常:`, {
        错误信息: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : '未知错误',
        错误代码: (error as any)?.code || '无代码',
        错误详情: (error as any)?.details || '无详情'
      });
    }

    console.log('\n🎉 所有测试完成！');
    
    // 最终统计
    const finalStats = stockPhotoService.getApiUsageStats();
    const finalGlobalStats = stockPhotoService.getGlobalStats();
    
    console.log('\n📊 最终统计:');
    console.log('API使用:', finalStats);
    console.log('全局统计:', finalGlobalStats);

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testRandomImageEndpoints()
    .then(() => {
      console.log('\n✅ 测试脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 测试脚本执行失败:', error);
      process.exit(1);
    });
}

export { testRandomImageEndpoints };