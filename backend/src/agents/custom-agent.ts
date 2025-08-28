import { createChatCompletion, generateSpeech, generateImage } from '../config/ai-service';
import { logger } from '../config/logger';
import { z } from 'zod';

/**
 * 自定义Agent框架 - 支持国产AI服务
 * 替代@openai/agents，支持豆包1.6、火山引擎、SeeDream 3.0等国产化服务
 * 支持文本、语音、图像多模态AI代理
 */

export interface AgentModelSettings {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  // 语音相关设置
  voiceEnabled?: boolean;
  voiceOptions?: {
    voice?: string;
    speed?: number;
    language?: string;
    encoding?: 'mp3' | 'wav';
  };
  // 图像相关设置
  imageEnabled?: boolean;
  imageOptions?: {
    size?: string;
    quality?: string;
    style?: string;
    saveToFile?: boolean;
  };
}

export interface AgentConfig<TOutput> {
  name: string;
  instructions: string;
  outputType?: z.ZodSchema<TOutput>;
  modelSettings?: AgentModelSettings;
  // 多模态能力配置
  capabilities?: {
    text?: boolean;
    voice?: boolean;
    image?: boolean;
  };
}

export class CustomAgent<TOutput = any> {
  private name: string;
  private instructions: string;
  private outputType?: z.ZodSchema<TOutput>;
  private modelSettings: AgentModelSettings;
  private capabilities: {
    text: boolean;
    voice: boolean;
    image: boolean;
  };

  constructor(config: AgentConfig<TOutput>) {
    this.name = config.name;
    this.instructions = config.instructions;
    this.outputType = config.outputType;
    this.modelSettings = {
      temperature: 0.7,
      maxTokens: 2000,
      stream: false,
      voiceEnabled: false,
      imageEnabled: false,
      ...config.modelSettings
    };
    this.capabilities = {
      text: true,
      voice: config.capabilities?.voice ?? false,
      image: config.capabilities?.image ?? false,
      ...config.capabilities
    };
  }

  /**
   * 运行Agent，返回结构化输出
   */
  async run(userPrompt: string, options?: {
    includeVoice?: boolean;
    includeImage?: boolean;
    imagePrompt?: string;
  }): Promise<{
    finalOutput: TOutput;
    messages: Array<{role: string; content: string}>;
    tokensUsed?: number;
    audioBuffer?: Buffer;
    imageResult?: any;
  }> {
    try {
      logger.info(`运行Agent: ${this.name}`, {
        agent: this.name,
        promptLength: userPrompt.length,
        capabilities: this.capabilities
      });

      // 构建完整的Prompt
      const fullPrompt = this.buildFullPrompt(userPrompt);

      // 调用文本生成服务（豆包1.6）
      const response = await createChatCompletion([
        {
          role: 'system',
          content: this.instructions
        },
        {
          role: 'user',
          content: fullPrompt
        }
      ], {
        temperature: this.modelSettings.temperature,
        max_tokens: this.modelSettings.maxTokens
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error(`Agent ${this.name} 没有返回内容`);
      }

      // 解析输出
      const finalOutput = this.parseOutput(content);

      // 验证输出格式
      if (this.outputType) {
        try {
          this.outputType.parse(finalOutput);
        } catch (validationError) {
          logger.warn(`Agent ${this.name} 输出格式验证失败`, {
            agent: this.name,
            error: validationError,
            output: finalOutput
          });
          // 不抛出错误，继续使用原始输出
        }
      }

      const result: any = {
        finalOutput,
        messages: [
          { role: 'system', content: this.instructions },
          { role: 'user', content: fullPrompt },
          { role: 'assistant', content: content }
        ],
        tokensUsed: response.usage?.total_tokens
      };

      // 如果需要生成语音
      if (this.capabilities.voice && (options?.includeVoice || this.modelSettings.voiceEnabled)) {
        try {
          const audioBuffer = await this.generateAudio(content);
          result.audioBuffer = audioBuffer;
          logger.info(`Agent ${this.name} 语音生成成功`, {
            audioSize: audioBuffer.length
          });
        } catch (audioError: any) {
          logger.warn(`Agent ${this.name} 语音生成失败`, {
            error: audioError.message
          });
        }
      }

      // 如果需要生成图像
      if (this.capabilities.image && (options?.includeImage || this.modelSettings.imageEnabled)) {
        try {
          const imagePrompt = options?.imagePrompt || this.extractImagePrompt(content, userPrompt);
          const imageResult = await this.generateImage(imagePrompt);
          result.imageResult = imageResult;
          logger.info(`Agent ${this.name} 图像生成成功`, {
            hasUrl: !!imageResult.url,
            hasBuffer: !!imageResult.buffer
          });
        } catch (imageError: any) {
          logger.warn(`Agent ${this.name} 图像生成失败`, {
            error: imageError.message
          });
        }
      }

      logger.info(`Agent ${this.name} 执行成功`, {
        agent: this.name,
        tokensUsed: result.tokensUsed,
        hasAudio: !!result.audioBuffer,
        hasImage: !!result.imageResult
      });

      return result;

    } catch (error: any) {
      logger.error(`Agent ${this.name} 执行失败`, {
        agent: this.name,
        error: error.message || error
      });
      throw new Error(`Agent ${this.name} 执行失败: ${error.message || error}`);
    }
  }

  /**
   * 生成语音
   */
  private async generateAudio(text: string): Promise<Buffer> {
    const options = {
      voice: this.modelSettings.voiceOptions?.voice,
      speed: this.modelSettings.voiceOptions?.speed || 1.0,
      language: this.modelSettings.voiceOptions?.language || 'zh',
      encoding: this.modelSettings.voiceOptions?.encoding || 'mp3'
    };

    return generateSpeech(text, options);
  }

  /**
   * 生成图像
   */
  private async generateImage(prompt: string): Promise<any> {
    const options = {
      size: this.modelSettings.imageOptions?.size || '1024x1024',
      quality: this.modelSettings.imageOptions?.quality || 'standard',
      style: this.modelSettings.imageOptions?.style || 'natural',
      saveToFile: this.modelSettings.imageOptions?.saveToFile || false
    };

    return generateImage(prompt, options);
  }

  /**
   * 从文本中提取图像提示词
   */
  private extractImagePrompt(content: string, userPrompt: string): string {
    // 简单的提示词提取逻辑，可以根据具体需求优化
    if (content.length > 200) {
      // 如果内容较长，使用用户输入作为提示词
      return `Create an educational illustration for: ${userPrompt}`;
    }
    return `Create an educational illustration for: ${content}`;
  }

  /**
   * 获取Agent能力
   */
  getCapabilities(): {
    text: boolean;
    voice: boolean;
    image: boolean;
  } {
    return { ...this.capabilities };
  }

  /**
   * 更新Agent配置
   */
  updateConfig(updates: Partial<AgentConfig<TOutput>>): void {
    if (updates.instructions) {
      this.instructions = updates.instructions;
    }
    if (updates.modelSettings) {
      this.modelSettings = { ...this.modelSettings, ...updates.modelSettings };
    }
    if (updates.capabilities) {
      this.capabilities = { ...this.capabilities, ...updates.capabilities };
    }
    
    logger.info(`Agent ${this.name} 配置已更新`, {
      capabilities: this.capabilities,
      modelSettings: this.modelSettings
    });
  }
  private buildFullPrompt(userPrompt: string): string {
    let fullPrompt = userPrompt;

    // 如果有输出类型要求，添加JSON格式说明
    if (this.outputType) {
      fullPrompt += '\n\nPlease respond with a valid JSON object that matches the expected schema. Ensure the JSON is properly formatted and complete.';
    }

    return fullPrompt;
  }

  /**
   * 解析AI输出
   */
  private parseOutput(content: string): TOutput {
    // 如果期望JSON输出，尝试解析
    if (this.outputType) {
      try {
        // 尝试直接解析JSON
        return JSON.parse(content);
      } catch (error) {
        // 如果直接解析失败，尝试提取JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return JSON.parse(jsonMatch[0]);
          } catch (extractError) {
            logger.warn(`无法从响应中提取JSON`, {
              content: content.substring(0, 200),
              error: extractError
            });
          }
        }
        
        // 如果都失败了，返回原始内容作为fallback
        logger.warn(`JSON解析失败，返回原始内容`, {
          content: content.substring(0, 200)
        });
        return content as unknown as TOutput;
      }
    }

    // 非JSON输出，直接返回文本
    return content as unknown as TOutput;
  }
}

/**
 * 便捷的run函数，模拟@openai/agents的run接口
 */
export async function runCustomAgent<TOutput>(
  agent: CustomAgent<TOutput>,
  prompt: string,
  options?: {
    includeVoice?: boolean;
    includeImage?: boolean;
    imagePrompt?: string;
  }
): Promise<{
  finalOutput: TOutput;
  messages: Array<{role: string; content: string}>;
  tokensUsed?: number;
  audioBuffer?: Buffer;
  imageResult?: any;
}> {
  return agent.run(prompt, options);
}

/**
 * 从现有Agent配置创建CustomAgent的工厂函数
 */
export function createAgentFromConfig<TOutput>(config: {
  name: string;
  instructions: string;
  outputType?: z.ZodSchema<TOutput>;
  modelSettings?: AgentModelSettings;
  capabilities?: {
    text?: boolean;
    voice?: boolean;
    image?: boolean;
  };
}): CustomAgent<TOutput> {
  return new CustomAgent(config);
}

/**
 * 创建多模态Agent的便捷函数
 */
export function createMultimodalAgent<TOutput>(config: {
  name: string;
  instructions: string;
  outputType?: z.ZodSchema<TOutput>;
  enableVoice?: boolean;
  enableImage?: boolean;
  voiceOptions?: {
    voice?: string;
    speed?: number;
    language?: string;
  };
  imageOptions?: {
    size?: string;
    quality?: string;
    style?: string;
  };
}): CustomAgent<TOutput> {
  return new CustomAgent({
    name: config.name,
    instructions: config.instructions,
    outputType: config.outputType,
    capabilities: {
      text: true,
      voice: config.enableVoice || false,
      image: config.enableImage || false
    },
    modelSettings: {
      voiceEnabled: config.enableVoice,
      imageEnabled: config.enableImage,
      voiceOptions: config.voiceOptions,
      imageOptions: config.imageOptions
    }
  });
}