import dotenv from 'dotenv';

dotenv.config();

// API 密钥格式验证函数
function validatePexelsApiKey(apiKey: string): boolean {
  // Pexels API 密钥通常是字母数字字符串，长度可能变化
  // 支持不同长度的API密钥格式（30-60个字符）
  const pexelsKeyPattern = /^[a-zA-Z0-9]{30,60}$/;
  return pexelsKeyPattern.test(apiKey);
}

// 验证必需的环境变量
const requiredEnvVars = ['OPENAI_API_KEY', 'MONGODB_URL', 'PEXELS_API_KEY'] as const;
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`缺少必需的环境变量: ${envVar}`);
  }
}

// 验证 Pexels API 密钥格式（测试环境跳过验证）
if (process.env.PEXELS_API_KEY && process.env.NODE_ENV !== 'test' && !validatePexelsApiKey(process.env.PEXELS_API_KEY)) {
  throw new Error('PEXELS_API_KEY 格式无效。请确保使用有效的 Pexels API 密钥。');
}

// 导出验证函数供其他模块使用
export { validatePexelsApiKey };

export const environment = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUrl: process.env.MONGODB_URL!,
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4'
  },
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY
  },
  pexels: {
    apiKey: process.env.PEXELS_API_KEY!,
    baseUrl: 'https://api.pexels.com/v1',
    defaultPerPage: 15,
    maxRetries: 3
  }
} as const; 