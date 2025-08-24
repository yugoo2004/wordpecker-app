#!/usr/bin/env tsx
/**
 * 国产AI服务测试脚本
 * 
 * Linus说：Talk is cheap, show me the code!
 * 这个脚本会测试所有配置的国产AI服务
 */

import { config } from 'dotenv';
import OpenAI from 'openai';

// 加载环境变量
config();

interface AIServiceTest {
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  client?: OpenAI;
}

// 定义要测试的服务
const servicesToTest: AIServiceTest[] = [
  {
    name: 'GLM (智谱AI)',
    provider: 'glm',
    apiKey: process.env.GLM_API_KEY || '',
    baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.GLM_TEXT_MODEL || 'glm-4.5'
  },
  {
    name: 'Moonshot AI',
    provider: 'moonshot',
    apiKey: process.env.MOONSHOT_API_KEY || process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1',
    model: process.env.MOONSHOT_MODEL || 'moonshot-v1-8k'
  },
  {
    name: 'Qwen (通义千问)',
    provider: 'qwen',
    apiKey: process.env.QWEN_API_KEY || '',
    baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: process.env.QWEN_MODEL || 'qwen-plus'
  },
  {
    name: 'MiniMax',
    provider: 'minimax',
    apiKey: process.env.MINIMAX_API_KEY || '',
    baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1',
    model: process.env.MINIMAX_MODEL || 'abab6.5s-chat'
  },
  {
    name: 'Baichuan (百川智能)',
    provider: 'baichuan',
    apiKey: process.env.BAICHUAN_API_KEY || '',
    baseUrl: process.env.BAICHUAN_BASE_URL || 'https://api.baichuan-ai.com/v1',
    model: process.env.BAICHUAN_MODEL || 'Baichuan2-Turbo'
  }
];

/**
 * 测试单个AI服务
 */
async function testAIService(service: AIServiceTest): Promise<boolean> {
  if (!service.apiKey) {
    console.log(`⚠️  ${service.name}: API Key 未配置，跳过测试`);
    return false;
  }

  try {
    console.log(`🧪 测试 ${service.name}...`);
    
    const client = new OpenAI({
      apiKey: service.apiKey,
      baseURL: service.baseUrl,
    });

    const response = await client.chat.completions.create({
      model: service.model,
      messages: [
        {
          role: 'user',
          content: '请用一句话说明你是什么AI模型，并生成一个简单的英语单词用于语言学习。'
        }
      ],
      max_tokens: 100,
      temperature: 0.7
    });

    const content = response.choices[0]?.message?.content;
    const usage = response.usage;

    console.log(`✅ ${service.name}: 测试成功`);
    console.log(`   📝 响应: ${content?.substring(0, 100)}...`);
    console.log(`   📊 Token使用: ${usage?.total_tokens || 'N/A'}`);
    console.log(`   🏷️  模型: ${response.model}`);
    
    return true;

  } catch (error: any) {
    console.log(`❌ ${service.name}: 测试失败`);
    console.log(`   💥 错误: ${error.message}`);
    if (error.response?.data) {
      console.log(`   📄 详情: ${JSON.stringify(error.response.data)}`);
    }
    return false;
  }
}

/**
 * 测试语音合成服务
 */
async function testVoiceServices(): Promise<void> {
  console.log('\n🎵 测试语音合成服务...\n');

  // 测试GLM语音
  if (process.env.GLM_API_KEY) {
    try {
      console.log('🧪 测试 GLM-4-voice...');
      
      // 注意：这里需要根据GLM的实际API调用方式调整
      const response = await fetch(`${process.env.GLM_BASE_URL}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GLM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.GLM_VOICE_MODEL || 'glm-4-voice',
          input: 'Hello, this is a test for voice synthesis.',
          voice: 'alloy'
        })
      });

      if (response.ok) {
        const audioSize = parseInt(response.headers.get('content-length') || '0');
        console.log(`✅ GLM-4-voice: 测试成功`);
        console.log(`   🎧 音频大小: ${audioSize} bytes`);
      } else {
        console.log(`❌ GLM-4-voice: HTTP ${response.status} ${response.statusText}`);
      }
    } catch (error: any) {
      console.log(`❌ GLM-4-voice: ${error.message}`);
    }
  } else {
    console.log('⚠️  GLM-4-voice: API Key 未配置');
  }

  // 可以在这里添加其他语音服务测试
}

/**
 * 主测试函数
 */
async function runTests(): Promise<void> {
  console.log('🐧 WordPecker 国产AI服务测试');
  console.log('=====================================');
  console.log('Linus说：Talk is cheap, show me the code!');
  console.log('现在让我们测试这些国产AI服务...\n');

  const results: Array<{ name: string; success: boolean }> = [];

  // 测试文本生成服务
  console.log('📝 测试文本生成服务...\n');
  
  for (const service of servicesToTest) {
    const success = await testAIService(service);
    results.push({ name: service.name, success });
    console.log(''); // 空行分隔
  }

  // 测试语音服务
  await testVoiceServices();

  // 输出总结
  console.log('\n📊 测试结果总结');
  console.log('=====================================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ 成功的服务 (${successful.length}/${results.length}):`);
  successful.forEach(r => console.log(`   - ${r.name}`));

  if (failed.length > 0) {
    console.log(`❌ 失败的服务 (${failed.length}/${results.length}):`);
    failed.forEach(r => console.log(`   - ${r.name}`));
  }

  // Linus风格的建议
  console.log('\n🐧 Linus的建议:');
  if (successful.length >= 2) {
    console.log('✅ 冗余机制可用 - 至少有两个服务可以工作');
  } else if (successful.length === 1) {
    console.log('⚠️  只有一个服务可用 - 建议配置更多API密钥');
  } else {
    console.log('❌ 没有服务可用 - 检查网络连接和API密钥配置');
  }

  console.log('\n记住：好的代码会说话，坏的代码需要解释。');
  console.log('这个冗余机制确保了你的应用的可靠性！');
}

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };