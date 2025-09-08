#!/usr/bin/env node

/**
 * Pexels API 配置验证脚本
 * 用于验证 Pexels API 密钥配置是否正确
 */

import { environment, validatePexelsApiKey } from '../config/environment';

async function validatePexelsConfiguration() {
  console.log('🔍 验证 Pexels API 配置...\n');

  try {
    // 1. 检查环境变量是否存在
    console.log('✅ 环境变量检查:');
    console.log(`   PEXELS_API_KEY: ${environment.pexels.apiKey ? '已设置' : '未设置'}`);
    console.log(`   Base URL: ${environment.pexels.baseUrl}`);
    console.log(`   Default Per Page: ${environment.pexels.defaultPerPage}`);
    console.log(`   Max Retries: ${environment.pexels.maxRetries}\n`);

    // 2. 验证 API 密钥格式
    console.log('🔑 API 密钥格式验证:');
    const isValidFormat = validatePexelsApiKey(environment.pexels.apiKey);
    console.log(`   格式验证: ${isValidFormat ? '✅ 有效' : '❌ 无效'}\n`);

    // 3. 测试 API 连接
    console.log('🌐 API 连接测试:');
    const testResponse = await fetch(`${environment.pexels.baseUrl}/search?query=nature&per_page=1`, {
      headers: {
        'Authorization': environment.pexels.apiKey
      }
    });

    if (testResponse.ok) {
      const data = await testResponse.json();
      console.log('   ✅ API 连接成功');
      console.log(`   📊 返回 ${data.photos?.length || 0} 张图片`);
      console.log(`   📈 总可用图片: ${data.total_results || 0}`);
    } else {
      console.log(`   ❌ API 连接失败: ${testResponse.status} ${testResponse.statusText}`);
      const errorText = await testResponse.text();
      console.log(`   错误详情: ${errorText}`);
    }

  } catch (error) {
    console.error('❌ 配置验证失败:', error instanceof Error ? (error instanceof Error ? error.message : String(error)) : error);
    process.exit(1);
  }

  console.log('\n🎉 Pexels API 配置验证完成!');
}

// 运行验证
if (require.main === module) {
  validatePexelsConfiguration().catch(console.error);
}

export { validatePexelsConfiguration };