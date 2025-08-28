#!/usr/bin/env node

/**
 * 豆包 ARK API 测试脚本
 * 测试您提供的豆包1.6多模态API调用示例
 */

const axios = require('axios');
require('dotenv').config();

const config = {
  baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
  apiKey: process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY || process.env.VOLCENGINE_ACCESS_KEY_ID,
  model: 'doubao-seed-1-6-250615'
};

async function testDoubaoARKAPI() {
  console.log('🚀 测试豆包 ARK API (根据您的示例)...\n');
  
  console.log('📋 配置信息:');
  console.log(`   API端点: ${config.baseURL}/chat/completions`);
  console.log(`   模型: ${config.model}`);
  console.log(`   API Key: ${config.apiKey ? config.apiKey.substring(0, 8) + '...' : '未配置'}`);
  console.log('');

  if (!config.apiKey) {
    console.log('❌ 错误：未找到API Key');
    console.log('请设置以下环境变量之一：');
    console.log('  - ARK_API_KEY');
    console.log('  - DOUBAO_API_KEY');
    console.log('  - VOLCENGINE_ACCESS_KEY_ID');
    return;
  }

  // 测试文本对话
  console.log('📝 测试1: 文本对话');
  try {
    const textResponse = await axios.post(
      `${config.baseURL}/chat/completions`,
      {
        model: config.model,
        messages: [
          {
            role: 'user',
            content: '你好，请简单介绍一下自己。'
          }
        ],
        max_tokens: 100,
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        timeout: 10000
      }
    );

    if (textResponse.data && textResponse.data.choices && textResponse.data.choices[0]) {
      console.log('✅ 文本对话测试成功！');
      console.log(`📝 回复: ${textResponse.data.choices[0].message.content}`);
      console.log(`🔧 模型: ${textResponse.data.model}`);
      console.log(`📊 用量: ${JSON.stringify(textResponse.data.usage)}`);
    } else {
      console.log('⚠️  响应格式异常:', textResponse.data);
    }
  } catch (error) {
    console.log('❌ 文本对话测试失败');
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误信息: ${error.response.data?.error?.message || error.response.statusText}`);
    } else {
      console.log(`   错误: ${error.message}`);
    }
  }

  console.log('');

  // 测试多模态对话（您的示例）
  console.log('🎨 测试2: 多模态对话（图像+文本）');
  try {
    const multiModalResponse = await axios.post(
      `${config.baseURL}/chat/completions`,
      {
        model: config.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: 'https://ark-project.tos-cn-beijing.ivolces.com/images/view.jpeg'
                }
              },
              {
                type: 'text',
                text: '图片主要讲了什么?'
              }
            ]
          }
        ],
        max_tokens: 200,
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        timeout: 15000
      }
    );

    if (multiModalResponse.data && multiModalResponse.data.choices && multiModalResponse.data.choices[0]) {
      console.log('✅ 多模态对话测试成功！');
      console.log(`📝 图像分析结果: ${multiModalResponse.data.choices[0].message.content}`);
      console.log(`🔧 模型: ${multiModalResponse.data.model}`);
      console.log(`📊 用量: ${JSON.stringify(multiModalResponse.data.usage)}`);
    } else {
      console.log('⚠️  响应格式异常:', multiModalResponse.data);
    }
  } catch (error) {
    console.log('❌ 多模态对话测试失败');
    if (error.response) {
      console.log(`   状态码: ${error.response.status}`);
      console.log(`   错误信息: ${error.response.data?.error?.message || error.response.statusText}`);
    } else {
      console.log(`   错误: ${error.message}`);
    }
  }

  console.log('\n💡 测试结果:');
  console.log('如果测试成功，说明您的ARK API Key配置正确！');
  console.log('如果测试失败，请检查：');
  console.log('1. ARK_API_KEY环境变量是否正确设置');
  console.log('2. API Key是否有效且有足够的配额');
  console.log('3. 网络连接是否正常');
}

// 运行测试
testDoubaoARKAPI();