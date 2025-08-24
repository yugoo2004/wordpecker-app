# WordPecker AI 服务冗余机制部署检查清单

## 📋 部署前检查

### 1. 环境变量配置 ✅

- [ ] `GLM_API_KEY` - 智谱AI API 密钥
- [ ] `GLM_BASE_URL` - 智谱AI API 基础URL (默认: https://open.bigmodel.cn/api/paas/v4)
- [ ] `GLM_TEXT_MODEL` - 文本模型 (推荐: glm-4.5)
- [ ] `GLM_VOICE_MODEL` - 语音模型 (推荐: glm-4-voice)
- [ ] `MOONSHOT_API_KEY` - Moonshot AI API 密钥
- [ ] `MOONSHOT_BASE_URL` - Moonshot API 基础URL (默认: https://api.moonshot.cn/v1)
- [ ] `MOONSHOT_MODEL` - Moonshot 模型 (推荐: moonshot-v1-8k)
- [ ] `OPENAI_API_KEY` - 向后兼容 (可使用 Moonshot 密钥)
- [ ] `OPENAI_BASE_URL` - 向后兼容 (可使用 Moonshot URL)

### 2. API 密钥验证 ✅

```bash
# 测试 GLM API
curl -X POST https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Authorization: Bearer $GLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "glm-4.5", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 10}'

# 测试 Moonshot API
curl -X POST https://api.moonshot.cn/v1/chat/completions \
  -H "Authorization: Bearer $MOONSHOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "moonshot-v1-8k", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 10}'
```

### 3. 依赖包检查 ✅

- [ ] `openai` - OpenAI SDK (兼容 GLM 和 Moonshot)
- [ ] `express` - Web 框架
- [ ] `winston` - 日志记录
- [ ] `dotenv` - 环境变量管理

### 4. 文件结构检查 ✅

```
backend/src/
├── config/
│   ├── ai-service.ts          # AI 服务冗余管理器
│   ├── voice-service.ts       # 语音服务冗余管理器
│   ├── environment.ts         # 环境配置
│   └── openai.ts             # 向后兼容的 OpenAI 配置
├── api/
│   └── service-status.ts      # 服务状态监控 API
└── docs/
    ├── ai-service-migration.md # 迁移指南
    └── deployment-checklist.md # 本文件
```

## 🚀 部署步骤

### 1. 构建应用

```bash
# 安装依赖
npm install

# 构建 TypeScript
npm run build

# 运行测试
npm run test:ai-redundancy
```

### 2. 启动服务

```bash
# 开发环境
npm run dev

# 生产环境
npm start

# 使用 PM2 (推荐)
pm2 start dist/app.js --name wordpecker-backend
```

### 3. 验证部署

```bash
# 健康检查
curl http://localhost:3000/api/service/health

# 服务状态
curl http://localhost:3000/api/service/status

# AI 功能测试
curl -X POST http://localhost:3000/api/learn \
  -H "Content-Type: application/json" \
  -d '{"word": "hello", "language": "en"}'
```

## 🔍 部署后验证

### 1. 服务状态检查 ✅

预期响应：
```json
{
  "success": true,
  "data": {
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

### 2. 故障转移测试 ✅

```bash
# 1. 临时修改 GLM API 密钥为无效值
export GLM_API_KEY="invalid_key"

# 2. 重启服务
pm2 restart wordpecker-backend

# 3. 发送测试请求，应该自动切换到 Moonshot
curl -X POST http://localhost:3000/api/learn \
  -H "Content-Type: application/json" \
  -d '{"word": "test", "language": "en"}'

# 4. 检查服务状态，GLM 应该在失败列表中
curl http://localhost:3000/api/service/status

# 5. 恢复正确的 API 密钥
export GLM_API_KEY="correct_key"

# 6. 重置失败状态
curl -X POST http://localhost:3000/api/service/ai/reset
```

### 3. 性能基准测试 ✅

```bash
# 使用 ab (Apache Bench) 进行压力测试
ab -n 100 -c 10 -T 'application/json' \
   -p test-payload.json \
   http://localhost:3000/api/learn

# test-payload.json 内容:
# {"word": "benchmark", "language": "en"}
```

预期结果：
- 成功率: 100%
- 平均响应时间: < 2000ms
- 故障转移时间: < 5000ms

## 📊 监控设置

### 1. 日志监控 ✅

```bash
# 实时查看 AI 服务日志
tail -f logs/app.log | grep "AI 服务"

# 查看故障转移日志
grep "AI 服务提供商标记为失败" logs/app.log

# 查看恢复日志
grep "AI 服务提供商已从失败列表中恢复" logs/app.log
```

### 2. 健康检查脚本 ✅

创建 `scripts/health-monitor.sh`:

```bash
#!/bin/bash
HEALTH_URL="http://localhost:3000/api/service/health"
LOG_FILE="/var/log/wordpecker-health.log"

while true; do
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  
  if curl -f $HEALTH_URL > /dev/null 2>&1; then
    echo "[$TIMESTAMP] ✅ 服务健康" >> $LOG_FILE
  else
    echo "[$TIMESTAMP] ❌ 服务异常" >> $LOG_FILE
    # 发送告警 (可选)
    # echo "WordPecker AI 服务异常" | mail -s "服务告警" admin@example.com
  fi
  
  sleep 300  # 每5分钟检查一次
done
```

### 3. Prometheus 监控 (可选) ✅

添加监控指标端点：

```typescript
// src/api/metrics.ts
import { Router } from 'express';
import { getAIServiceStatus, getVoiceServiceStatus } from '../config/ai-service';

const router = Router();

router.get('/metrics', (req, res) => {
  const aiStatus = getAIServiceStatus();
  const voiceStatus = getVoiceServiceStatus();
  
  const metrics = `
# HELP wordpecker_ai_providers_available Number of available AI providers
# TYPE wordpecker_ai_providers_available gauge
wordpecker_ai_providers_available ${aiStatus.availableProviders.length}

# HELP wordpecker_ai_providers_failed Number of failed AI providers
# TYPE wordpecker_ai_providers_failed gauge
wordpecker_ai_providers_failed ${aiStatus.failedProviders.length}

# HELP wordpecker_voice_providers_available Number of available voice providers
# TYPE wordpecker_voice_providers_available gauge
wordpecker_voice_providers_available ${voiceStatus.availableProviders.length}

# HELP wordpecker_voice_providers_failed Number of failed voice providers
# TYPE wordpecker_voice_providers_failed gauge
wordpecker_voice_providers_failed ${voiceStatus.failedProviders.length}
  `.trim();
  
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

export default router;
```

## 🚨 故障处理

### 常见故障及解决方案

#### 1. 所有 AI 服务不可用

**症状**: 
- API 返回 "AI 服务不可用" 错误
- 健康检查失败

**排查步骤**:
```bash
# 1. 检查 API 密钥
echo "GLM_API_KEY: $GLM_API_KEY"
echo "MOONSHOT_API_KEY: $MOONSHOT_API_KEY"

# 2. 检查网络连接
ping open.bigmodel.cn
ping api.moonshot.cn

# 3. 检查服务状态
curl http://localhost:3000/api/service/status

# 4. 查看详细日志
tail -100 logs/app.log | grep -E "(错误|失败|error|fail)"
```

**解决方案**:
- 验证 API 密钥是否正确
- 检查 API 配额是否用完
- 重置失败状态: `curl -X POST http://localhost:3000/api/service/ai/reset`

#### 2. 频繁故障转移

**症状**:
- 日志中频繁出现服务切换记录
- 响应时间不稳定

**排查步骤**:
```bash
# 查看切换频率
grep "AI 服务提供商标记为失败" logs/app.log | tail -20

# 检查 API 限流
curl -I https://open.bigmodel.cn/api/paas/v4/chat/completions \
  -H "Authorization: Bearer $GLM_API_KEY"
```

**解决方案**:
- 检查 API 调用频率是否过高
- 增加请求间隔或实现客户端限流
- 升级 API 套餐以获得更高配额

#### 3. 语音服务失败

**症状**:
- 语音生成功能不可用
- 音频文件生成失败

**排查步骤**:
```bash
# 测试 GLM 语音 API
curl -X POST https://open.bigmodel.cn/api/paas/v4/audio/speech \
  -H "Authorization: Bearer $GLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "glm-4-voice", "input": "测试", "voice": "alloy"}'

# 检查语音服务状态
curl http://localhost:3000/api/service/status | jq '.data.services.voice'
```

**解决方案**:
- 验证 GLM 语音模型权限
- 检查音频格式支持
- 配置 ElevenLabs 作为备选方案

## ✅ 部署完成确认

部署完成后，确认以下项目全部通过：

- [ ] 所有环境变量正确配置
- [ ] API 密钥验证通过
- [ ] 服务健康检查通过
- [ ] AI 文本生成功能正常
- [ ] 语音生成功能正常
- [ ] 故障转移机制工作正常
- [ ] 监控和日志记录正常
- [ ] 性能基准测试通过

## 📞 支持联系

如果在部署过程中遇到问题：

1. 查看 [故障排除文档](ai-service-migration.md#故障排除)
2. 检查 [GitHub Issues](https://github.com/your-repo/issues)
3. 联系技术支持团队

---

**部署日期**: ___________  
**部署人员**: ___________  
**验证人员**: ___________  
**签名确认**: ___________