#!/usr/bin/env ts-node

/**
 * 可选功能测试脚本
 * 测试 ElevenLabs 语音合成、Pexels 图像搜索和音频播放缓存功能
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 加载环境变量
dotenv.config();

interface TestResult {
  feature: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

class OptionalFeaturesTest {
  private results: TestResult[] = [];

  /**
   * 记录测试结果
   */
  private logResult(feature: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any) {
    const result: TestResult = { feature, status, message, details };
    this.results.push(result);
    
    const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${statusIcon} ${feature}: ${message}`);
    
    if (details && status === 'FAIL') {
      console.log(`   详细信息: ${JSON.stringify(details, null, 2)}`);
    }
  }

  /**
   * 测试 ElevenLabs API 配置和连接
   */
  async testElevenLabsConfiguration(): Promise<void> {
    console.log('\n🎵 测试 ElevenLabs 语音合成功能...');
    
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey || apiKey === 'your_elevenlabs_api_key_here') {
      this.logResult('ElevenLabs 配置', 'SKIP', 'API 密钥未配置，跳过测试');
      return;
    }

    try {
      // 测试 API 连接
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`API 响应错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.logResult('ElevenLabs API 连接', 'PASS', `成功连接，获取到 ${data.voices?.length || 0} 个语音`);

      // 测试语音合成服务初始化
      try {
        const { elevenLabsService } = await import('../services/elevenlabs');
        
        // 测试获取可用语音
        const voices = await elevenLabsService.getAvailableVoices('en');
        this.logResult('ElevenLabs 服务初始化', 'PASS', `服务初始化成功，英语语音数量: ${voices.length}`);

        // 测试音频生成（短文本）
        const testText = 'Hello, this is a test.';
        const audioResult = await elevenLabsService.generateAudio({
          text: testText,
          language: 'en',
        });

        this.logResult('ElevenLabs 音频生成', 'PASS', `音频生成成功，缓存键: ${audioResult.cacheKey}`);

        // 验证缓存文件是否存在
        const cacheDir = path.join(process.cwd(), 'audio-cache');
        const cacheFile = path.join(cacheDir, `${audioResult.cacheKey}.mp3`);
        
        if (fs.existsSync(cacheFile)) {
          const stats = fs.statSync(cacheFile);
          this.logResult('音频缓存验证', 'PASS', `缓存文件存在，大小: ${stats.size} 字节`);
        } else {
          this.logResult('音频缓存验证', 'FAIL', '缓存文件不存在');
        }

      } catch (serviceError) {
        this.logResult('ElevenLabs 服务测试', 'FAIL', '服务初始化或测试失败', serviceError);
      }

    } catch (error) {
      this.logResult('ElevenLabs API 连接', 'FAIL', 'API 连接失败', error);
    }
  }

  /**
   * 测试 Pexels API 配置和图像搜索
   */
  async testPexelsConfiguration(): Promise<void> {
    console.log('\n🖼️ 测试 Pexels 图像搜索功能...');
    
    const apiKey = process.env.PEXELS_API_KEY;
    
    if (!apiKey || apiKey === 'your_pexels_api_key_here') {
      this.logResult('Pexels 配置', 'SKIP', 'API 密钥未配置，跳过测试');
      return;
    }

    try {
      // 测试 API 连接
      const testQuery = 'nature';
      const response = await fetch(`https://api.pexels.com/v1/search?query=${testQuery}&per_page=5`, {
        headers: {
          'Authorization': apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`API 响应错误: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.logResult('Pexels API 连接', 'PASS', `成功连接，搜索到 ${data.photos?.length || 0} 张图片`);

      // 测试图像搜索服务
      try {
        const { StockPhotoService } = await import('../api/image-description/stock-photo-service');
        const stockPhotoService = new StockPhotoService();

        const testContext = 'beautiful landscape with mountains';
        const result = await stockPhotoService.findStockImage(testContext);

        this.logResult('Pexels 图像搜索服务', 'PASS', `图像搜索成功，图片ID: ${result.id}`);
        this.logResult('Pexels 图像详情', 'PASS', `URL: ${result.url}, 描述: ${result.description.substring(0, 100)}...`);

      } catch (serviceError) {
        this.logResult('Pexels 服务测试', 'FAIL', '图像搜索服务测试失败', serviceError);
      }

    } catch (error) {
      this.logResult('Pexels API 连接', 'FAIL', 'API 连接失败', error);
    }
  }

  /**
   * 测试音频播放和缓存功能
   */
  async testAudioPlaybackAndCache(): Promise<void> {
    console.log('\n🔊 测试音频播放和缓存功能...');

    try {
      // 检查音频缓存目录
      const cacheDir = path.join(process.cwd(), 'audio-cache');
      
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        this.logResult('音频缓存目录', 'PASS', '缓存目录创建成功');
      } else {
        const files = fs.readdirSync(cacheDir);
        this.logResult('音频缓存目录', 'PASS', `缓存目录存在，包含 ${files.length} 个文件`);
      }

      // 如果 ElevenLabs 可用，测试音频缓存机制
      const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
      if (elevenLabsKey && elevenLabsKey !== 'your_elevenlabs_api_key_here') {
        try {
          const { elevenLabsService } = await import('../services/elevenlabs');

          // 生成测试音频
          const testText = 'Cache test audio';
          const result1 = await elevenLabsService.generateAudio({
            text: testText,
            language: 'en',
          });

          // 再次生成相同音频（应该从缓存获取）
          const startTime = Date.now();
          const result2 = await elevenLabsService.generateAudio({
            text: testText,
            language: 'en',
          });
          const cacheTime = Date.now() - startTime;

          if (result1.cacheKey === result2.cacheKey && cacheTime < 100) {
            this.logResult('音频缓存机制', 'PASS', `缓存命中，响应时间: ${cacheTime}ms`);
          } else {
            this.logResult('音频缓存机制', 'FAIL', '缓存未命中或响应时间过长');
          }

          // 测试缓存文件读取
          const cachedAudio = elevenLabsService.getCachedAudio(result1.cacheKey);
          if (cachedAudio && cachedAudio.length > 0) {
            this.logResult('缓存文件读取', 'PASS', `成功读取缓存文件，大小: ${cachedAudio.length} 字节`);
          } else {
            this.logResult('缓存文件读取', 'FAIL', '无法读取缓存文件');
          }

        } catch (error) {
          this.logResult('音频缓存测试', 'FAIL', '音频缓存功能测试失败', error);
        }
      } else {
        this.logResult('音频缓存测试', 'SKIP', 'ElevenLabs 未配置，跳过音频缓存测试');
      }

      // 测试音频路由端点（需要服务器运行）
      try {
        const response = await fetch('http://localhost:3000/api/audio/voices');
        if (response.ok) {
          const data = await response.json();
          this.logResult('音频 API 端点', 'PASS', `语音列表端点正常，返回 ${data.data?.voices?.length || 0} 个语音`);
        } else {
          this.logResult('音频 API 端点', 'FAIL', `API 端点响应错误: ${response.status}`);
        }
      } catch (error) {
        this.logResult('音频 API 端点', 'SKIP', '服务器未运行，跳过 API 端点测试');
      }

    } catch (error) {
      this.logResult('音频播放缓存', 'FAIL', '音频播放和缓存功能测试失败', error);
    }
  }

  /**
   * 测试前端音频播放组件
   */
  async testFrontendAudioComponents(): Promise<void> {
    console.log('\n🎧 检查前端音频播放组件...');

    try {
      // 检查音频播放器组件
      const audioPlayerPath = path.join(process.cwd(), '../frontend/src/components/AudioPlayer.tsx');
      if (fs.existsSync(audioPlayerPath)) {
        this.logResult('AudioPlayer 组件', 'PASS', '音频播放器组件文件存在');
      } else {
        this.logResult('AudioPlayer 组件', 'FAIL', '音频播放器组件文件不存在');
      }

      // 检查发音按钮组件
      const pronunciationButtonPath = path.join(process.cwd(), '../frontend/src/components/PronunciationButton.tsx');
      if (fs.existsSync(pronunciationButtonPath)) {
        this.logResult('PronunciationButton 组件', 'PASS', '发音按钮组件文件存在');
      } else {
        this.logResult('PronunciationButton 组件', 'FAIL', '发音按钮组件文件不存在');
      }

      // 检查前端 API 服务
      const apiServicePath = path.join(process.cwd(), '../frontend/src/services/api.ts');
      if (fs.existsSync(apiServicePath)) {
        const apiContent = fs.readFileSync(apiServicePath, 'utf-8');
        if (apiContent.includes('audio') || apiContent.includes('pronunciation')) {
          this.logResult('前端 API 服务', 'PASS', '前端包含音频相关 API 调用');
        } else {
          this.logResult('前端 API 服务', 'FAIL', '前端缺少音频相关 API 调用');
        }
      } else {
        this.logResult('前端 API 服务', 'FAIL', '前端 API 服务文件不存在');
      }

    } catch (error) {
      this.logResult('前端音频组件', 'FAIL', '前端音频组件检查失败', error);
    }
  }

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<void> {
    console.log('🧪 开始可选功能测试...\n');
    console.log('=' .repeat(60));

    await this.testElevenLabsConfiguration();
    await this.testPexelsConfiguration();
    await this.testAudioPlaybackAndCache();
    await this.testFrontendAudioComponents();

    console.log('\n' + '=' .repeat(60));
    console.log('📊 测试结果汇总:');
    console.log('=' .repeat(60));

    const passCount = this.results.filter(r => r.status === 'PASS').length;
    const failCount = this.results.filter(r => r.status === 'FAIL').length;
    const skipCount = this.results.filter(r => r.status === 'SKIP').length;

    console.log(`✅ 通过: ${passCount}`);
    console.log(`❌ 失败: ${failCount}`);
    console.log(`⏭️ 跳过: ${skipCount}`);
    console.log(`📈 总计: ${this.results.length}`);

    if (failCount > 0) {
      console.log('\n❌ 失败的测试:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   - ${r.feature}: ${r.message}`));
    }

    if (skipCount > 0) {
      console.log('\n⏭️ 跳过的测试:');
      this.results
        .filter(r => r.status === 'SKIP')
        .forEach(r => console.log(`   - ${r.feature}: ${r.message}`));
    }

    console.log('\n🎯 建议:');
    if (skipCount > 0) {
      console.log('   - 配置跳过的 API 密钥以启用完整功能');
      console.log('   - ElevenLabs: 语音合成和发音功能');
      console.log('   - Pexels: Vision Garden 图像搜索功能');
    }
    if (failCount === 0) {
      console.log('   - 所有已配置的可选功能工作正常！');
    }

    console.log('\n✨ 测试完成！');
  }
}

// 运行测试
if (require.main === module) {
  const tester = new OptionalFeaturesTest();
  tester.runAllTests().catch(console.error);
}

export { OptionalFeaturesTest };