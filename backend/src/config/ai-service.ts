import OpenAI from 'openai';
import { environment } from './environment';
import { logger } from './logger';

// AI 服务提供商类型 - 扩展国产化支持
export type AIProvider = 'glm' | 'moonshot' | 'qwen' | 'minimax' | 'baichuan';

// AI 服务配置接口
interface AIServiceConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  provider: AIProvider;
}

// GLM 和其他国产AI的配置
const AI_CONFIGS: Record<AIProvider, AIServiceConfig> = {
  glm: {
    apiKey: environment.ai.glm.apiKey,
    baseUrl: environment.ai.glm.baseUrl,
    model: environment.ai.glm.textModel,
    provider: 'glm'
  },
  moonshot: {
    apiKey: environment.ai.primary.apiKey,
    baseUrl: environment.ai.primary.baseUrl,
    model: environment.ai.primary.model,
    provider: 'moonshot'
  },
  qwen: {
    apiKey: environment.ai?.qwen?.apiKey || '',
    baseUrl: environment.ai?.qwen?.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: environment.ai?.qwen?.model || 'qwen-plus',
    provider: 'qwen'
  },
  minimax: {
    apiKey: environment.ai?.minimax?.apiKey || '',
    baseUrl: environment.ai?.minimax?.baseUrl || 'https://api.minimax.chat/v1',
    model: environment.ai?.minimax?.model || 'abab6.5s-chat',
    provider: 'minimax'
  },
  baichuan: {
    apiKey: environment.ai?.baichuan?.apiKey || '',
    baseUrl: environment.ai?.baichuan?.baseUrl || 'https://api.baichuan-ai.com/v1',
    model: environment.ai?.baichuan?.model || 'Baichuan2-Turbo',
    provider: 'baichuan'
  }
};

// AI 服务客户端管理器
class AIServiceManager {
  private clients: Map<AIProvider, OpenAI> = new Map();
  private currentProvider: AIProvider = 'glm'; // 默认优先使用 GLM-4.5
  private failedProviders: Set<AIProvider> = new Set();
  private lastFailureTime: Map<AIProvider, number> = new Map();
  private readonly FAILURE_COOLDOWN = 5 * 60 * 1000; // 5分钟冷却时间

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    for (const [provider, config] of Object.entries(AI_CONFIGS)) {
      try {
        const client = new OpenAI({
          apiKey: config.apiKey,
          baseURL: config.baseUrl,
        });
        this.clients.set(provider as AIProvider, client);
        logger.info(`AI 服务客户端初始化成功: ${provider}`, {
          provider,
          baseUrl: config.baseUrl,
          model: config.model
        });
      } catch (error) {
        logger.error(`AI 服务客户端初始化失败: ${provider}`, { error, provider });
      }
    }
  }

  // 获取当前可用的 AI 客户端
  private getAvailableClient(): { client: OpenAI; config: AIServiceConfig } | null {
    // 检查冷却时间，重置已恢复的服务
    this.checkCooldownRecovery();

    // 优先级顺序：GLM -> Moonshot -> Qwen -> MiniMax -> Baichuan
    const providerOrder: AIProvider[] = ['glm', 'moonshot', 'qwen', 'minimax', 'baichuan'];
    
    for (const provider of providerOrder) {
      if (!this.failedProviders.has(provider)) {
        const client = this.clients.get(provider);
        const config = AI_CONFIGS[provider];
        
        if (client && config) {
          this.currentProvider = provider;
          return { client, config };
        }
      }
    }

    logger.error('所有 AI 服务提供商都不可用');
    return null;
  }

  // 检查冷却时间，重置已恢复的服务
  private checkCooldownRecovery(): void {
    const now = Date.now();
    for (const provider of this.failedProviders) {
      const lastFailure = this.lastFailureTime.get(provider);
      if (lastFailure && (now - lastFailure) > this.FAILURE_COOLDOWN) {
        this.failedProviders.delete(provider);
        this.lastFailureTime.delete(provider);
        logger.info(`AI 服务提供商已从失败列表中恢复: ${provider}`);
      }
    }
  }

  // 标记服务提供商为失败状态
  private markProviderAsFailed(provider: AIProvider, error: any): void {
    this.failedProviders.add(provider);
    this.lastFailureTime.set(provider, Date.now());
    logger.error(`AI 服务提供商标记为失败: ${provider}`, {
      error: error.message || error,
      provider,
      cooldownMinutes: this.FAILURE_COOLDOWN / 60000
    });
  }

  // 执行 AI 请求，带有自动故障转移
  async createChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams> = {}
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    const maxRetries = 2; // 最多尝试2个提供商
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const serviceInfo = this.getAvailableClient();
      
      if (!serviceInfo) {
        throw new Error('没有可用的 AI 服务提供商');
      }

      const { client, config } = serviceInfo;

      try {
        logger.info(`尝试使用 AI 服务: ${config.provider}`, {
          provider: config.provider,
          model: config.model,
          attempt: attempt + 1
        });

        const response: OpenAI.Chat.Completions.ChatCompletion = await client.chat.completions.create({
          model: config.model,
          messages,
          ...options
        });

        // 请求成功，记录日志
        logger.info(`AI 请求成功: ${config.provider}`, {
          provider: config.provider,
          model: config.model,
          tokensUsed: response?.usage?.total_tokens || 0
        });

        return response;

      } catch (error: any) {
        lastError = error;
        
        // 标记当前提供商为失败
        this.markProviderAsFailed(config.provider, error);

        logger.warn(`AI 服务请求失败，尝试切换提供商: ${config.provider}`, {
          error: error.message || error,
          provider: config.provider,
          attempt: attempt + 1,
          willRetry: attempt < maxRetries - 1
        });

        // 如果不是最后一次尝试，继续下一个提供商
        if (attempt < maxRetries - 1) {
          continue;
        }
      }
    }

    // 所有提供商都失败了
    logger.error('所有 AI 服务提供商都失败了', {
      lastError: lastError?.message || lastError,
      failedProviders: Array.from(this.failedProviders)
    });

    throw new Error(`AI 服务不可用: ${lastError?.message || '未知错误'}`);
  }

  // 获取当前服务状态
  getServiceStatus(): {
    currentProvider: AIProvider;
    availableProviders: AIProvider[];
    failedProviders: AIProvider[];
    lastFailureTimes: Record<string, number>;
  } {
    const availableProviders = Array.from(this.clients.keys()).filter(
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

  // 手动重置失败状态（用于管理接口）
  resetFailureStatus(provider?: AIProvider): void {
    if (provider) {
      this.failedProviders.delete(provider);
      this.lastFailureTime.delete(provider);
      logger.info(`手动重置 AI 服务提供商失败状态: ${provider}`);
    } else {
      this.failedProviders.clear();
      this.lastFailureTime.clear();
      logger.info('手动重置所有 AI 服务提供商失败状态');
    }
  }
}

// 创建全局 AI 服务管理器实例
export const aiService = new AIServiceManager();

// 导出便捷方法
export const createChatCompletion = aiService.createChatCompletion.bind(aiService);
export const getAIServiceStatus = aiService.getServiceStatus.bind(aiService);
export const resetAIFailureStatus = aiService.resetFailureStatus.bind(aiService);

// 向后兼容的默认导出
export default aiService;