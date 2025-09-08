import OpenAI from 'openai';
import { environment } from './environment';
import { logger } from './logger';

// 语音服务提供商类型 - 扩展国产化支持
export type VoiceProvider = 'volcengine' | 'glm' | 'minimax' | 'doubao' | 'elevenlabs';

// 语音服务配置接口
interface VoiceServiceConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  provider: VoiceProvider;
}

// GLM、火山引擎和 ElevenLabs 的配置
const VOICE_CONFIGS: Record<VoiceProvider, VoiceServiceConfig> = {
  volcengine: {
    apiKey: environment.voice.volcengine?.apiKey || '',
    baseUrl: environment.voice.volcengine?.baseUrl || 'https://openspeech.bytedance.com',
    model: environment.voice.volcengine?.appId || '624a6f3b-6beb-434e-9f2a-e3318de955fa',
    provider: 'volcengine'
  },
  glm: {
    apiKey: environment.voice.glm.apiKey,
    baseUrl: environment.voice.glm.baseUrl,
    model: environment.voice.glm.model,
    provider: 'glm'
  },
  elevenlabs: {
    apiKey: environment.voice.elevenlabs.apiKey || '',
    provider: 'elevenlabs'
  },
  doubao: {
    apiKey: environment.ai?.doubao?.apiKey || '',
    baseUrl: environment.ai?.doubao?.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3',
    model: environment.ai?.doubao?.model || 'doubao-seed-1-6-250615',
    provider: 'doubao'
  },
  minimax: {
    apiKey: environment.ai?.minimax?.apiKey || '',
    baseUrl: environment.ai?.minimax?.baseUrl || 'https://api.minimax.chat/v1',
    model: environment.ai?.minimax?.model || 'abab6.5s-chat',
    provider: 'minimax'
  }
};

// 语音服务管理器
class VoiceServiceManager {
  private glmClient: OpenAI | null = null;
  private currentProvider: VoiceProvider = 'volcengine'; // 默认优先使用火山引擎
  private failedProviders: Set<VoiceProvider> = new Set();
  private lastFailureTime: Map<VoiceProvider, number> = new Map();
  private readonly FAILURE_COOLDOWN = 5 * 60 * 1000; // 5分钟冷却时间

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    // 检查火山引擎配置
    const volcengineConfig = VOICE_CONFIGS.volcengine;
    if (volcengineConfig.apiKey) {
      logger.info('火山引擎语音服务配置已加载', {
        provider: 'volcengine',
        baseUrl: volcengineConfig.baseUrl,
        appId: volcengineConfig.model
      });
    } else {
      logger.warn('火山引擎 API Key 未配置');
    }

    // 检查 GLM 配置
    const glmConfig = VOICE_CONFIGS.glm;
    if (glmConfig.apiKey) {
      logger.info('GLM 语音服务配置已加载', {
        provider: 'glm',
        baseUrl: glmConfig.baseUrl,
        model: glmConfig.model
      });
    } else {
      logger.warn('GLM API Key 未配置');
    }

    // 检查 ElevenLabs 配置
    const elevenlabsConfig = VOICE_CONFIGS.elevenlabs;
    if (elevenlabsConfig.apiKey) {
      logger.info('ElevenLabs 语音服务配置已加载');
    } else {
      logger.warn('ElevenLabs API Key 未配置，将仅使用国内语音服务');
    }
  }

  // 检查冷却时间，重置已恢复的服务
  private checkCooldownRecovery(): void {
    const now = Date.now();
    for (const provider of this.failedProviders) {
      const lastFailure = this.lastFailureTime.get(provider);
      if (lastFailure && (now - lastFailure) > this.FAILURE_COOLDOWN) {
        this.failedProviders.delete(provider);
        this.lastFailureTime.delete(provider);
        logger.info(`语音服务提供商已从失败列表中恢复: ${provider}`);
      }
    }
  }

  // 标记服务提供商为失败状态
  private markProviderAsFailed(provider: VoiceProvider, error: any): void {
    this.failedProviders.add(provider);
    this.lastFailureTime.set(provider, Date.now());
    logger.error(`语音服务提供商标记为失败: ${provider}`, {
      error: (error instanceof Error ? error.message : String(error)) || error,
      provider,
      cooldownMinutes: this.FAILURE_COOLDOWN / 60000
    });
  }

  // 使用 GLM-4-voice 生成语音（真实实现）
  async generateSpeechWithGLM(
    text: string,
    options: {
      voice?: string;
      speed?: number;
      format?: 'mp3' | 'wav';
    } = {}
  ): Promise<Buffer> {
    const config = VOICE_CONFIGS.glm;
    
    if (!config.apiKey) {
      throw new Error('GLM API Key 未配置');
    }

    try {
      logger.info('使用 GLM-4-voice 生成语音', {
        provider: 'glm',
        model: config.model,
        textLength: text.length
      });

      // 构建请求参数
      const requestBody = {
        model: config.model,
        input: {
          text: text
        },
        voice: {
          model: config.model,
          voice_id: options.voice || 'alloy'
        },
        audio: {
          format: options.format || 'mp3',
          speed: options.speed || 1.0
        }
      };

      // 调用 GLM-4-voice API
      const response = await fetch(`${config.baseUrl}/voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`GLM API 错误: ${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      
      logger.info('GLM 语音生成成功', {
        provider: 'glm',
        audioSize: buffer.length
      });

      return buffer;

    } catch (error: any) {
      this.markProviderAsFailed('glm', error);
      throw error;
    }
  }

  // 使用火山引擎生成语音（首选方案）
  async generateSpeechWithVolcEngine(
    text: string,
    options: {
      voice?: string;
      speed?: number;
      language?: string;
    } = {}
  ): Promise<Buffer> {
    const config = VOICE_CONFIGS.volcengine;
    
    if (!config.apiKey) {
      throw new Error('火山引擎 API Key 未配置');
    }

    try {
      logger.info('使用火山引擎生成语音', {
        provider: 'volcengine',
        textLength: text.length,
        appId: config.model
      });

      // 火山引擎TTS API请求体
      const requestBody = {
        app: {
          appid: config.model,
          token: config.apiKey,
          cluster: 'volcano_tts'
        },
        user: {
          uid: `wordpecker_${Date.now()}`
        },
        audio: {
          voice_type: this.getVolcEngineVoice(options.voice, options.language),
          encoding: "mp3",
          speed_ratio: options.speed || 1.0,
          volume_ratio: 1.0,
          pitch_ratio: 1.0,
          emotion: "neutral"
        },
        request: {
          reqid: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          text: text,
          text_type: "plain",
          operation: "submit"
        }
      };

      // 提交TTS请求
      const submitResponse = await fetch(`${config.baseUrl}/api/v1/tts/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!submitResponse.ok) {
        throw new Error(`火山引擎TTS提交失败: ${submitResponse.status} ${submitResponse.statusText}`);
      }

      const submitResult = await submitResponse.json();
      
      if (submitResult.code !== 0) {
        throw new Error(`火山引擎TTS错误: ${submitResult.message}`);
      }

      // 查询结果
      const queryBody = {
        ...requestBody,
        request: {
          ...requestBody.request,
          operation: "query"
        }
      };

      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
        
        const queryResponse = await fetch(`${config.baseUrl}/api/v1/tts/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify(queryBody)
        });

        if (!queryResponse.ok) {
          attempts++;
          continue;
        }

        const queryResult = await queryResponse.json();
        
        if (queryResult.code === 0 && queryResult.data?.audio) {
          // 解码base64音频数据
          const audioBuffer = Buffer.from(queryResult.data.audio, 'base64');
          
          logger.info('火山引擎语音生成成功', {
            provider: 'volcengine',
            audioSize: audioBuffer.length,
            attempts: attempts + 1
          });

          return audioBuffer;
        }
        
        if (queryResult.code === 10001) {
          // 仍在处理中，继续等待
          attempts++;
          continue;
        }
        
        throw new Error(`火山引擎TTS查询失败: ${queryResult.message}`);
      }
      
      throw new Error('火山引擎TTS处理超时');

    } catch (error: any) {
      this.markProviderAsFailed('volcengine', error);
      throw error;
    }
  }

  // 根据语言选择合适的音色
  private getVolcEngineVoice(requestedVoice?: string, language?: string): string {
    // 火山引擎支持的音色映射
    const voiceMap: Record<string, string> = {
      'zh': 'BV700_streaming',      // 中文女声
      'zh-CN': 'BV700_streaming',
      'en': 'BV001_streaming',      // 英文女声
      'en-US': 'BV001_streaming',
      'ja': 'BV002_streaming',      // 日文女声
      'ko': 'BV003_streaming',      // 韩文女声
    };
    
    if (requestedVoice) {
      return requestedVoice;
    }
    
    return voiceMap[language || 'zh'] || 'BV700_streaming';
  }

  // 使用 ElevenLabs 生成语音 (备选方案)
  async generateSpeechWithElevenLabs(
    text: string,
    options: {
      voiceId?: string;
      stability?: number;
      similarityBoost?: number;
    } = {}
  ): Promise<Buffer> {
    const config = VOICE_CONFIGS.elevenlabs;
    
    if (!config.apiKey) {
      throw new Error('ElevenLabs API Key 未配置');
    }

    try {
      logger.info('使用 ElevenLabs 生成语音', {
        provider: 'elevenlabs',
        textLength: text.length
      });

      const voiceId = options.voiceId || 'pNInz6obpgDQGcFmaJgB'; // 默认语音ID
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': config.apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: options.stability || 0.5,
            similarity_boost: options.similarityBoost || 0.5
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API 错误: ${response.status} ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      
      logger.info('ElevenLabs 语音生成成功', {
        provider: 'elevenlabs',
        audioSize: buffer.length
      });

      return buffer;

    } catch (error: any) {
      this.markProviderAsFailed('elevenlabs', error);
      throw error;
    }
  }

  // 生成语音，带有自动故障转移
  async generateSpeech(
    text: string,
    options: {
      voice?: string;
      speed?: number;
      format?: 'mp3' | 'wav';
      voiceId?: string; // ElevenLabs 专用
      stability?: number; // ElevenLabs 专用
      similarityBoost?: number; // ElevenLabs 专用
    } = {}
  ): Promise<Buffer> {
    this.checkCooldownRecovery();

    // 优先级顺序：火山引擎 -> GLM -> ElevenLabs
    const providerOrder: VoiceProvider[] = ['volcengine', 'glm', 'elevenlabs'];
    let lastError: any;

    for (const provider of providerOrder) {
      if (this.failedProviders.has(provider)) {
        continue;
      }

      try {
        this.currentProvider = provider;

        if (provider === 'volcengine') {
          return await this.generateSpeechWithVolcEngine(text, options);
        } else if (provider === 'glm') {
          return await this.generateSpeechWithGLM(text, options);
        } else if (provider === 'elevenlabs') {
          return await this.generateSpeechWithElevenLabs(text, options);
        }

      } catch (error: any) {
        lastError = error;
        logger.warn(`语音服务请求失败，尝试切换提供商: ${provider}`, {
          error: (error instanceof Error ? error.message : String(error)) || error,
          provider
        });
        continue;
      }
    }

    // 所有提供商都失败了
    logger.error('所有语音服务提供商都失败了', {
      lastError: lastError?.message || lastError,
      failedProviders: Array.from(this.failedProviders)
    });

    throw new Error(`语音服务不可用: ${lastError?.message || '未知错误'}`);
  }

  // 获取当前服务状态
  getServiceStatus(): {
    currentProvider: VoiceProvider;
    availableProviders: VoiceProvider[];
    failedProviders: VoiceProvider[];
    lastFailureTimes: Record<string, number>;
  } {
    const allProviders: VoiceProvider[] = ['volcengine', 'glm', 'elevenlabs'];
    const availableProviders = allProviders.filter(
      provider => !this.failedProviders.has(provider)
    );

    const lastFailureTimes: Record<string, number> = {};
    for (const [provider, time] of this.lastFailureTime.entries()) {
      lastFailureTimes[provider] = time;
    }

    return {
      currentProvider: this.currentProvider,
      availableProviders,
      failedProviders: Array.from(this.failedProviders),
      lastFailureTimes
    };
  }

  // 手动重置失败状态
  resetFailureStatus(provider?: VoiceProvider): void {
    if (provider) {
      this.failedProviders.delete(provider);
      this.lastFailureTime.delete(provider);
      logger.info(`手动重置语音服务提供商失败状态: ${provider}`);
    } else {
      this.failedProviders.clear();
      this.lastFailureTime.clear();
      logger.info('手动重置所有语音服务提供商失败状态');
    }
  }
}

// 创建全局语音服务管理器实例
export const voiceService = new VoiceServiceManager();

// 导出便捷方法
export const generateSpeech = voiceService.generateSpeech.bind(voiceService);
export const getVoiceServiceStatus = voiceService.getServiceStatus.bind(voiceService);
export const resetVoiceFailureStatus = voiceService.resetFailureStatus.bind(voiceService);

// 向后兼容的默认导出
export default voiceService;