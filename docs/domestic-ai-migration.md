# WordPecker 国产AI迁移指南

> **Linus说**: "Talk is cheap, show me the code!" - 这份指南会告诉你怎么把WordPecker迁移到完全的国产AI服务。

## 🎯 迁移目标

将WordPecker的以下功能完全迁移到国产AI服务：

- ✅ **文本生成**: 例句生成、相似词生成、词汇生成
- ✅ **语音合成**: 单词发音、句子朗读
- ✅ **服务冗余**: 多个服务提供商自动故障转移

## 🚀 支持的国产AI服务

### 文本生成服务 (按优先级排序)

| 优先级 | 服务商 | 模型 | 状态 | 获取链接 |
|--------|--------|------|------|----------|
| 1 | GLM (智谱AI) | glm-4.5 | ✅ 已集成 | [获取API](https://open.bigmodel.cn/) |
| 2 | Moonshot AI | moonshot-v1-8k | ✅ 已集成 | [获取API](https://platform.moonshot.cn/) |
| 3 | Qwen (通义千问) | qwen-plus | ✅ 已集成 | [获取API](https://dashscope.console.aliyun.com/) |
| 4 | MiniMax | abab6.5s-chat | ✅ 已集成 | [获取API](https://www.minimax.chat/) |
| 5 | Baichuan | Baichuan2-Turbo | ✅ 已集成 | [获取API](https://platform.baichuan-ai.com/) |

### 语音合成服务

| 优先级 | 服务商 | 模型 | 状态 | 说明 |
|--------|--------|------|------|------|
| 1 | GLM-4-voice | glm-4-voice | ✅ 已集成 | 主要语音服务 |
| 2 | MiniMax Voice | speech-01 | 🚧 待实现 | 备选语音服务 |
| 3 | 豆包 (字节) | doubao-voice | 🚧 待实现 | 备选语音服务 |
| 4 | ElevenLabs | eleven_multilingual_v2 | ✅ 保留 | 国外服务兜底 |

## 🔧 快速部署

### 1. 复制配置文件

```bash
# 复制国产化配置模板
cp .env.domestic.example .env

# 编辑配置文件，填入你的API密钥
vim .env
```

### 2. 配置API密钥

至少配置以下两个主要服务：

```bash
# 必须配置 - GLM (智谱AI)
GLM_API_KEY=your_glm_api_key_here

# 必须配置 - Moonshot AI (备选)
MOONSHOT_API_KEY=your_moonshot_api_key_here

# 可选配置 - 更多冗余
QWEN_API_KEY=your_qwen_api_key_here
MINIMAX_API_KEY=your_minimax_api_key_here
BAICHUAN_API_KEY=your_baichuan_api_key_here
```

### 3. 测试服务

```bash
# 测试所有国产AI服务
npm run test:domestic-ai

# 查看测试结果
# ✅ 成功的服务会显示绿色
# ❌ 失败的服务会显示错误信息
```

### 4. 启动应用

```bash
# 启动后端
npm run dev

# 检查服务状态
curl http://localhost:3000/api/health
```

## 🎯 迁移策略

### 阶段1: 冗余部署 (推荐) ✅

保持现有服务，增加国产AI作为备选：

```
OpenAI/Moonshot -> GLM -> Qwen -> MiniMax -> Baichuan
ElevenLabs -> GLM-4-voice -> 其他国产语音
```

**优点**: 
- 零风险迁移
- 渐进式测试
- 随时回滚

### 阶段2: 主备切换

将国产AI设为主要服务：

```
GLM -> Moonshot -> Qwen -> (OpenAI作为最后备选)
GLM-4-voice -> (ElevenLabs作为备选)
```

### 阶段3: 完全国产化 🎯

移除所有国外服务：

```
GLM -> Moonshot -> Qwen -> MiniMax -> Baichuan
GLM-4-voice -> MiniMax-voice -> 豆包语音
```

## 🧪 测试与验证

### 功能测试

```bash
# 测试词汇生成
curl -X POST http://localhost:3000/api/vocabulary/generate \
  -H "Content-Type: application/json" \
  -d '{"count": 5, "difficulty": "intermediate", "context": "technology"}'

# 测试例句生成
curl -X POST http://localhost:3000/api/words/examples \
  -H "Content-Type: application/json" \
  -d '{"word": "algorithm", "meaning": "算法"}'

# 测试相似词生成
curl -X POST http://localhost:3000/api/words/similar \
  -H "Content-Type: application/json" \
  -d '{"word": "computer", "meaning": "计算机"}'

# 测试语音合成
curl -X POST http://localhost:3000/api/voice/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "language": "en"}'
```

### 压力测试

```bash
# 模拟服务故障，测试自动切换
# 临时禁用GLM服务，看是否自动切换到Moonshot
```

## 📊 性能对比

### 响应速度 (平均)

| 服务商 | 文本生成 | 语音合成 | 地理位置 |
|--------|----------|----------|----------|
| GLM | ~2s | ~3s | 中国 |
| Moonshot | ~1.5s | N/A | 中国 |
| Qwen | ~2.5s | N/A | 中国 |
| OpenAI | ~3s | N/A | 美国 |
| ElevenLabs | N/A | ~4s | 美国 |

### 成本对比 (每1000次调用)

| 服务商 | 文本生成 | 语音合成 | 币种 |
|--------|----------|----------|------|
| GLM | ¥2-5 | ¥8-15 | 人民币 |
| Moonshot | ¥3-6 | N/A | 人民币 |
| Qwen | ¥1-4 | N/A | 人民币 |
| OpenAI | $5-10 | N/A | 美元 |
| ElevenLabs | N/A | $15-30 | 美元 |

## 🛠️ 故障排除

### 常见问题

#### 1. API密钥无效
```bash
# 检查API密钥格式
echo $GLM_API_KEY | wc -c
# GLM密钥通常是64位字符

# 测试API连接
curl -H "Authorization: Bearer $GLM_API_KEY" \
  https://open.bigmodel.cn/api/paas/v4/models
```

#### 2. 请求超时
```bash
# 检查网络连接
ping open.bigmodel.cn
ping api.moonshot.cn

# 调整超时设置
export AI_REQUEST_TIMEOUT=60
```

#### 3. 配额用完
```bash
# 检查API配额
curl -H "Authorization: Bearer $GLM_API_KEY" \
  https://open.bigmodel.cn/api/paas/v4/quota
```

### 日志分析

```bash
# 查看AI服务切换日志
tail -f logs/app.log | grep "AI 服务"

# 查看错误日志
tail -f logs/app.log | grep "ERROR"
```

## 🐧 Linus的建议

1. **渐进迁移**: 不要一次性切换所有服务，从一个开始
2. **监控优先**: 确保有完善的日志和监控
3. **测试驱动**: 每个服务都要有自动化测试
4. **备份策略**: 永远保留至少一个可用的备选方案
5. **文档更新**: 记录每次迁移的决策和结果

**记住**: "好的代码会说话，坏的代码需要解释。"确保你的国产化方案简洁、可靠、易维护。

## 📋 迁移检查清单

- [ ] 配置至少2个国产AI文本服务
- [ ] 配置至少1个国产语音服务  
- [ ] 运行自动化测试
- [ ] 验证故障转移机制
- [ ] 更新监控和日志
- [ ] 准备回滚方案
- [ ] 更新部署文档

---

**需要帮助？** 

- 查看日志: `tail -f logs/app.log`
- 运行测试: `npm run test:domestic-ai`
- 检查健康状态: `curl http://localhost:3000/api/health`