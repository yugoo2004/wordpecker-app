#!/usr/bin/env node

/**
 * 豆包 1.6 端点连接测试
 * 测试指定的豆包端点是否可以正常工作
 */

const axios = require('axios');
require('dotenv').config();

const config = {
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  endpoint: '/chat/completions',
  accessKeyId: process.env.VOLCENGINE_ACCESS_KEY_ID,
  secretAccessKey: process.env.VOLCENGINE_SECRET_ACCESS_KEY,
  model: process.env.DOUBAO_ENDPOINT || 'ep-20250826-doubao-16'
};

// 简化的签名函数（用于测试）
function createAuthHeaders() {
  const timestamp = Math.floor(Date.now() / 1000);
  
  return {
    'Authorization': `Bearer ${config.accessKeyId}`,
    'Content-Type': 'application/json',
    'User-Agent': 'WordPecker-Test/1.0'
  };
}

async function testDoubaoEndpoint() {
  console.log('🚀 测试豆包 1.6 端点连接...\n');
  
  console.log('📋 配置信息:');
  console.log(`   端点URL: ${config.baseURL}${config.endpoint}`);
  console.log(`   模型ID: ${config.model}`);
  console.log(`   Access Key: ${config.accessKeyId ? config.accessKeyId.substring(0, 8) + '...' : '未配置'}`);
  console.log('');

  const requestData = {
    model: config.model,
    messages: [
      {
        role: 'user',
        content: '你好，请简单回复一句话。'
      }
    ],
    max_tokens: 50,
    temperature: 0.7
  };

  try {
    const response = await axios.post(
      `${config.baseURL}${config.endpoint}`,
      requestData,
      {
        headers: createAuthHeaders(),
        timeout: 10000
      }
    );

    if (response.data && response.data.choices && response.data.choices[0]) {
      console.log('✅ 豆包 1.6 端点连接成功！');
      console.log(`📝 响应内容: ${response.data.choices[0].message.content}`);
      console.log(`🔧 模型: ${response.data.model}`);
      console.log(`📊 用量: ${JSON.stringify(response.data.usage)}`);
    } else {
      console.log('⚠️  响应格式异常:', response.data);
    }

  } catch (error) {
    console.log('❌ 豆包 1.6 端点连接失败');
    
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误信息: ${error.response.data?.error?.message || error.response.statusText}`);
      console.log(`   详细响应: ${JSON.stringify(error.response.data, null, 2)}`);
    } else if (error.request) {
      console.log(`   网络错误: ${error.message}`);
    } else {
      console.log(`   请求错误: ${error.message}`);
    }
    
    console.log('\n💡 可能的解决方案:');
    console.log('1. 检查端点ID是否正确配置');
    console.log('2. 确认Access Key权限是否足够');
    console.log('3. 验证网络连接是否正常');
    console.log('4. 检查模型ID格式是否正确');
  }
}

// 运行测试
testDoubaoEndpoint();