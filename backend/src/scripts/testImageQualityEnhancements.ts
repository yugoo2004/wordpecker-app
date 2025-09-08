#!/usr/bin/env ts-node

/**
 * 测试图片质量和相关性增强功能
 * 验证任务7的实现效果
 */

import { stockPhotoService } from '../api/image-description/stock-photo-service';

async function testImageQualityEnhancements() {
  console.log('🧪 开始测试图片质量和相关性增强功能...\n');

  try {
    // 测试1: 验证高分辨率图片URL选择
    console.log('📸 测试1: 高分辨率图片URL选择');
    const testQueries = [
      'professional business meeting',
      'beautiful mountain landscape',
      'modern technology workspace',
      'healthy food preparation'
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 搜索查询: "${query}"`);
      
      try {
        const result = await stockPhotoService.findRandomImage(query, `test_session_${Date.now()}`);
        
        console.log(`✅ 图片ID: ${result.id}`);
        console.log(`🖼️  图片URL: ${result.url}`);
        console.log(`📝 Alt描述: ${result.alt_description}`);
        console.log(`📖 详细描述: ${result.description.substring(0, 100)}...`);
        console.log(`🎯 优化查询: ${result.prompt}`);
        
        // 检查URL是否为高质量版本
        if (result.url.includes('large') || result.url.includes('original')) {
          console.log('✅ 使用了高质量图片URL');
        } else {
          console.log('⚠️  可能未使用最高质量URL');
        }
        
      } catch (error) {
        console.error(`❌ 查询 "${query}" 失败:`, error instanceof Error ? (error instanceof Error ? error.message : String(error)) : error);
      }
    }

    // 测试2: 验证上下文优化功能
    console.log('\n\n🎯 测试2: 上下文优化功能');
    const contextTests = [
      { original: 'learning', expected: '应该包含教育相关词汇' },
      { original: 'business work', expected: '应该包含办公或专业相关词汇' },
      { original: 'technology computer', expected: '应该包含技术或数字相关词汇' },
      { original: 'nature environment', expected: '应该包含自然或户外相关词汇' }
    ];

    for (const test of contextTests) {
      console.log(`\n🔍 原始上下文: "${test.original}"`);
      
      try {
        const result = await stockPhotoService.findRandomImage(test.original, `context_test_${Date.now()}`);
        
        console.log(`🎯 优化后查询: "${result.prompt}"`);
        console.log(`📝 生成的描述: ${result.description.substring(0, 120)}...`);
        
        // 检查是否进行了上下文优化
        if (result.prompt !== test.original) {
          console.log('✅ 成功进行了上下文优化');
        } else {
          console.log('ℹ️  保持了原始查询');
        }
        
      } catch (error) {
        console.error(`❌ 上下文测试 "${test.original}" 失败:`, error instanceof Error ? (error instanceof Error ? error.message : String(error)) : error);
      }
    }

    // 测试3: 验证增强的描述生成
    console.log('\n\n📝 测试3: 增强的描述生成功能');
    
    try {
      const result = await stockPhotoService.findRandomImage('creative art design', `description_test_${Date.now()}`);
      
      console.log(`\n🎨 测试查询: "creative art design"`);
      console.log(`📝 Alt描述长度: ${result.alt_description.length} 字符`);
      console.log(`📖 详细描述长度: ${result.description.length} 字符`);
      console.log(`\nAlt描述内容:`);
      console.log(`"${result.alt_description}"`);
      console.log(`\n详细描述内容:`);
      console.log(`"${result.description}"`);
      
      // 检查描述质量
      const hasPhotographer = result.description.includes('by ') || result.description.includes('photographer');
      const hasLearningValue = result.description.includes('vocabulary') || result.description.includes('learning');
      const hasQualityInfo = result.description.includes('resolution') || result.description.includes('quality');
      
      console.log(`\n📊 描述质量检查:`);
      console.log(`${hasPhotographer ? '✅' : '❌'} 包含摄影师信息`);
      console.log(`${hasLearningValue ? '✅' : '❌'} 包含学习价值描述`);
      console.log(`${hasQualityInfo ? '✅' : '❌'} 包含质量信息`);
      
    } catch (error) {
      console.error('❌ 描述生成测试失败:', error instanceof Error ? (error instanceof Error ? error.message : String(error)) : error);
    }

    // 测试4: 验证随机查询生成的多样性
    console.log('\n\n🎲 测试4: 随机查询生成多样性');
    
    const randomQueries = [];
    for (let i = 0; i < 5; i++) {
      try {
        const result = await stockPhotoService.findRandomImage(undefined, `random_test_${i}_${Date.now()}`);
        randomQueries.push(result.prompt);
        console.log(`${i + 1}. "${result.prompt}"`);
      } catch (error) {
        console.error(`❌ 随机查询 ${i + 1} 失败:`, error instanceof Error ? (error instanceof Error ? error.message : String(error)) : error);
      }
    }
    
    // 检查多样性
    const uniqueQueries = new Set(randomQueries);
    console.log(`\n📊 多样性检查: ${uniqueQueries.size}/${randomQueries.length} 个唯一查询`);
    if (uniqueQueries.size === randomQueries.length) {
      console.log('✅ 随机查询具有良好的多样性');
    } else {
      console.log('⚠️  随机查询可能存在重复');
    }

    // 测试5: API使用统计
    console.log('\n\n📊 测试5: API使用统计');
    
    const stats = stockPhotoService.getApiUsageStats();
    console.log(`总请求数: ${stats.totalRequests}`);
    console.log(`成功请求数: ${stats.successfulRequests}`);
    console.log(`失败请求数: ${stats.failedRequests}`);
    console.log(`平均响应时间: ${Math.round(stats.averageResponseTime)}ms`);
    console.log(`成功率: ${stats.totalRequests > 0 ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2) : 0}%`);

    console.log('\n🎉 图片质量和相关性增强功能测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  testImageQualityEnhancements()
    .then(() => {
      console.log('\n✅ 所有测试完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 测试失败:', error);
      process.exit(1);
    });
}

export { testImageQualityEnhancements };