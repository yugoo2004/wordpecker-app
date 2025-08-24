#!/usr/bin/env node

// 测试音频功能是否修复
const fetch = require('node-fetch');

async function testAudioGeneration() {
  console.log('🎵 测试音频生成功能...');
  
  try {
    // 测试单词发音
    console.log('1. 测试单词发音...');
    const wordResponse = await fetch('http://localhost:3000/api/audio/word-pronunciation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        word: 'hello',
        language: 'en'
      })
    });
    
    const wordResult = await wordResponse.json();
    console.log('单词发音结果:', wordResult.success ? '✅ 成功' : '❌ 失败');
    if (!wordResult.success) {
      console.log('错误:', wordResult.error);
    }
    
    // 测试句子发音
    console.log('2. 测试句子发音...');
    const sentenceResponse = await fetch('http://localhost:3000/api/audio/sentence-pronunciation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sentence: 'Hello, how are you?',
        language: 'en'
      })
    });
    
    const sentenceResult = await sentenceResponse.json();
    console.log('句子发音结果:', sentenceResult.success ? '✅ 成功' : '❌ 失败');
    if (!sentenceResult.success) {
      console.log('错误:', sentenceResult.error);
    }
    
    // 测试语音列表
    console.log('3. 测试语音列表...');
    const voicesResponse = await fetch('http://localhost:3000/api/audio/voices?language=en');
    const voicesResult = await voicesResponse.json();
    console.log('语音列表结果:', voicesResult.success ? '✅ 成功' : '❌ 失败');
    if (voicesResult.success) {
      console.log('可用语音:', voicesResult.data.length, '个');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testAudioGeneration();