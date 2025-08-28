#!/usr/bin/env ts-node

/**
 * 火山引擎配置验证脚本
 * 验证环境变量配置是否正确
 */

import dotenv from 'dotenv';
import path from 'path';

// 从项目根目录加载 .env 文件
const projectRoot = path.resolve(__dirname, '../..');
const envPath = path.join(projectRoot, '.env');
dotenv.config({ path: envPath });

console.log('📁 加载环境变量文件:', envPath);
console.log('🔑 VOLCENGINE_ACCESS_KEY_ID:', process.env.VOLCENGINE_ACCESS_KEY_ID ? '***已配置***' : '未配置');
console.log('🔑 VOLCENGINE_SECRET_ACCESS_KEY:', process.env.VOLCENGINE_SECRET_ACCESS_KEY ? '***已配置***' : '未配置');
console.log('');

import { environment } from '../src/config/environment';
import { logger } from '../src/config/logger';

interface ConfigValidation {
  service: string;
  required: string[];
  optional: string[];
  status: 'valid' | 'partial' | 'invalid';
  missingRequired: string[];
  missingOptional: string[];
}

function validateDoubaoConfig(): ConfigValidation {
  const required = ['ACCESS_KEY_ID', 'SECRET_ACCESS_KEY', 'ENDPOINT'];
  const optional = ['API_KEY', 'MODEL', 'REGION'];
  
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  
  // 检查必需配置
  if (!environment.ai.doubao.accessKeyId) missingRequired.push('VOLCENGINE_ACCESS_KEY_ID');
  if (!environment.ai.doubao.secretAccessKey) missingRequired.push('VOLCENGINE_SECRET_ACCESS_KEY');
  if (!environment.ai.doubao.endpoint) missingRequired.push('DOUBAO_ENDPOINT');
  
  // 检查可选配置
  if (!environment.ai.doubao.apiKey) missingOptional.push('DOUBAO_API_KEY');
  if (!environment.ai.doubao.model) missingOptional.push('DOUBAO_MODEL');
  
  let status: 'valid' | 'partial' | 'invalid' = 'valid';
  if (missingRequired.length > 0) {
    status = 'invalid';
  } else if (missingOptional.length > 0) {
    status = 'partial';
  }
  
  return {
    service: '豆包1.6',
    required,
    optional,
    status,
    missingRequired,
    missingOptional
  };
}

function validateVolcengineTTSConfig(): ConfigValidation {
  const required = ['ACCESS_KEY_ID', 'SECRET_ACCESS_KEY', 'APP_ID'];
  const optional = ['API_KEY', 'VOICE_TYPE', 'ENCODING'];
  
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  
  // 检查必需配置
  if (!environment.voice.volcengine.accessKeyId) missingRequired.push('VOLCENGINE_ACCESS_KEY_ID');
  if (!environment.voice.volcengine.secretAccessKey) missingRequired.push('VOLCENGINE_SECRET_ACCESS_KEY');
  if (!environment.voice.volcengine.appId) missingRequired.push('VOLCENGINE_APP_ID');
  
  // 检查可选配置
  if (!environment.voice.volcengine.apiKey) missingOptional.push('VOLCENGINE_API_KEY');
  if (!environment.voice.volcengine.voiceType) missingOptional.push('VOLCENGINE_VOICE_TYPE');
  
  let status: 'valid' | 'partial' | 'invalid' = 'valid';
  if (missingRequired.length > 0) {
    status = 'invalid';
  } else if (missingOptional.length > 0) {
    status = 'partial';
  }
  
  return {
    service: '火山引擎TTS',
    required,
    optional,
    status,
    missingRequired,
    missingOptional
  };
}

function validateSeedreamConfig(): ConfigValidation {
  const required = ['ACCESS_KEY_ID', 'SECRET_ACCESS_KEY'];
  const optional = ['API_KEY', 'MODEL', 'BASE_URL'];
  
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  
  // 检查必需配置
  if (!environment.image.seeddream.accessKeyId) missingRequired.push('VOLCENGINE_ACCESS_KEY_ID');
  if (!environment.image.seeddream.secretAccessKey) missingRequired.push('VOLCENGINE_SECRET_ACCESS_KEY');
  
  // 检查可选配置
  if (!environment.image.seeddream.apiKey) missingOptional.push('SEEDREAM_API_KEY');
  if (!environment.image.seeddream.model) missingOptional.push('SEEDREAM_MODEL');
  
  let status: 'valid' | 'partial' | 'invalid' = 'valid';
  if (missingRequired.length > 0) {
    status = 'invalid';
  } else if (missingOptional.length > 0) {
    status = 'partial';
  }
  
  return {
    service: 'SeeDream 3.0',
    required,
    optional,
    status,
    missingRequired,
    missingOptional
  };
}

function displayValidationResult(validation: ConfigValidation): void {
  const statusIcon = {
    'valid': '✅',
    'partial': '⚠️',
    'invalid': '❌'
  };
  
  const statusText = {
    'valid': '配置完整',
    'partial': '部分配置',
    'invalid': '配置缺失'
  };
  
  console.log(`${statusIcon[validation.status]} ${validation.service}: ${statusText[validation.status]}`);
  
  if (validation.missingRequired.length > 0) {
    console.log(`   缺少必需配置: ${validation.missingRequired.join(', ')}`);
  }
  
  if (validation.missingOptional.length > 0) {
    console.log(`   缺少可选配置: ${validation.missingOptional.join(', ')}`);
  }
  
  console.log('');
}

function checkAccessKeyCredentials(): void {
  const accessKeyId = process.env.VOLCENGINE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.VOLCENGINE_SECRET_ACCESS_KEY;
  
  console.log('🔑 Access Key 凭证检查:');
  
  if (accessKeyId) {
    console.log(`✅ Access Key ID: ${accessKeyId.substring(0, 8)}...`);
  } else {
    console.log('❌ Access Key ID: 未配置');
  }
  
  if (secretAccessKey) {
    console.log(`✅ Secret Access Key: ${secretAccessKey.substring(0, 8)}...`);
  } else {
    console.log('❌ Secret Access Key: 未配置');
  }
  
  console.log('');
}

function generateConfigReport(): void {
  console.log('📋 火山引擎 API 配置报告\n');
  
  // 检查 Access Key 凭证
  checkAccessKeyCredentials();
  
  // 验证各服务配置
  const doubaoValidation = validateDoubaoConfig();
  const ttsValidation = validateVolcengineTTSConfig();
  const seedreamValidation = validateSeedreamConfig();
  
  const validations = [doubaoValidation, ttsValidation, seedreamValidation];
  
  // 显示验证结果
  console.log('🔍 服务配置验证:');
  validations.forEach(displayValidationResult);
  
  // 总结
  const validCount = validations.filter(v => v.status === 'valid').length;
  const partialCount = validations.filter(v => v.status === 'partial').length;
  const invalidCount = validations.filter(v => v.status === 'invalid').length;
  
  console.log('📊 配置状态总结:');
  console.log(`   ✅ 完整配置: ${validCount}/${validations.length}`);
  console.log(`   ⚠️  部分配置: ${partialCount}/${validations.length}`);
  console.log(`   ❌ 缺失配置: ${invalidCount}/${validations.length}`);
  
  if (invalidCount === 0) {
    console.log('\n🎉 所有服务配置验证通过！可以开始测试API连接。');
    console.log('💡 运行以下命令测试API连接:');
    console.log('   npm run test:volcengine-api');
  } else {
    console.log('\n⚠️  请先完成缺失的配置，然后重新运行验证。');
  }
  
  // 配置指南
  console.log('\n📖 配置指南:');
  console.log('1. 在火山引擎控制台获取 Access Key ID 和 Secret Access Key');
  console.log('2. 创建豆包模型实例获取端点ID (DOUBAO_ENDPOINT)');
  console.log('3. 创建TTS应用获取应用ID (VOLCENGINE_APP_ID)');
  console.log('4. 将配置填入 .env 文件');
}

// 运行配置验证
if (require.main === module) {
  try {
    generateConfigReport();
  } catch (error) {
    console.error('配置验证失败:', error);
    process.exit(1);
  }
}

export { validateDoubaoConfig, validateVolcengineTTSConfig, validateSeedreamConfig };