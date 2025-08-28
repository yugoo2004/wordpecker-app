# AI模型降级机制控制指南

## 概述

为了便于排查火山引擎(豆包1.6)的端点连接问题，WordPecker项目新增了AI模型降级机制的控制功能。该功能允许临时禁用自动故障转移机制，强制使用指定的AI服务提供商，以便更好地诊断和解决连接问题。

## 功能特性

- ✅ **环境变量控制**: 通过配置文件控制降级行为
- ✅ **运行时API控制**: 动态开启/关闭降级机制
- ✅ **强制提供商选择**: 指定使用特定的AI服务
- ✅ **详细错误日志**: 记录完整的连接和认证错误信息
- ✅ **火山引擎专用诊断**: 针对豆包服务的连接测试
- ✅ **调试模式**: 提供更详细的运行时信息

## 使用方法

### 1. 环境变量控制（推荐）

在 `.env` 文件中添加以下配置：

```bash
# 禁用降级机制
AI_FALLBACK_ENABLED=false

# 强制使用指定提供商（可选）
AI_FORCED_PROVIDER=doubao

# 启用详细错误日志
AI_LOG_DETAILED_ERRORS=true

# 启用调试模式
AI_DEBUG_MODE=true

# 最大重试次数（禁用降级时建议设为1）
AI_MAX_RETRIES=1
```

重启服务使配置生效：

```bash
cd backend && npm run dev
```

### 2. API控制方式

#### 禁用降级机制

```bash
# 禁用降级，强制使用豆包
curl -X POST http://localhost:3000/api/management/ai/disable-fallback \
  -H "Content-Type: application/json" \
  -d '{"provider":"doubao","logErrors":true}'

# 禁用降级，强制使用GLM
curl -X POST http://localhost:3000/api/management/ai/disable-fallback \
  -H "Content-Type: application/json" \
  -d '{"provider":"glm","logErrors":true}'
```

#### 启用降级机制

```bash
curl -X POST http://localhost:3000/api/management/ai/enable-fallback
```

#### 查看当前状态

```bash
curl http://localhost:3000/api/management/ai/fallback-status
```

#### 火山引擎连接测试

```bash
curl -X POST http://localhost:3000/api/management/ai/test-volcengine
```

#### 设置调试模式

```bash
# 启用调试模式
curl -X POST http://localhost:3000/api/management/ai/debug-mode \
  -H "Content-Type: application/json" \
  -d '{"enabled":true}'

# 禁用调试模式
curl -X POST http://localhost:3000/api/management/ai/debug-mode \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}'
```

### 3. 代码级控制

```typescript
import { 
  disableAIFallback, 
  enableAIFallback, 
  getAIFallbackStatus 
} from '../config/ai-service';

// 禁用降级，强制使用豆包
disableAIFallback('doubao', true);

// 查看状态
const status = getAIFallbackStatus();
console.log('降级状态:', status);

// 恢复降级
enableAIFallback();
```

## 排查火山引擎问题

### 步骤1: 禁用降级机制

```bash
# 方法1: 环境变量
echo "AI_FALLBACK_ENABLED=false" >> .env
echo "AI_FORCED_PROVIDER=doubao" >> .env
echo "AI_LOG_DETAILED_ERRORS=true" >> .env

# 方法2: API调用
curl -X POST http://localhost:3000/api/management/ai/disable-fallback \
  -H "Content-Type: application/json" \
  -d '{"provider":"doubao","logErrors":true}'
```

### 步骤2: 测试火山引擎连接

```bash
# 专用测试端点
curl -X POST http://localhost:3000/api/management/ai/test-volcengine

# 或测试任意词汇生成API
curl -X POST http://localhost:3000/api/vocabulary/generate \
  -H "Content-Type: application/json" \
  -d '{"theme":"test","count":1,"language":"en"}'
```

### 步骤3: 查看详细错误日志

```bash
# 查看实时日志
tail -f logs/backend.log | grep -E "(doubao|volcengine|豆包)"

# 查看详细错误文件
cat logs/ai-service-errors.json | jq '.'

# 查看最新错误
tail -n 1 logs/ai-service-errors.json | jq '.'
```

### 步骤4: 分析错误类型

#### 网络连接错误
```json
{
  "errorType": "ECONNREFUSED",
  "networkDiagnostics": {
    "errorCode": "ECONNREFUSED",
    "suggestion": "请检查网络连接和火山引擎端点配置"
  }
}
```

**解决方案**: 检查网络连接和端点配置

#### 认证错误
```json
{
  "errorType": "401",
  "authDiagnostics": {
    "suggestion": "请检查VOLCENGINE_ACCESS_KEY_ID和VOLCENGINE_SECRET_ACCESS_KEY是否配置正确"
  }
}
```

**解决方案**: 验证API密钥配置

#### 端点配置错误
```json
{
  "volcengineDetails": {
    "endpointConfigured": false,
    "credentialsConfigured": true,
    "serviceInitialized": false
  }
}
```

**解决方案**: 检查 `DOUBAO_ENDPOINT` 配置

### 步骤5: 恢复降级机制

问题解决后，记得恢复降级机制：

```bash
# API方式
curl -X POST http://localhost:3000/api/management/ai/enable-fallback

# 或修改环境变量
sed -i 's/AI_FALLBACK_ENABLED=false/AI_FALLBACK_ENABLED=true/' .env
```

## 测试脚本

项目提供了专门的测试脚本来验证降级控制功能：

```bash
cd backend
npx ts-node scripts/test-fallback-control.ts
```

测试脚本会验证：
- ✅ 正常降级机制
- ✅ 禁用降级（豆包）
- ✅ 禁用降级（GLM）
- ✅ 详细错误日志
- ✅ 管理API端点

## 常见问题

### Q: 禁用降级后服务完全不可用？

A: 检查强制指定的提供商是否正确配置：
```bash
# 查看状态
curl http://localhost:3000/api/management/ai/fallback-status

# 切换到可用的提供商
curl -X POST http://localhost:3000/api/management/ai/disable-fallback \
  -d '{"provider":"glm","logErrors":true}'
```

### Q: 详细错误日志在哪里？

A: 详细错误日志保存在以下位置：
- 主日志: `logs/backend.log`
- 详细错误: `logs/ai-service-errors.json`

### Q: 如何验证降级机制是否真的被禁用？

A: 检查日志中是否出现类似信息：
```
AI降级机制已禁用 {"forcedProvider":"doubao","reason":"手动禁用"}
强制使用AI提供商: doubao
```

### Q: 测试完成后忘记恢复降级怎么办？

A: 重启服务会自动恢复环境变量配置，或手动调用：
```bash
curl -X POST http://localhost:3000/api/management/ai/enable-fallback
```

## 注意事项

1. **仅调试使用**: 降级禁用功能仅用于问题排查，不建议在生产环境长期使用
2. **恢复机制**: 测试完成后及时恢复降级机制，确保系统稳定性
3. **日志清理**: 详细错误日志可能占用较多磁盘空间，建议定期清理
4. **服务重启**: 修改环境变量后需要重启服务才能生效

## 支持的AI提供商

- `doubao`: 豆包1.6 (火山引擎)
- `glm`: GLM-4.5 (智谱AI)  
- `moonshot`: Moonshot AI
- `qwen`: 通义千问
- `minimax`: MiniMax
- `baichuan`: 百川AI

## API响应示例

### 禁用降级成功响应
```json
{
  "success": true,
  "message": "AI降级机制已禁用",
  "config": {
    "fallbackDisabled": true,
    "forcedProvider": "doubao",
    "detailedLogging": true
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 火山引擎测试成功响应
```json
{
  "success": true,
  "message": "火山引擎连接成功",
  "data": {
    "provider": "doubao",
    "model": "doubao-pro-32k",
    "tokensUsed": 25,
    "response": "你好！我是豆包..."
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 火山引擎测试失败响应
```json
{
  "success": false,
  "error": "强制指定的AI服务提供商不可用: doubao",
  "details": {
    "errorType": "Error",
    "provider": "doubao",
    "suggestion": "请检查火山引擎配置和网络连接"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

通过这些工具和方法，您可以有效地排查和解决火山引擎的连接问题，同时保持系统的稳定性和可维护性。