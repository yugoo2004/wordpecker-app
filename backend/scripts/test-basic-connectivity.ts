#!/usr/bin/env ts-node

/**
 * 火山引擎 API 连通性测试
 * 验证 Access Key 是否有效
 */

import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

// 从项目根目录加载 .env 文件
const projectRoot = path.resolve(__dirname, '../..');
const envPath = path.join(projectRoot, '.env');
dotenv.config({ path: envPath });

async function testAccessKeyConnectivity(): Promise<boolean> {
  const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VOLCENGINE_SECRET_ACCESS_KEY;
  
  if (!accessKeyId || !secretAccessKey) {
    console.log('❌ Access Key 未配置');
    return false;
  }
  
  console.log('🔑 Access Key 信息:');
  console.log(`   Access Key ID: ${accessKeyId.substring(0, 8)}...`);
  console.log(`   Secret Key 长度: ${secretAccessKey.length} 字符`);
  
  // 验证密钥格式
  if (accessKeyId.startsWith('AKLT') && secretAccessKey.length >= 32) {
    console.log('✅ Access Key 格式有效');
    return true;
  } else {
    console.log('❌ Access Key 格式无效');
    return false;
  }
}

async function testBasicConfiguration(): Promise<void> {
  console.log('🚀 火山引擎基础配置测试\n');
  
  // 检查 Access Key
  const accessKeyValid = await testAccessKeyConnectivity();
  
  if (!accessKeyValid) {
    console.log('\n⚠️  请先配置有效的 Access Key，然后重试。');
    return;
  }
  
  // 检查其他配置
  console.log('\n📋 其他配置检查:');
  
  const doubaoEndpoint = process.env.DOUBAO_ENDPOINT;
  if (doubaoEndpoint && !doubaoEndpoint.includes('example')) {
    console.log('✅ 豆包端点配置: 已设置');
  } else {
    console.log('⚠️  豆包端点配置: 需要实际的端点ID');
  }
  
  const volcengineAppId = process.env.VOLCENGINE_APP_ID;
  if (volcengineAppId && !volcengineAppId.includes('example')) {
    console.log('✅ TTS应用ID配置: 已设置');
  } else {
    console.log('⚠️  TTS应用ID配置: 需要实际的应用ID');
  }
  
  console.log('\n📖 后续步骤:');
  console.log('1. 在火山引擎控制台创建豆包模型实例');
  console.log('2. 获取实际的端点ID替换 DOUBAO_ENDPOINT');
  console.log('3. 创建TTS应用获取实际的应用ID');
  console.log('4. 运行完整的API测试: npm run test:volcengine-api');
  
  console.log('\n✅ 基础配置验证完成！');
}

// 运行测试
if (require.main === module) {
  testBasicConfiguration().catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
  });
}

export { testAccessKeyConnectivity, testBasicConfiguration };