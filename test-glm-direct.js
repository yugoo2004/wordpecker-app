// 直接测试 GLM-4-Voice API
async function testGLMDirect() {
  console.log('🎵 测试 GLM-4-Voice API...');
  
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer 57d079be8ea84238a6cce525d495fdc7.vX0NpsrKNemXcSNK',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4-voice',
        messages: [
          {
            role: 'user',
            content: 'Hello world'
          }
        ]
      })
    });
    
    console.log('HTTP 状态:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('错误响应:', errorText);
      return false;
    }
    
    const buffer = await response.arrayBuffer();
    console.log('✅ GLM 语音 API 测试成功!');
    console.log(`音频大小: ${buffer.byteLength} bytes`);
    
    return true;
  } catch (error) {
    console.error('❌ GLM 语音 API 测试失败:', error.message);
    return false;
  }
}

// 运行测试
testGLMDirect();