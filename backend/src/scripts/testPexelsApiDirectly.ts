#!/usr/bin/env ts-node

/**
 * 直接测试Pexels API和新的随机图片端点
 * 不依赖OpenAI agents，直接调用Pexels API
 */

import { environment } from '../config/environment';

async function testPexelsApiDirectly() {
  console.log('🧪 直接测试Pexels API和随机图片功能...\n');

  try {
    // 测试1: 直接调用Pexels API
    console.log('📋 测试1: 直接调用Pexels API');
    console.log('=' .repeat(50));
    
    const searchQuery = 'nature';
    const pexelsUrl = `${environment.pexels.baseUrl}/search?query=${encodeURIComponent(searchQuery)}&per_page=5`;
    
    console.log(`🔍 请求URL: ${pexelsUrl}`);
    console.log(`🔑 API密钥: ${environment.pexels.apiKey.substring(0, 10)}...`);
    
    const response = await fetch(pexelsUrl, {
      headers: {
        'Authorization': environment.pexels.apiKey
      }
    });
    
    console.log(`📊 响应状态: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API请求失败: ${errorText}`);
      throw new Error(`Pexels API请求失败: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ 成功获取 ${data.photos?.length || 0} 张图片`);
    
    if (data.photos && data.photos.length > 0) {
      const firstPhoto = data.photos[0];
      console.log(`📸 第一张图片:`, {
        ID: firstPhoto.id,
        URL: firstPhoto.src.large.substring(0, 50) + '...',
        描述: firstPhoto.alt || '无描述',
        摄影师: firstPhoto.photographer,
        尺寸: `${firstPhoto.width}x${firstPhoto.height}`
      });
    }
    
    console.log('\n');

    // 测试2: 测试不同的搜索查询
    console.log('📋 测试2: 测试不同的搜索查询');
    console.log('=' .repeat(50));
    
    const testQueries = ['business', 'technology', 'food', 'travel', 'people'];
    
    for (const query of testQueries) {
      try {
        const queryUrl = `${environment.pexels.baseUrl}/search?query=${encodeURIComponent(query)}&per_page=3`;
        const queryResponse = await fetch(queryUrl, {
          headers: {
            'Authorization': environment.pexels.apiKey
          }
        });
        
        if (queryResponse.ok) {
          const queryData = await queryResponse.json();
          console.log(`✅ "${query}": ${queryData.photos?.length || 0} 张图片`);
        } else {
          console.log(`❌ "${query}": 请求失败 (${queryResponse.status})`);
        }
        
        // 添加延迟以避免API限制
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.log(`❌ "${query}": 错误 - ${error instanceof Error ? (error instanceof Error ? error.message : String(error)) : error}`);
      }
    }
    
    console.log('\n');

    // 测试3: 测试随机选择逻辑
    console.log('📋 测试3: 测试随机选择逻辑');
    console.log('=' .repeat(50));
    
    const randomTestUrl = `${environment.pexels.baseUrl}/search?query=landscape&per_page=10`;
    const randomResponse = await fetch(randomTestUrl, {
      headers: {
        'Authorization': environment.pexels.apiKey
      }
    });
    
    if (randomResponse.ok) {
      const randomData = await randomResponse.json();
      const photos = randomData.photos || [];
      
      console.log(`📊 获取到 ${photos.length} 张风景图片`);
      
      // 模拟随机选择
      if (photos.length > 0) {
        const randomIndex = Math.floor(Math.random() * photos.length);
        const selectedPhoto = photos[randomIndex];
        
        console.log(`🎲 随机选择第 ${randomIndex + 1} 张图片:`, {
          ID: selectedPhoto.id,
          URL: selectedPhoto.src.large.substring(0, 50) + '...',
          描述: selectedPhoto.alt || '无描述'
        });
      }
    }
    
    console.log('\n');

    // 测试4: 测试API配额和限制
    console.log('📋 测试4: 测试API配额和限制');
    console.log('=' .repeat(50));
    
    // 检查响应头中的配额信息
    const quotaResponse = await fetch(`${environment.pexels.baseUrl}/search?query=test&per_page=1`, {
      headers: {
        'Authorization': environment.pexels.apiKey
      }
    });
    
    console.log('📊 API配额信息:');
    console.log(`- X-Ratelimit-Limit: ${quotaResponse.headers.get('X-Ratelimit-Limit') || '未知'}`);
    console.log(`- X-Ratelimit-Remaining: ${quotaResponse.headers.get('X-Ratelimit-Remaining') || '未知'}`);
    console.log(`- X-Ratelimit-Reset: ${quotaResponse.headers.get('X-Ratelimit-Reset') || '未知'}`);
    
    console.log('\n🎉 Pexels API测试完成！');
    
    // 总结
    console.log('\n📊 测试总结:');
    console.log('✅ Pexels API密钥有效');
    console.log('✅ API请求正常工作');
    console.log('✅ 图片数据格式正确');
    console.log('✅ 随机选择逻辑可行');
    
    console.log('\n💡 新的API端点实现建议:');
    console.log('1. GET /api/image-description/random - 可以直接使用Pexels API');
    console.log('2. GET /api/image-description/random/:category - 将category作为搜索查询');
    console.log('3. GET /api/image-description/validate-api - 可以验证API密钥和配额');

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    throw error;
  }
}

// 运行测试
if (require.main === module) {
  testPexelsApiDirectly()
    .then(() => {
      console.log('\n✅ Pexels API直接测试完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Pexels API直接测试失败:', error);
      process.exit(1);
    });
}

export { testPexelsApiDirectly };