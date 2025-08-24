# AI 服务冗余机制迁移指南

## 概述

WordPecker 现在支持 AI 服务的自动故障转移机制，优先使用 GLM-4.5，在失败时自动切换到 Moonshot API，确保业务连续性。

## 新的服务架构

### AI 文本生成服务
- **主要服务**: GLM-4.5 (智谱AI)
- **备选服务**: Moonshot AI
- **自动故障转移**: 5分钟冷却时间后自动重试

### 语音生成服务
- **主要服务**: GLM-4-voice (智谱AI)
- **备选服务**: ElevenLabs (如果配置)
- **自动故障转移**: 5分钟冷却时间后自动重试

## 环境变量配置

### 新增环境变量
```bash
# GLM (智谱AI) 配置 - 主要服务
GLM_API_KEY=your_glm_api_key_here
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_TEXT_MODEL=glm-4.5
GLM_VOICE_MODEL=glm-4-voice

# Moonshot AI 配置 - 备选服务
MOONSHOT_API_KEY=your_moonshot_api_key_here
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1
MOONSHOT_MODEL=moonshot-v1-8k
```

### 向后兼容配置
现有的 `OPENAI_API_KEY` 等配置仍然有效，作为 Moonshot 的配置使用。

## 代码迁移

### 1. AI 文本生成

#### 旧方式 (仍然支持)
```typescript
import { openai } from '../config/openai';

const response = await openai.chat.completions.create({
  model: 'moonshot-v1-8k',
  messages: [{ role: 'user', content: 'Hello' }]
});
```

#### 新方式 (推荐)
```typescript
import { createChatCompletion } from '../config/ai-service';

const response = await createChatCompletion([
  { role: 'user', content: 'Hello' }
], {
  temperature: 0.7,
  max_tokens: 1000
});
```

### 2. 语音生成

#### 新方式
```typescript
import { generateSpeech } from '../config/voice-service';

const audioBuffer = await generateSpeech('Hello, world!', {
  voice: 'alloy',
  speed: 1.0,
  format: 'mp3'
});
```

## 服务监控

### 状态查询 API
```bash
# 获取所有服务状态
GET /api/service/status

# 健康检查
GET /api/service/health

# 重置 AI 服务失败状态
POST /api/service/ai/reset
{
  "provider": "glm" // 可选，不传则重置所有
}

# 重置语音服务失败状态
POST /api/service/voice/reset
{
  "provider": "glm" // 可选，不传则重置所有
}
```

### 响应示例
```json
{
  "success": true,
  "data": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "services": {
      "ai": {
        "currentProvider": "glm",
        "availableProviders": ["glm", "moonshot"],
        "failedProviders": [],
        "healthy": true
      },
      "voice": {
        "currentProvider": "glm",
        "availableProviders": ["glm"],
        "failedProviders": [],
        "healthy": true
      }
    },
    "overall": {
      "healthy": true,
      "totalProviders": 3,
      "failedProviders": 0
    }
  }
}
```

## 故障转移机制

### 自动故障转移
1. 请求失败时，服务自动标记为不可用
2. 立即切换到下一个可用的服务提供商
3. 失败的服务进入5分钟冷却期
4. 冷却期结束后自动重新尝试

### 优先级顺序
- **AI 文本**: GLM-4.5 → Moonshot
- **语音**: GLM-4-voice → ElevenLabs

### 日志记录
所有故障转移事件都会记录在日志中，包括：
- 服务失败原因
- 切换到的备选服务
- 恢复时间
- 请求成功率统计

## 最佳实践

### 1. 错误处理
```typescript
import { createChatCompletion } from '../config/ai-service';

try {
  const response = await createChatCompletion(messages);
  // 处理成功响应
} catch (error) {
  // 这里的错误表示所有服务都失败了
  logger.error('AI 服务完全不可用', { error });
  throw new Error('AI 服务暂时不可用，请稍后重试');
}
```

### 2. 监控集成
```typescript
import { getAIServiceStatus } from '../config/ai-service';

// 在健康检查中包含服务状态
app.get('/health', (req, res) => {
  const aiStatus = getAIServiceStatus();
  res.json({
    healthy: aiStatus.availableProviders.length > 0,
    services: aiStatus
  });
});
```

### 3. 性能优化
- 冗余机制会增加少量延迟（通常 < 100ms）
- 失败的服务会被缓存，避免重复尝试
- 使用连接池减少建立连接的开销

## 部署注意事项

### 1. 环境变量
确保在生产环境中配置所有必要的 API 密钥：
```bash
GLM_API_KEY=your_production_glm_key
MOONSHOT_API_KEY=your_production_moonshot_key
```

### 2. 监控告警
建议设置监控告警，当服务状态异常时及时通知：
```bash
# 检查服务健康状态
curl -f http://your-domain/api/service/health || alert "AI服务异常"
```

### 3. 日志分析
定期分析服务切换日志，优化配置：
```bash
# 查看故障转移日志
grep "AI 服务提供商标记为失败" /var/log/wordpecker.log
```

## 故障排除

### 常见问题

1. **所有服务都不可用**
   - 检查 API 密钥是否正确
   - 检查网络连接
   - 查看详细错误日志

2. **频繁切换服务**
   - 检查 API 配额是否用完
   - 检查请求频率是否过高
   - 考虑增加冷却时间

3. **某个服务一直失败**
   - 使用重置 API 手动恢复
   - 检查该服务的 API 状态
   - 更新 API 密钥

### 调试命令
```bash
# 查看当前服务状态
curl http://localhost:3000/api/service/status

# 重置所有失败状态
curl -X POST http://localhost:3000/api/service/ai/reset
curl -X POST http://localhost:3000/api/service/voice/reset
```