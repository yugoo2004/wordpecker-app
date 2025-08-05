# Pexels API 故障排除指南

## 概述

本指南帮助开发者和系统管理员快速诊断和解决 Pexels API 集成中的常见问题。按照问题类型分类，提供详细的排查步骤和解决方案。

## 快速诊断

### 健康检查命令

首先运行以下命令进行快速诊断：

```bash
# 1. 检查 API 配置
curl -X GET "http://localhost:3000/api/image-description/validate-api"

# 2. 测试随机图片获取
curl -X GET "http://localhost:3000/api/image-description/random"

# 3. 检查应用健康状态
curl -X GET "http://localhost:3000/api/health"
```

### 诊断脚本

运行内置的诊断脚本：

```bash
# 进入后端目录
cd backend

# 运行 Pexels API 直接测试
npm run test:pexels-direct

# 运行完整的 API 集成测试
npm run test:pexels-integration

# 验证 API 配置
npm run validate:pexels-config
```

## 常见问题分类

### 1. API 密钥相关问题

#### 问题：API 密钥无效 (401 错误)

**症状**:
```json
{
  "success": false,
  "error": "API_KEY_INVALID",
  "message": "Pexels API 密钥无效",
  "code": 401
}
```

**排查步骤**:

1. **检查环境变量配置**:
   ```bash
   # 检查 .env 文件
   cat backend/.env | grep PEXELS_API_KEY
   
   # 检查环境变量是否加载
   node -e "console.log('PEXELS_API_KEY:', process.env.PEXELS_API_KEY)"
   ```

2. **验证密钥格式**:
   ```bash
   # 密钥长度应该在 30-60 字符之间
   node -e "
   const key = process.env.PEXELS_API_KEY;
   console.log('密钥长度:', key ? key.length : '未设置');
   console.log('密钥格式:', key ? /^[a-zA-Z0-9]+$/.test(key) : '无法验证');
   "
   ```

3. **直接测试 API 密钥**:
   ```bash
   # 使用 curl 直接测试 Pexels API
   curl -H "Authorization: YOUR_API_KEY" \
        "https://api.pexels.com/v1/search?query=nature&per_page=1"
   ```

**解决方案**:

- **重新获取 API 密钥**: 访问 [Pexels API](https://www.pexels.com/api/) 重新申请
- **检查密钥复制**: 确保没有多余的空格或换行符
- **更新环境变量**: 重新设置 `PEXELS_API_KEY` 并重启应用
- **验证账户状态**: 确认 Pexels 账户未被暂停

#### 问题：API 密钥格式错误

**症状**:
```json
{
  "success": false,
  "error": "API_KEY_INVALID",
  "message": "API 密钥格式不正确",
  "details": "密钥长度应为30-60个字符的字母数字组合"
}
```

**解决方案**:
```bash
# 检查并清理密钥
export CLEAN_KEY=$(echo "$PEXELS_API_KEY" | tr -d '[:space:]')
echo "清理后的密钥: $CLEAN_KEY"
echo "密钥长度: ${#CLEAN_KEY}"
```

### 2. 配额和限制问题

#### 问题：配额超限 (429 错误)

**症状**:
```json
{
  "success": false,
  "error": "QUOTA_EXCEEDED",
  "message": "API 配额已超限",
  "retryAfter": 3600
}
```

**排查步骤**:

1. **检查当前配额使用**:
   ```bash
   curl "http://localhost:3000/api/image-description/validate-api" | jq '.usage'
   ```

2. **查看配额重置时间**:
   ```bash
   # 检查响应头中的配额信息
   curl -I -H "Authorization: YOUR_API_KEY" \
        "https://api.pexels.com/v1/search?query=test&per_page=1"
   ```

**解决方案**:

- **等待配额重置**: 免费版每月25,000次，每小时200次
- **优化请求频率**: 实现请求缓存和去重
- **升级付费计划**: 考虑升级到 Pro 或 Enterprise 计划
- **实现请求队列**: 使用队列管理请求频率

#### 问题：请求频率过高

**临时解决方案**:
```javascript
// 在代码中添加请求延迟
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function makeRequest() {
  await delay(1000); // 每次请求间隔1秒
  // 执行 API 请求
}
```

### 3. 网络连接问题

#### 问题：网络超时 (503 错误)

**症状**:
```json
{
  "success": false,
  "error": "NETWORK_ERROR",
  "message": "网络连接超时",
  "details": "请检查网络连接或稍后重试"
}
```

**排查步骤**:

1. **测试网络连接**:
   ```bash
   # 测试到 Pexels API 的连接
   curl -I "https://api.pexels.com/v1/search?query=test&per_page=1"
   
   # 检查 DNS 解析
   nslookup api.pexels.com
   
   # 测试网络延迟
   ping api.pexels.com
   ```

2. **检查防火墙设置**:
   ```bash
   # 检查出站连接是否被阻止
   telnet api.pexels.com 443
   ```

3. **验证代理设置**:
   ```bash
   # 检查代理环境变量
   echo $HTTP_PROXY
   echo $HTTPS_PROXY
   ```

**解决方案**:

- **增加超时时间**: 在配置中调整请求超时设置
- **配置代理**: 如果在企业网络环境中，配置正确的代理
- **重试机制**: 确保重试机制正常工作
- **网络诊断**: 联系网络管理员检查防火墙规则

### 4. 图片获取问题

#### 问题：未找到图片 (404 错误)

**症状**:
```json
{
  "success": false,
  "error": "NO_IMAGES_FOUND",
  "message": "未找到匹配的图片",
  "query": "very_specific_unusual_term"
}
```

**排查步骤**:

1. **测试不同的搜索词**:
   ```bash
   # 测试通用搜索词
   curl "http://localhost:3000/api/image-description/random?query=nature"
   
   # 测试无搜索词的随机获取
   curl "http://localhost:3000/api/image-description/random"
   ```

2. **检查搜索词有效性**:
   ```bash
   # 直接在 Pexels 网站搜索测试
   curl -H "Authorization: YOUR_API_KEY" \
        "https://api.pexels.com/v1/search?query=YOUR_SEARCH_TERM&per_page=1"
   ```

**解决方案**:

- **使用通用搜索词**: 避免过于具体或生僻的词汇
- **实现搜索词回退**: 当特定搜索失败时使用通用词汇
- **启用智能搜索**: 使用 contextual image agent 生成更好的搜索词
- **多语言支持**: 尝试英文搜索词

#### 问题：图片质量不佳

**排查步骤**:

1. **检查返回的图片URL**:
   ```bash
   curl "http://localhost:3000/api/image-description/random" | jq '.image.url'
   ```

2. **验证图片尺寸**:
   ```bash
   # 获取图片信息
   curl -I "RETURNED_IMAGE_URL"
   ```

**解决方案**:

- **调整图片尺寸参数**: 在 Pexels API 请求中指定更高分辨率
- **过滤低质量图片**: 在代码中添加图片质量过滤逻辑
- **使用不同的搜索策略**: 尝试更具体的搜索词

### 5. 会话管理问题

#### 问题：重复图片问题

**症状**: 同一会话中返回相同的图片

**排查步骤**:

1. **检查会话状态**:
   ```bash
   curl "http://localhost:3000/api/image-description/validate-api" | jq '.sessions'
   ```

2. **测试会话去重**:
   ```bash
   # 使用相同 sessionId 多次请求
   SESSION_ID="test_session_$(date +%s)"
   curl "http://localhost:3000/api/image-description/random?sessionId=$SESSION_ID"
   curl "http://localhost:3000/api/image-description/random?sessionId=$SESSION_ID"
   ```

**解决方案**:

- **确保传递 sessionId**: 前端应该一致地传递会话ID
- **检查会话清理**: 确认会话清理机制正常工作
- **增加图片池大小**: 扩大可选图片的范围
- **重置会话**: 必要时手动清理会话数据

#### 问题：内存使用过高

**排查步骤**:

1. **监控内存使用**:
   ```bash
   # 检查 Node.js 进程内存使用
   ps aux | grep node
   
   # 使用内置监控
   curl "http://localhost:3000/api/image-description/validate-api" | jq '.sessions'
   ```

2. **检查会话数量**:
   ```bash
   # 查看活跃会话数
   node -e "
   const sessionManager = require('./src/api/image-description/session-manager');
   console.log('活跃会话数:', sessionManager.getActiveSessionCount());
   "
   ```

**解决方案**:

- **调整会话清理频率**: 更频繁地清理过期会话
- **限制会话数量**: 设置最大会话数限制
- **优化数据结构**: 减少每个会话存储的数据量
- **重启应用**: 临时解决方案，重启应用清理内存

### 6. 配置和部署问题

#### 问题：环境变量未加载

**症状**: 应用启动时提示缺少必需的环境变量

**排查步骤**:

1. **检查 .env 文件**:
   ```bash
   # 确认文件存在
   ls -la backend/.env
   
   # 检查文件内容
   cat backend/.env | grep -E "(PEXELS|OPENAI|MONGODB)"
   ```

2. **验证环境变量加载**:
   ```bash
   # 在应用启动时检查
   node -e "
   require('dotenv').config();
   console.log('PEXELS_API_KEY:', process.env.PEXELS_API_KEY ? '已设置' : '未设置');
   "
   ```

**解决方案**:

- **检查文件路径**: 确保 .env 文件在正确位置
- **验证文件权限**: 确保应用有读取权限
- **重新加载配置**: 重启应用或重新加载环境变量
- **使用绝对路径**: 在 dotenv 配置中使用绝对路径

#### 问题：Docker 环境配置

**Docker 环境特殊排查**:

1. **检查容器内环境变量**:
   ```bash
   # 进入容器
   docker exec -it wordpecker-backend bash
   
   # 检查环境变量
   env | grep PEXELS
   ```

2. **验证网络连接**:
   ```bash
   # 在容器内测试外部连接
   curl -I "https://api.pexels.com"
   ```

**解决方案**:

- **更新 docker-compose.yml**: 确保环境变量正确传递
- **重建容器**: `docker-compose down && docker-compose up --build`
- **检查网络配置**: 确保容器可以访问外部网络

## 性能优化建议

### 1. 请求优化

```javascript
// 实现请求缓存
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

async function getCachedImage(query) {
  const cacheKey = `image_${query}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const result = await fetchImageFromAPI(query);
  cache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });
  
  return result;
}
```

### 2. 错误重试策略

```javascript
// 指数退避重试
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 3. 监控和告警

```javascript
// 性能监控
class APIMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      totalResponseTime: 0
    };
  }
  
  recordRequest(responseTime, success) {
    this.metrics.requests++;
    this.metrics.totalResponseTime += responseTime;
    
    if (!success) {
      this.metrics.errors++;
    }
    
    // 检查错误率
    const errorRate = this.metrics.errors / this.metrics.requests;
    if (errorRate > 0.1) { // 10% 错误率告警
      console.warn('API 错误率过高:', errorRate);
    }
  }
  
  getStats() {
    return {
      ...this.metrics,
      averageResponseTime: this.metrics.totalResponseTime / this.metrics.requests,
      errorRate: this.metrics.errors / this.metrics.requests
    };
  }
}
```

## 日志分析

### 关键日志位置

```bash
# 应用日志
tail -f backend/backend.log

# Docker 日志
docker logs wordpecker-backend

# 系统日志
journalctl -u wordpecker -f
```

### 日志分析命令

```bash
# 查找 API 错误
grep "PEXELS_API_ERROR" backend/backend.log

# 统计错误类型
grep "error" backend/backend.log | awk '{print $3}' | sort | uniq -c

# 分析响应时间
grep "response_time" backend/backend.log | awk '{sum+=$4; count++} END {print "平均响应时间:", sum/count, "ms"}'
```

## 预防措施

### 1. 监控设置

```bash
# 设置 cron 任务定期检查 API 状态
# 添加到 crontab
*/5 * * * * curl -f http://localhost:3000/api/image-description/validate-api || echo "API 检查失败" | mail -s "Pexels API Alert" admin@example.com
```

### 2. 自动化测试

```bash
# 添加到 CI/CD 流程
npm run test:pexels-integration
npm run test:api-endpoints
npm run validate:environment
```

### 3. 配置备份

```bash
# 定期备份配置文件
cp backend/.env backend/.env.backup.$(date +%Y%m%d)
```

## 联系支持

### 内部支持

- **开发团队**: 检查代码实现和配置
- **运维团队**: 检查服务器和网络配置
- **产品团队**: 确认功能需求和用户反馈

### 外部支持

- **Pexels 支持**: [help@pexels.com](mailto:help@pexels.com)
- **API 文档**: https://www.pexels.com/api/documentation/
- **状态页面**: https://status.pexels.com/
- **社区论坛**: https://help.pexels.com/

### 紧急联系

如果遇到严重的生产问题：

1. **立即降级**: 禁用图片功能，使用默认图片
2. **通知团队**: 发送紧急通知给相关团队
3. **记录问题**: 详细记录问题现象和排查步骤
4. **寻求支持**: 联系 Pexels 技术支持

---

*最后更新: 2025年8月5日*
*版本: 1.0*