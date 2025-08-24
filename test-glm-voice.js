const OpenAI = require('openai');

// 测试 GLM 语音服务
async function testGLMVoice() {
  console.log('🎵 测试 GLM 语音服务...');
  
  try {
    const client = new OpenAI({
      apiKey: 'sk-ixZw7GxPyP8DTZs11HnnzhNcvxMNkqpb5eNcijaiWXvtmCjD',
      baseURL: 'https://api.moonshot.cn/v1'
    });
    
    console.log('1. 创建语音请求...');
    const response = await client.audio.speech.create({
      model: 'tts-1',
      input: 'Hello, this is a test.',
      voice: 'alloy',
      speed: 1.0,
      response_format: 'mp3'
    });
    
    console.log('2. 获取音频数据...');
    const buffer = Buffer.from(await response.arrayBuffer());
    
    console.log('✅ GLM 语音服务测试成功!');
    console.log(`音频大小: ${buffer.length} bytes`);
    
    return true;
  } catch (error) {
    console.error('❌ GLM 语音服务测试失败:', error.message);
    return false;
  }
}

// 运行测试
testGLMVoice();