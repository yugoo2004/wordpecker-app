import dotenv from 'dotenv';

dotenv.config();

// API 密钥格式验证函数
function validatePexelsApiKey(apiKey: string): boolean {
  // Pexels API 密钥通常是字母数字字符串，长度可能变化
  // 支持不同长度的API密钥格式（30-60个字符）
  const pexelsKeyPattern = /^[a-zA-Z0-9]{30,60}$/;
  return pexelsKeyPattern.test(apiKey);
}

// 验证必需的环境变量（测试环境允许使用默认值）
const requiredEnvVars = ['OPENAI_API_KEY', 'MONGODB_URL', 'PEXELS_API_KEY'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar] && process.env.NODE_ENV !== 'test') {
    throw new Error(`缺少必需的环境变量: ${envVar}`);
  }
}

// 验证 Pexels API 密钥格式（测试环境和演示模式跳过验证）
if (process.env.PEXELS_API_KEY && process.env.NODE_ENV !== 'test') {
  const apiKey = process.env.PEXELS_API_KEY;
  // 检查是否为演示/测试用的假密钥
  const isDemoKey = apiKey.includes('demo') || 
                   apiKey.includes('test') || 
                   apiKey.includes('fake') || 
                   apiKey.includes('placeholder') ||
                   apiKey.includes('abcdefghijklmnopqrstuvwxyz') ||
                   apiKey.includes('your_') ||
                   apiKey.includes('_here') ||
                   apiKey.includes('YOUR_') ||
                   apiKey.length < 20; // Pexels API密钥通常较长
  
  // 只对真实的API密钥进行格式验证
  if (!isDemoKey && !validatePexelsApiKey(apiKey)) {
    throw new Error('PEXELS_API_KEY 格式无效。请确保使用有效的 Pexels API 密钥。');
  }
}

// 导出验证函数供其他模块使用
export { validatePexelsApiKey };

export const environment = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/wordpecker_test',
  // AI 服务冗余配置 - 支持多个提供商自动故障转移
  ai: {
    // GLM (智谱AI) 配置 - 主要服务 (优先级1)
    glm: {
      apiKey: process.env.GLM_API_KEY || process.env.OPENAI_API_KEY!,
      baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
      textModel: process.env.GLM_TEXT_MODEL || 'glm-4.5',
      voiceModel: process.env.GLM_VOICE_MODEL || 'glm-4-voice'
    },
    // Moonshot AI 配置 - 备选服务 (优先级2)
    moonshot: {
      apiKey: process.env.MOONSHOT_API_KEY || process.env.OPENAI_API_KEY!,
      baseUrl: process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1',
      model: process.env.MOONSHOT_MODEL || 'moonshot-v1-8k'
    },
    // Qwen (通义千问) 配置 - 备选服务 (优先级3)
    qwen: {
      apiKey: process.env.QWEN_API_KEY,
      baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: process.env.QWEN_MODEL || 'qwen-plus'
    },
    // MiniMax 配置 - 备选服务 (优先级4)
    minimax: {
      apiKey: process.env.MINIMAX_API_KEY,
      baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1',
      model: process.env.MINIMAX_MODEL || 'abab6.5s-chat'
    },
    // Baichuan 配置 - 备选服务 (优先级5)
    baichuan: {
      apiKey: process.env.BAICHUAN_API_KEY,
      baseUrl: process.env.BAICHUAN_BASE_URL || 'https://api.baichuan-ai.com/v1',
      model: process.env.BAICHUAN_MODEL || 'Baichuan2-Turbo'
    },
    // 向后兼容的主要配置
    primary: {
      apiKey: process.env.OPENAI_API_KEY!,
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.moonshot.cn/v1',
      model: process.env.OPENAI_MODEL || 'moonshot-v1-8k',
      provider: process.env.AI_PROVIDER || 'moonshot' // moonshot | glm | openai
    }
  },
  // 保持向后兼容的openai配置
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.moonshot.cn/v1',
    model: process.env.OPENAI_MODEL || 'moonshot-v1-8k'
  },
  // 语音服务配置 (优先使用GLM-4-voice)
  voice: {
    provider: process.env.VOICE_PROVIDER || 'glm', // glm | elevenlabs
    glm: {
      apiKey: process.env.GLM_API_KEY || process.env.OPENAI_API_KEY!,
      baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
      model: process.env.GLM_VOICE_MODEL || 'glm-4-voice'
    },
    elevenlabs: {
      apiKey: process.env.ELEVENLABS_API_KEY
    }
  },
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY
  },
  pexels: {
    apiKey: process.env.PEXELS_API_KEY || 'abcdefghijklmnopqrstuvwxyz1234567890123',
    baseUrl: 'https://api.pexels.com/v1',
    defaultPerPage: 15,
    maxRetries: 3
  }
} as const; 