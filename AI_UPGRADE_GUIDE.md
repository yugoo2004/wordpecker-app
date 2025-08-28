# WordPecker AI模型替换升级指南

## 📋 概述

本文档描述了WordPecker项目中AI模型的全面替换升级方案，将现有的OpenAI/Agents框架、GLM-4-voice、ElevenLabs等服务全面替换为国产化方案：

- **文本模型**：豆包1.6模型（火山引擎）替代OpenAI GPT系列
- **语音合成**：火山引擎TTS替代GLM-4-voice和ElevenLabs
- **图像生成**：SeeDream 3.0替代DALL-E 3

## 🚀 快速开始

### 1. 环境配置

复制环境变量示例文件并配置API密钥：

```bash
cp .env.ai-upgrade.example .env
```

编辑`.env`文件，填入以下必需的API密钥：

```bash
# 豆包1.6模型（必需）
DOUBAO_API_KEY=your_doubao_api_key_here
DOUBAO_ENDPOINT=ep-20250101-xxxxx

# 火山引擎TTS（必需）
VOLCENGINE_API_KEY=your_volcengine_api_key_here
VOLCENGINE_APP_ID=your_volcengine_app_id_here

# SeeDream 3.0（必需）
SEEDREAM_API_KEY=your_seedream_api_key_here
```

### 2. 安装依赖

确保安装了所有必需的依赖：

```bash
cd backend
npm install
```

### 3. 运行测试

验证所有新服务是否正常工作：

```bash
# 运行AI升级测试套件
npm run test:ai-upgrade

# 或者直接运行测试脚本
npx ts-node src/scripts/test-ai-upgrade.ts
```

### 4. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 🏗️ 架构变更

### 服务优先级

新的AI服务优先级顺序：

1. **文本生成**：豆包1.6 → GLM-4.5 → Moonshot → 通义千问
2. **语音合成**：火山引擎TTS → GLM-4-voice → ElevenLabs
3. **图像生成**：SeeDream 3.0 → DALL-E 3（备用）

### 代理系统升级

所有AI代理已迁移到增强的`CustomAgent`框架：

- ✅ `vocabularyAgent` - 支持豆包1.6
- ✅ `definitionAgent` - 支持豆包1.6 + 语音输出
- ✅ `examplesAgent` - 支持豆包1.6 + 语音输出
- ✅ `quizAgent` - 支持豆包1.6
- ✅ `imageGenerationAgent` - 支持SeeDream 3.0
- ✅ `languageValidationAgent` - 支持豆包1.6

### 多模态能力

新的代理框架支持多模态输出：

```typescript
// 示例：带语音和图像的代理调用
const result = await definitionAgent.run('Define "innovation"', {
  includeVoice: true,    // 生成语音
  includeImage: true,    // 生成图像
  imagePrompt: 'Innovation concept illustration'
});

// 结果包含：
// - result.finalOutput: 文本定义
// - result.audioBuffer: MP3音频
// - result.imageResult: 图像URL/Buffer
```

## 🔧 服务配置

### 豆包1.6模型配置

```typescript
// 在 environment.ts 中配置
ai: {
  doubao: {
    apiKey: process.env.DOUBAO_API_KEY,
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    endpoint: process.env.DOUBAO_ENDPOINT, // 端点ID
    model: 'doubao-pro-32k',
    region: 'cn-beijing'
  }
}
```

**获取API密钥**：
1. 访问[火山引擎控制台](https://www.volcengine.com/)
2. 创建豆包模型实例
3. 获取API密钥和端点ID

### 火山引擎TTS配置

```typescript
voice: {
  volcengine: {
    apiKey: process.env.VOLCENGINE_API_KEY,
    baseUrl: 'https://openspeech.bytedance.com',
    appId: process.env.VOLCENGINE_APP_ID,
    cluster: 'volcano_tts',
    voiceType: 'BV700_streaming', // 中文女声
    encoding: 'mp3',
    sampleRate: 24000
  }
}
```

**支持的音色**：
- `BV700_streaming` - 中文女声1
- `BV701_streaming` - 中文女声2
- `BV002_streaming` - 中文男声1
- `BV001_streaming` - 英文女声

### SeeDream 3.0配置

```typescript
image: {
  seedream: {
    apiKey: process.env.SEEDREAM_API_KEY,
    baseUrl: 'https://api.seedream.com/v1',
    model: 'seedream-3.0',
    maxRetries: 3,
    timeoutMs: 30000
  }
}
```

## 📊 API参考

### 文本生成API

```typescript
import { createChatCompletion } from '../config/ai-service';

const response = await createChatCompletion([
  { role: 'user', content: '请解释机器学习的概念' }
], {
  temperature: 0.7,
  max_tokens: 1000
});
```

### 语音生成API

```typescript
import { generateSpeech } from '../config/ai-service';

const audioBuffer = await generateSpeech('你好，这是语音测试', {
  voice: 'BV700_streaming',
  speed: 1.0,
  language: 'zh',
  encoding: 'mp3'
});
```

### 图像生成API

```typescript
import { generateImage } from '../config/ai-service';

const imageResult = await generateImage('A beautiful library scene', {
  size: '1024x1024',
  quality: 'hd',
  style: 'natural'
});
```

### 多模态代理API

```typescript
import { createMultimodalAgent } from '../agents/custom-agent';

const agent = createMultimodalAgent({
  name: 'Multi-modal Agent',
  instructions: 'You are a helpful language learning assistant.',
  enableVoice: true,
  enableImage: true,
  voiceOptions: {
    voice: 'BV700_streaming',
    language: 'zh'
  },
  imageOptions: {
    size: '1024x1024',
    quality: 'hd'
  }
});

const result = await agent.run('Explain colors in Chinese', {
  includeVoice: true,
  includeImage: true
});
```

## 🔄 故障转移机制

系统实现了完整的故障转移机制：

### 自动故障检测

- 服务异常时自动标记为失败
- 5分钟冷却期后自动重试
- 支持手动重置失败状态

### 降级策略

1. **文本服务降级**：豆包1.6 → GLM-4.5 → Moonshot → 通义千问
2. **语音服务降级**：火山引擎 → GLM-4-voice → 本地备用
3. **图像服务降级**：SeeDream 3.0 → DALL-E 3（如果配置）

### 监控和状态

```typescript
import { getAllServiceStatus } from '../config/ai-service';

const status = await getAllServiceStatus();
console.log({
  text: status.text.available,      // 文本服务状态
  voice: status.voice.available,    // 语音服务状态
  image: status.image.available     // 图像服务状态
});
```

## 🧪 测试和验证

### 运行完整测试套件

```bash
# 运行AI升级测试
npm run test:ai-upgrade

# 运行特定服务测试
npm run test -- --grep "豆包"
npm run test -- --grep "火山引擎"
npm run test -- --grep "SeeDream 3.0"
```

### 测试覆盖范围

- ✅ 豆包1.6文本生成服务
- ✅ 火山引擎TTS语音合成
- ✅ SeeDream 3.0图像生成
- ✅ 集成服务API
- ✅ 所有AI代理
- ✅ 故障转移机制
- ✅ 性能和稳定性

### 手动测试

#### 测试文本生成

```bash
curl -X POST http://localhost:3000/api/vocabulary/generate \
  -H "Content-Type: application/json" \
  -d '{"topic": "science", "language": "zh", "count": 5}'
```

#### 测试语音生成

```bash
curl -X POST http://localhost:3000/api/audio/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "这是语音测试", "voice": "BV700_streaming"}' \
  --output test-audio.mp3
```

#### 测试图像生成

```bash
curl -X POST http://localhost:3000/api/image-description/generate \
  -H "Content-Type: application/json" \
  -d '{"context": "library scene", "sessionId": "test"}'
```

## 🚀 部署配置

### Docker部署

更新`docker-compose.yml`环境变量：

```yaml
services:
  backend:
    environment:
      # 豆包配置
      - DOUBAO_API_KEY=${DOUBAO_API_KEY}
      - DOUBAO_ENDPOINT=${DOUBAO_ENDPOINT}
      
      # 火山引擎配置
      - VOLCENGINE_API_KEY=${VOLCENGINE_API_KEY}
      - VOLCENGINE_APP_ID=${VOLCENGINE_APP_ID}
      
      # SeeDream 3.0配置
      - SEEDREAM_API_KEY=${SEEDREAM_API_KEY}
```

### PM2部署

```bash
# 设置环境变量
export DOUBAO_API_KEY=your_key
export VOLCENGINE_API_KEY=your_key
export SEEDREAM_API_KEY=your_key

# 启动应用
pm2 start ecosystem.config.js
```

### Systemd部署

在`/etc/systemd/system/wordpecker.service`中添加环境变量：

```ini
[Service]
Environment=DOUBAO_API_KEY=your_key
Environment=VOLCENGINE_API_KEY=your_key
Environment=SEEDREAM_API_KEY=your_key
```

## ⚠️ 迁移注意事项

### 代码变更

1. **导入更新**：
   ```typescript
   // 旧代码
   import { Agent } from '@openai/agents';
   
   // 新代码
   import { CustomAgent } from '../custom-agent';
   ```

2. **代理创建**：
   ```typescript
   // 旧代码
   const agent = new Agent({ ... });
   
   // 新代码
   const agent = new CustomAgent({
     capabilities: {
       text: true,
       voice: true,
       image: false
     }
   });
   ```

3. **API调用**：
   ```typescript
   // 新增多模态支持
   const result = await agent.run(prompt, {
     includeVoice: true,
     includeImage: true
   });
   ```

### 性能优化

1. **缓存策略**：
   - 语音文件自动缓存（最多100个文件）
   - 图像结果可选本地存储
   - 文本响应使用Redis缓存

2. **并发控制**：
   - 每个服务的连接池管理
   - 请求频率限制
   - 断路器模式防止级联失败

### 监控建议

1. **关键指标**：
   - API响应时间（目标<3秒）
   - 服务可用性（目标>99.5%）
   - 错误率（目标<1%）
   - 资源使用率

2. **告警配置**：
   - 服务不可用告警
   - 响应时间过长告警
   - API配额不足告警

## 🆘 故障排除

### 常见问题

#### 1. 豆包服务连接失败

```bash
错误：豆包API认证失败，请检查API密钥和端点配置
```

**解决方案**：
- 检查`DOUBAO_API_KEY`是否正确
- 确认`DOUBAO_ENDPOINT`端点ID是否有效
- 验证账户余额和配额

#### 2. 火山引擎TTS无响应

```bash
错误：火山引擎TTS处理超时
```

**解决方案**：
- 检查`VOLCENGINE_API_KEY`和`VOLCENGINE_APP_ID`
- 验证网络连接到火山引擎服务
- 检查文本长度是否超限

#### 3. SeeDream 3.0图像生成失败

```bash
错误：SeeDream 3.0 API请求频率过高
```

**解决方案**：
- 检查API配额和计费状态
- 调整请求频率
- 配置重试机制

### 调试方法

1. **启用详细日志**：
   ```bash
   export NODE_ENV=development
   export LOG_LEVEL=debug
   ```

2. **检查服务状态**：
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **查看服务状态**：
   ```typescript
   import { getAllServiceStatus } from '../config/ai-service';
   console.log(await getAllServiceStatus());
   ```

## 📚 API密钥获取指南

### 豆包1.6模型

1. 访问[火山引擎控制台](https://www.volcengine.com/)
2. 注册账户并完成实名认证
3. 进入"人工智能"→"机器学习平台"
4. 创建豆包模型实例
5. 获取API密钥和端点ID

### 火山引擎TTS

1. 在火山引擎控制台
2. 进入"语音技术"→"语音合成"
3. 创建应用并获取AppID
4. 获取访问密钥

### SeeDream 3.0

1. 联系SeeDream 3.0团队获取API访问权限
2. 获取API密钥和文档
3. 测试API连接

## 🔮 未来规划

### 即将支持的功能

1. **流式响应**：
   - 豆包1.6流式文本生成
   - 火山引擎流式语音合成
   - 实时多模态交互

2. **高级功能**：
   - 自定义语音训练
   - 个性化图像风格
   - 多语言自动切换

3. **性能优化**：
   - 智能负载均衡
   - 预测性缓存
   - 边缘计算集成

### 版本兼容性

- 当前版本：v2.0（AI升级版）
- 向后兼容：保留OpenAI接口适配
- 升级路径：平滑迁移现有代码

---

## 📞 技术支持

如果在升级过程中遇到问题，请：

1. 查看本文档的故障排除部分
2. 运行完整的测试套件进行诊断
3. 检查相关服务的官方文档
4. 联系技术团队获得支持

---

**🎉 恭喜！您已完成WordPecker AI模型替换升级！**