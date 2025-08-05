# Pexels API 使用说明文档

## 概述

本文档详细说明了 WordPecker 应用中 Pexels API 的配置、使用方法和最佳实践。Pexels API 用于为用户提供高质量的随机图片，增强词汇学习体验。

## API 密钥配置

### 1. 获取 API 密钥

1. 访问 [Pexels API 官网](https://www.pexels.com/api/)
2. 点击 "Get Started" 或 "Request API Key"
3. 使用邮箱注册或登录现有账户
4. 填写应用信息：
   - **应用名称**: WordPecker
   - **应用描述**: 语言学习应用，用于词汇学习的图片展示
   - **网站URL**: 您的应用域名
   - **应用类型**: Web Application
5. 提交申请后，API 密钥将发送到您的邮箱

### 2. 配置 API 密钥

将获取的 API 密钥添加到环境变量中：

```bash
# 在 .env 文件中添加
PEXELS_API_KEY=your_actual_api_key_here
```

**重要提示**:
- API 密钥长度通常为 30-60 个字符
- 密钥格式为字母数字组合
- 请妥善保管，不要提交到版本控制系统

### 3. 验证配置

启动应用后，可以通过以下端点验证 API 配置：

```bash
curl http://localhost:3000/api/image-description/validate-api
```

成功响应示例：
```json
{
  "success": true,
  "status": "valid",
  "message": "Pexels API 配置验证成功",
  "apiKey": {
    "status": "valid",
    "format": "correct"
  }
}
```

## API 端点使用

### 1. 获取随机图片

**端点**: `GET /api/image-description/random`

**参数**:
- `sessionId` (可选): 用户会话ID，用于避免重复图片
- `query` (可选): 搜索关键词，不提供则智能生成

**使用示例**:
```bash
# 获取完全随机图片
curl "http://localhost:3000/api/image-description/random"

# 基于关键词获取图片
curl "http://localhost:3000/api/image-description/random?query=nature"

# 带会话ID避免重复
curl "http://localhost:3000/api/image-description/random?sessionId=user123&query=technology"
```

**响应格式**:
```json
{
  "success": true,
  "image": {
    "id": "pexels_1754320767762_60504",
    "url": "https://images.pexels.com/photos/60504/computer-keyboard-keys-white-60504.jpeg",
    "alt": "Close-up view of computer keyboard keys",
    "description": "Stock photograph from Pexels depicting computer with rich vocabulary opportunities",
    "prompt": "computer",
    "source": "pexels"
  },
  "message": "成功获取随机图片"
}
```

### 2. 获取分类随机图片

**端点**: `GET /api/image-description/random/:category`

**支持的分类**:
- `business` - 商业
- `technology` - 技术
- `food` - 食物
- `travel` - 旅行
- `nature` - 自然
- `sports` - 运动
- `education` - 教育
- `health` - 健康

**使用示例**:
```bash
# 获取商业类图片
curl "http://localhost:3000/api/image-description/random/business"

# 带会话ID的分类图片
curl "http://localhost:3000/api/image-description/random/technology?sessionId=user123"
```

### 3. API 配置验证

**端点**: `GET /api/image-description/validate-api`

**功能**:
- 验证 API 密钥有效性
- 获取使用统计信息
- 检查会话状态

**使用示例**:
```bash
curl "http://localhost:3000/api/image-description/validate-api"
```

## 配额管理

### 免费配额限制

Pexels API 免费版本提供：
- **每月请求数**: 25,000 次
- **每小时请求数**: 200 次
- **并发请求数**: 20 个

### 配额监控

应用会自动监控 API 使用情况：

```json
{
  "usage": {
    "totalRequests": 1250,
    "successfulRequests": 1200,
    "failedRequests": 50,
    "successRate": "96.00%",
    "averageResponseTime": "850ms",
    "lastRequestTime": "2025-08-05T10:30:00.000Z"
  }
}
```

### 配额优化建议

1. **启用会话管理**: 使用 `sessionId` 参数避免重复请求
2. **智能缓存**: 应用会自动缓存图片信息
3. **错误重试**: 实现了指数退避重试机制
4. **请求限流**: 自动限制请求频率

## 会话管理

### 会话ID 使用

会话ID 用于跟踪用户的图片浏览历史，避免在同一会话中返回重复图片：

```javascript
// 前端使用示例
const sessionId = `user_${userId}_${Date.now()}`;
const response = await fetch(`/api/image-description/random?sessionId=${sessionId}`);
```

### 会话清理

应用会自动清理过期会话：
- **清理间隔**: 每小时
- **会话过期时间**: 24小时
- **内存限制**: 最多保存1000个活跃会话

## 错误处理

### 常见错误类型

| 错误代码 | HTTP状态 | 描述 | 解决方案 |
|---------|---------|------|----------|
| `API_KEY_INVALID` | 401 | API密钥无效 | 检查环境变量配置 |
| `QUOTA_EXCEEDED` | 429 | 配额超限 | 等待配额重置或升级计划 |
| `NO_IMAGES_FOUND` | 404 | 未找到图片 | 尝试其他搜索关键词 |
| `NETWORK_ERROR` | 503 | 网络错误 | 检查网络连接 |

### 错误响应格式

```json
{
  "success": false,
  "error": "API_KEY_INVALID",
  "message": "Pexels API 密钥无效",
  "details": "请检查环境变量 PEXELS_API_KEY 的配置",
  "code": 401
}
```

## 性能优化

### 响应时间优化

1. **连接池**: 使用 HTTP 连接池减少连接开销
2. **超时设置**: 合理设置请求超时时间（10秒）
3. **重试机制**: 指数退避重试，最多3次
4. **并发控制**: 限制同时进行的请求数量

### 内存使用优化

1. **会话清理**: 定期清理过期会话数据
2. **图片缓存**: 智能缓存热门图片信息
3. **内存监控**: 监控内存使用情况，防止内存泄漏

## 最佳实践

### 1. 搜索关键词选择

**推荐关键词**:
- 具体名词: `computer`, `book`, `coffee`
- 行业术语: `business`, `technology`, `education`
- 情感词汇: `happy`, `peaceful`, `energetic`

**避免使用**:
- 过于抽象的词汇
- 可能涉及版权的品牌名称
- 不适宜的内容关键词

### 2. 会话管理

```javascript
// 推荐的会话ID生成方式
const generateSessionId = (userId) => {
  return `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
```

### 3. 错误处理

```javascript
// 推荐的错误处理方式
try {
  const response = await fetch('/api/image-description/random');
  const data = await response.json();
  
  if (!data.success) {
    console.error('API Error:', data.error);
    // 显示用户友好的错误信息
    showErrorMessage(data.message);
  }
} catch (error) {
  console.error('Network Error:', error);
  showErrorMessage('网络连接失败，请稍后重试');
}
```

## 监控和日志

### 日志记录

应用会记录以下信息：
- API 请求和响应时间
- 错误详情和频率
- 配额使用情况
- 会话统计信息

### 监控指标

关键性能指标：
- **成功率**: 目标 > 95%
- **平均响应时间**: 目标 < 2秒
- **配额使用率**: 监控月度使用情况
- **错误率**: 按错误类型分类统计

## 升级和扩展

### 付费计划

如需更高配额，可考虑升级到 Pexels API 付费计划：
- **Pro 计划**: 每月 100,000 次请求
- **Enterprise 计划**: 无限制请求
- **自定义计划**: 根据需求定制

### 多源支持

未来可扩展支持其他图片API：
- Unsplash API
- Pixabay API
- Getty Images API

## 技术支持

### 联系方式

- **Pexels 官方支持**: [help@pexels.com](mailto:help@pexels.com)
- **API 文档**: https://www.pexels.com/api/documentation/
- **状态页面**: https://status.pexels.com/

### 常见问题

**Q: API 密钥多久过期？**
A: Pexels API 密钥通常不会过期，除非账户被暂停或主动重置。

**Q: 可以在多个应用中使用同一个 API 密钥吗？**
A: 可以，但建议为不同应用申请不同的密钥以便于管理和监控。

**Q: 如何处理图片版权问题？**
A: Pexels 提供的所有图片都是免费使用的，但建议在商业用途中注明图片来源。

---

*最后更新: 2025年8月5日*