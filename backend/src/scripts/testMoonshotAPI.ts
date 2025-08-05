import { openai } from '../config/openai';
import { environment } from '../config/environment';

async function testMoonshotAPI() {
  console.log('🌙 测试 Moonshot API 连接...');
  console.log('API 密钥:', environment.openai.apiKey);
  console.log('Base URL:', environment.openai.baseUrl);
  console.log('模型:', environment.openai.model);
  
  try {
    // 测试简单的聊天完成请求
    console.log('\n📡 发送测试请求...');
    const response = await openai.chat.completions.create({
      model: environment.openai.model,
      messages: [
        {
          role: 'user',
          content: '你好，请回复"API连接成功"'
        }
      ],
      max_tokens: 50
    });

    console.log('✅ API 请求成功！');
    console.log('响应内容:', response.choices[0]?.message?.content);
    console.log('使用的模型:', response.model);
    console.log('Token 使用情况:', response.usage);
    
  } catch (error) {
    console.error('❌ API 请求失败:', error);
    if (error instanceof Error) {
      console.error('错误信息:', error.message);
    }
  }
}

testMoonshotAPI();