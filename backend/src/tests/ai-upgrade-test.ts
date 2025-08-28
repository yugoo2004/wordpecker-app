/**
 * AI模型替换升级测试套件
 * 验证豆包1.6、火山引擎TTS、SeeDream 3.0的集成和功能
 */

import { getDoubaoService } from '../services/doubao-service';
import { getVolcengineTTSService } from '../services/volcengine-tts-service';
import { getSeedreamImageService } from '../services/seedream-image-service';
import { createChatCompletion, generateSpeech, generateImage, getAllServiceStatus } from '../config/ai-service';
import { vocabularyAgent } from '../agents/vocabulary-agent';
import { definitionAgent } from '../agents/definition-agent';
import { examplesAgent } from '../agents/examples-agent';
import { quizAgent } from '../agents/quiz-agent';
import { imageGenerationAgent } from '../agents/image-generation-agent';
import { languageValidationAgent } from '../agents/language-validation-agent';
import { logger } from '../config/logger';

/**
 * 测试结果接口
 */
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

/**
 * 测试套件类
 */
export class AIUpgradeTestSuite {
  private results: TestResult[] = [];

  /**
   * 运行所有测试
   */
  async runAllTests(): Promise<{ 
    total: number; 
    passed: number; 
    failed: number; 
    results: TestResult[];
    summary: string;
  }> {
    logger.info('🧪 开始AI模型替换升级测试套件');

    // 基础服务测试
    await this.testDoubaoService();
    await this.testVolcengineTTSService();
    await this.testSeedreamImageService();

    // 集成服务测试
    await this.testIntegratedTextService();
    await this.testIntegratedVoiceService();
    await this.testIntegratedImageService();

    // 代理测试
    await this.testVocabularyAgent();
    await this.testDefinitionAgent();
    await this.testExamplesAgent();
    await this.testQuizAgent();
    await this.testImageGenerationAgent();
    await this.testLanguageValidationAgent();

    // 性能和稳定性测试
    await this.testServicePerformance();
    await this.testServiceStatus();

    // 生成测试报告
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.length - passed;
    
    const summary = this.generateTestSummary();
    
    logger.info('🧪 AI模型替换升级测试完成', {
      total: this.results.length,
      passed,
      failed
    });

    return {
      total: this.results.length,
      passed,
      failed,
      results: this.results,
      summary
    };
  }

  /**
   * 测试豆包1.6服务
   */
  private async testDoubaoService(): Promise<void> {
    await this.runTest('豆包1.6文本生成服务', async () => {
      const doubaoService = getDoubaoService();
      
      // 测试基本聊天完成
      const response = await doubaoService.createChatCompletion([
        { role: 'user', content: '请简单介绍一下WordPecker应用' }
      ], {
        temperature: 0.7,
        max_tokens: 100
      });

      if (!response.choices || !response.choices[0]?.message?.content) {
        throw new Error('豆包服务未返回有效响应');
      }

      // 验证响应质量
      const content = response.choices[0].message.content;
      if (content.length < 20) {
        throw new Error('豆包服务响应内容太短');
      }

      return {
        responseLength: content.length,
        tokensUsed: response.usage?.total_tokens,
        model: response.model
      };
    });
  }

  /**
   * 测试火山引擎TTS服务
   */
  private async testVolcengineTTSService(): Promise<void> {
    await this.runTest('火山引擎TTS语音合成服务', async () => {
      const ttsService = getVolcengineTTSService();
      
      // 测试中文语音合成
      const audioBuffer = await ttsService.generateSpeech('你好，这是WordPecker语音测试', {
        voice: 'BV700_streaming',
        speed: 1.0,
        language: 'zh',
        encoding: 'mp3'
      });

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('火山引擎TTS未生成有效音频');
      }

      // 验证音频格式（MP3文件头）
      const header = audioBuffer.subarray(0, 3);
      const isMP3 = header[0] === 0xFF && (header[1] & 0xE0) === 0xE0;
      
      if (!isMP3) {
        throw new Error('生成的音频格式不正确');
      }

      return {
        audioSize: audioBuffer.length,
        format: 'mp3',
        duration: Math.round(audioBuffer.length / 1000) // 估算时长
      };
    });
  }

  /**
   * 测试SeeDream 3.0图像生成服务
   */
  private async testSeedreamImageService(): Promise<void> {
    await this.runTest('SeeDream 3.0图像生成服务', async () => {
      const imageService = getSeedreamImageService();
      
      // 测试词汇图像生成
      const imageResult = await imageService.generateVocabularyImage(
        'library',
        'A place where books are stored and people study',
        {
          size: '512x512',
          quality: 'standard',
          style: 'natural'
        }
      );

      if (!imageResult || (!imageResult.url && !imageResult.buffer)) {
        throw new Error('SeeDream 3.0未生成有效图像');
      }

      // 验证图像URL（如果存在）
      if (imageResult.url && !imageResult.url.startsWith('http')) {
        throw new Error('图像URL格式不正确');
      }

      return {
        hasUrl: !!imageResult.url,
        hasBuffer: !!imageResult.buffer,
        size: imageResult.metadata?.size,
        quality: imageResult.metadata?.quality,
        generatedAt: imageResult.metadata?.generatedAt
      };
    });
  }

  /**
   * 测试集成文本服务
   */
  private async testIntegratedTextService(): Promise<void> {
    await this.runTest('集成文本生成服务', async () => {
      const response = await createChatCompletion([
        { role: 'user', content: '解释一下机器学习的基本概念' }
      ], {
        temperature: 0.5,
        max_tokens: 200
      });

      if (!response.choices?.[0]?.message?.content) {
        throw new Error('集成文本服务未返回有效响应');
      }

      return {
        content: response.choices[0].message.content.substring(0, 100) + '...',
        tokensUsed: response.usage?.total_tokens,
        provider: 'doubao' // 默认提供商
      };
    });
  }

  /**
   * 测试集成语音服务
   */
  private async testIntegratedVoiceService(): Promise<void> {
    await this.runTest('集成语音生成服务', async () => {
      const audioBuffer = await generateSpeech('这是集成语音服务测试', {
        voice: 'BV700_streaming',
        speed: 1.0,
        language: 'zh',
        encoding: 'mp3'
      });

      if (!audioBuffer || audioBuffer.length === 0) {
        throw new Error('集成语音服务未生成有效音频');
      }

      return {
        audioSize: audioBuffer.length,
        provider: 'volcengine'
      };
    });
  }

  /**
   * 测试集成图像服务
   */
  private async testIntegratedImageService(): Promise<void> {
    await this.runTest('集成图像生成服务', async () => {
      const imageResult = await generateImage('A beautiful garden with flowers', {
        size: '512x512',
        quality: 'standard'
      });

      if (!imageResult) {
        throw new Error('集成图像服务未生成有效图像');
      }

      return {
        hasResult: true,
        provider: 'seeddream'
      };
    });
  }

  /**
   * 测试词汇代理
   */
  private async testVocabularyAgent(): Promise<void> {
    await this.runTest('词汇代理', async () => {
      const result = await vocabularyAgent.run('Generate vocabulary for kitchen');

      if (!result.finalOutput) {
        throw new Error('词汇代理未返回有效输出');
      }

      return {
        hasOutput: true,
        tokensUsed: result.tokensUsed,
        messagesCount: result.messages?.length
      };
    });
  }

  /**
   * 测试定义代理
   */
  private async testDefinitionAgent(): Promise<void> {
    await this.runTest('定义代理', async () => {
      const result = await definitionAgent.run('Define the word "resilience"', {
        includeVoice: true // 测试语音功能
      });

      if (!result.finalOutput) {
        throw new Error('定义代理未返回有效输出');
      }

      return {
        hasOutput: true,
        hasAudio: !!result.audioBuffer,
        tokensUsed: result.tokensUsed
      };
    });
  }

  /**
   * 测试例句代理
   */
  private async testExamplesAgent(): Promise<void> {
    await this.runTest('例句代理', async () => {
      const result = await examplesAgent.run('Provide examples for "innovation"');

      if (!result.finalOutput) {
        throw new Error('例句代理未返回有效输出');
      }

      return {
        hasOutput: true,
        tokensUsed: result.tokensUsed
      };
    });
  }

  /**
   * 测试测验代理
   */
  private async testQuizAgent(): Promise<void> {
    await this.runTest('测验代理', async () => {
      const result = await quizAgent.run('Create a quiz about science vocabulary');

      if (!result.finalOutput) {
        throw new Error('测验代理未返回有效输出');
      }

      return {
        hasOutput: true,
        tokensUsed: result.tokensUsed
      };
    });
  }

  /**
   * 测试图像生成代理
   */
  private async testImageGenerationAgent(): Promise<void> {
    await this.runTest('图像生成代理', async () => {
      const result = await imageGenerationAgent.run('Generate an image for teaching colors', {
        includeImage: true
      });

      if (!result.finalOutput) {
        throw new Error('图像生成代理未返回有效输出');
      }

      return {
        hasOutput: true,
        hasImage: !!result.imageResult,
        tokensUsed: result.tokensUsed
      };
    });
  }

  /**
   * 测试语言验证代理
   */
  private async testLanguageValidationAgent(): Promise<void> {
    await this.runTest('语言验证代理', async () => {
      const result = await languageValidationAgent.run('Validate if "bonjour" is French');

      if (!result.finalOutput) {
        throw new Error('语言验证代理未返回有效输出');
      }

      return {
        hasOutput: true,
        tokensUsed: result.tokensUsed
      };
    });
  }

  /**
   * 测试服务性能
   */
  private async testServicePerformance(): Promise<void> {
    await this.runTest('服务性能测试', async () => {
      const startTime = Date.now();
      
      // 并发测试
      const promises = [
        createChatCompletion([{ role: 'user', content: '测试1' }]),
        createChatCompletion([{ role: 'user', content: '测试2' }]),
        createChatCompletion([{ role: 'user', content: '测试3' }])
      ];

      await Promise.all(promises);
      
      const duration = Date.now() - startTime;

      return {
        concurrentRequests: 3,
        totalDuration: duration,
        averageDuration: duration / 3
      };
    });
  }

  /**
   * 测试服务状态
   */
  private async testServiceStatus(): Promise<void> {
    await this.runTest('服务状态检查', async () => {
      const status = await getAllServiceStatus();

      return {
        textService: status.text?.available || false,
        voiceService: status.voice?.available || false,
        imageService: status.image?.available || false
      };
    });
  }

  /**
   * 运行单个测试
   */
  private async runTest(name: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`🧪 运行测试: ${name}`);
      const details = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        passed: true,
        duration,
        details
      });
      
      logger.info(`✅ 测试通过: ${name} (${duration}ms)`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        name,
        passed: false,
        duration,
        error: error.message
      });
      
      logger.error(`❌ 测试失败: ${name} (${duration}ms)`, { error: error.message });
    }
  }

  /**
   * 生成测试总结
   */
  private generateTestSummary(): string {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.length - passed;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    let summary = `\n🧪 AI模型替换升级测试报告\n`;
    summary += `═══════════════════════════════\n`;
    summary += `总测试数: ${this.results.length}\n`;
    summary += `通过: ${passed} ✅\n`;
    summary += `失败: ${failed} ❌\n`;
    summary += `总耗时: ${totalDuration}ms\n`;
    summary += `平均耗时: ${Math.round(totalDuration / this.results.length)}ms\n\n`;

    if (failed > 0) {
      summary += `失败的测试:\n`;
      this.results.filter(r => !r.passed).forEach(result => {
        summary += `❌ ${result.name}: ${result.error}\n`;
      });
      summary += `\n`;
    }

    summary += `测试详情:\n`;
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      summary += `${status} ${result.name} (${result.duration}ms)\n`;
    });

    return summary;
  }
}

/**
 * 运行测试的便捷函数
 */
export async function runAIUpgradeTests(): Promise<void> {
  const testSuite = new AIUpgradeTestSuite();
  const results = await testSuite.runAllTests();
  
  console.log(results.summary);
  
  if (results.failed > 0) {
    process.exit(1);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  runAIUpgradeTests().catch(console.error);
}