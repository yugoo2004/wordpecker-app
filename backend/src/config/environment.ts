import dotenv from 'dotenv';
import path from 'path';

// 加载项目根目录的 .env 文件
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// 也尝试加载后端目录的 .env 文件（如果存在）
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// API 密钥格式验证函数
function validatePexelsApiKey(apiKey: string): boolean {
  // Pexels API 密钥通常是字母数字字符串，长度可能变化
  // 支持不同长度的API密钥格式（30-60个字符）
  const pexelsKeyPattern = /^[a-zA-Z0-9]{30,60}$/;
  return pexelsKeyPattern.test(apiKey);
}

// 验证必需的环境变量（测试环境允许使用默认值）
const requiredEnvVars = ['MONGODB_URL', 'PEXELS_API_KEY'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar] && process.env.NODE_ENV !== 'test') {
    throw new Error(`缺少必需的环境变量: ${envVar}`);
  }
}

// 警告检查：推荐配置的环境变量
const recommendedEnvVars = {
  'DOUBAO_API_KEY': '豆包模型API密钥（主要文本生成服务）',
  'DOUBAO_ENDPOINT': '豆包模型端点ID（必需）',
  'VOLCENGINE_ACCESS_KEY_ID': '火山引擎Access Key ID（用于豆包和SeeDream）',
  'VOLCENGINE_SECRET_ACCESS_KEY': '火山引擎Secret Access Key（用于豆包和SeeDream）',
  'VOLCENGINE_API_KEY': '火山引擎API密钥（主要语音合成服务）',
  'SEEDREAM_API_KEY': 'SeeDream API密钥（主要图像生成服务）'
};

if (process.env.NODE_ENV !== 'test') {
  for (const [envVar, description] of Object.entries(recommendedEnvVars)) {
    if (!process.env[envVar]) {
      console.warn(`⚠️  推荐配置环境变量: ${envVar} - ${description}`);
    }
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

// 服务故障转移配置
export interface FailoverConfig {
  retryAttempts: number;
  timeoutMs: number;
  cooldownMs: number;
  fallbackProviders: string[];
}

export const failoverConfig: FailoverConfig = {
  retryAttempts: Number(process.env.FAILOVER_RETRY_ATTEMPTS) || 3,
  timeoutMs: Number(process.env.FAILOVER_TIMEOUT_MS) || 30000,
  cooldownMs: Number(process.env.FAILOVER_COOLDOWN_MS) || 300000, // 5分钟
  fallbackProviders: (process.env.FAILOVER_PROVIDERS || 'glm,moonshot,qwen').split(',')
};

export const environment = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/wordpecker_test',
  // AI 服务冗余配置 - 支持多个提供商自动故障转移
  ai: {
    // 降级控制配置
    fallback: {
      enabled: process.env.AI_FALLBACK_ENABLED !== 'false',
      forcedProvider: process.env.AI_FORCED_PROVIDER as 'doubao' | 'glm' | 'moonshot' | 'qwen' | 'minimax' | 'baichuan' | undefined,
      maxRetries: Number(process.env.AI_MAX_RETRIES) || 1,
      logDetailedErrors: process.env.AI_LOG_DETAILED_ERRORS === 'true',
      debugMode: process.env.AI_DEBUG_MODE === 'true'
    },
    // 豆包 1.6 模型配置 - 主要文本生成服务 (优先级1)
    doubao: {
      apiKey: process.env.ARK_API_KEY || process.env.DOUBAO_API_KEY || process.env.VOLCENGINE_API_KEY || '',
      accessKeyId: process.env.VOLCENGINE_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.VOLCENGINE_SECRET_ACCESS_KEY || '',
      baseUrl: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      endpoint: process.env.DOUBAO_ENDPOINT || 'doubao-seed-1-6-250615', // 使用模型名称而不是端点ID
      model: process.env.DOUBAO_MODEL || 'doubao-seed-1-6-250615', // 默认使用豆包1.6模型
      region: process.env.DOUBAO_REGION || 'cn-beijing',
      maxRetries: Number(process.env.DOUBAO_MAX_RETRIES) || 3,
      timeout: Number(process.env.DOUBAO_TIMEOUT) || 30000
    },
    // GLM (智谱AI) 配置 - 备选服务 (优先级2)
    glm: {
      apiKey: process.env.GLM_API_KEY || process.env.OPENAI_API_KEY!,
      baseUrl: process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
      textModel: process.env.GLM_TEXT_MODEL || 'glm-4.5',
      voiceModel: process.env.GLM_VOICE_MODEL || 'glm-4-voice'
    },
    // Moonshot AI 配置 - 备选服务 (优先级3)
    moonshot: {
      apiKey: process.env.MOONSHOT_API_KEY || process.env.OPENAI_API_KEY!,
      baseUrl: process.env.MOONSHOT_BASE_URL || 'https://api.moonshot.cn/v1',
      model: process.env.MOONSHOT_MODEL || 'moonshot-v1-8k'
    },
    // Qwen (通义千问) 配置 - 备选服务 (优先级4)
    qwen: {
      apiKey: process.env.QWEN_API_KEY,
      baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: process.env.QWEN_MODEL || 'qwen-plus'
    },
    // MiniMax 配置 - 备选服务 (优先级5)
    minimax: {
      apiKey: process.env.MINIMAX_API_KEY,
      baseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1',
      model: process.env.MINIMAX_MODEL || 'abab6.5s-chat'
    },
    // Baichuan 配置 - 备选服务 (优先级6)
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
  // 语音服务配置 (优先使用火山引擎)
  voice: {
    provider: process.env.VOICE_PROVIDER || 'volcengine', // volcengine | glm | elevenlabs
    volcengine: {
      apiKey: process.env.VOLCENGINE_API_KEY || process.env.VOLCENGINE_ACCESS_TOKEN || '',
      accessKeyId: process.env.VOLCENGINE_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.VOLCENGINE_SECRET_ACCESS_KEY || '',
      baseUrl: process.env.VOLCENGINE_BASE_URL || 'https://openspeech.bytedance.com',
      appId: process.env.VOLCENGINE_APP_ID || '624a6f3b-6beb-434e-9f2a-e3318de955fa',
      cluster: process.env.VOLCENGINE_CLUSTER || 'volcano_tts',
      voiceType: process.env.VOLCENGINE_VOICE_TYPE || 'BV700_streaming',
      encoding: process.env.VOLCENGINE_ENCODING || 'mp3',
      sampleRate: Number(process.env.VOLCENGINE_SAMPLE_RATE) || 24000,
      region: process.env.VOLCENGINE_REGION || 'cn-north-1'
    },
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
  // 图像生成服务配置 (优先使用SeeDream 3.0)
  image: {
    provider: process.env.IMAGE_PROVIDER || 'seeddream', // seeddream | dalle | stable-diffusion
    seeddream: {
      apiKey: process.env.SEEDREAM_API_KEY || process.env.VOLCENGINE_API_KEY || process.env.DOUBAO_API_KEY || '',
      accessKeyId: process.env.VOLCENGINE_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.VOLCENGINE_SECRET_ACCESS_KEY || '',
      baseUrl: process.env.SEEDREAM_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
      model: process.env.SEEDREAM_MODEL || 'doubao-seedream-3-0-t2i-250415',
      maxRetries: Number(process.env.SEEDREAM_MAX_RETRIES) || 3,
      timeoutMs: Number(process.env.SEEDREAM_TIMEOUT) || 60000,
      defaultSize: process.env.SEEDREAM_DEFAULT_SIZE || '1024x1024',
      defaultGuidanceScale: Number(process.env.SEEDREAM_GUIDANCE_SCALE) || 3,
      defaultWatermark: process.env.SEEDREAM_WATERMARK !== 'false'
    },
    dalle: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.DALLE_MODEL || 'dall-e-3'
    }
  },
  pexels: {
    apiKey: process.env.PEXELS_API_KEY || 'abcdefghijklmnopqrstuvwxyz1234567890123',
    baseUrl: 'https://api.pexels.com/v1',
    defaultPerPage: 15,
    maxRetries: 3
  }
} as const; 