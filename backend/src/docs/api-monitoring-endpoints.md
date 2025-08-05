# API 监控和统计端点文档

本文档描述了为随机图片 API 新增的监控和统计功能端点。

## 端点概览

### 1. API 使用统计 - `/api/image-description/stats`

**方法**: `GET`  
**描述**: 获取 API 使用的综合统计信息

**响应示例**:
```json
{
  "success": true,
  "timestamp": "2025-08-05T03:49:03.418Z",
  "statistics": {
    "requests": {
      "total": 6,
      "successful": 6,
      "failed": 0,
      "successRate": "100.00%",
      "requestsPerHour": 6,
      "requestsToday": 6
    },
    "performance": {
      "averageResponseTime": "854ms",
      "fastestResponse": "461ms",
      "slowestResponse": "2796ms",
      "p95ResponseTime": "2796ms",
      "p99ResponseTime": "2796ms"
    },
    "quota": {
      "currentUsage": 45,
      "limit": 25000,
      "usagePercentage": "0.18%",
      "resetTime": "2025-09-03T15:16:05.000Z",
      "estimatedDailyUsage": 6,
      "projectedMonthlyUsage": 180
    },
    "errors": {},
    "sessions": {
      "activeSessions": 1,
      "totalImagesTracked": 6,
      "oldestSession": "2025-08-05T03:49:01.559Z"
    },
    "lastRequestTime": "2025-08-05T03:49:03.418Z"
  }
}
```

### 2. 性能指标 - `/api/image-description/metrics`

**方法**: `GET`  
**参数**: 
- `limit` (可选): 返回的指标记录数量，默认 100

**描述**: 获取详细的性能指标和历史数据

**响应示例**:
```json
{
  "success": true,
  "timestamp": "2025-08-05T03:49:03.418Z",
  "summary": {
    "totalMetrics": 6,
    "successfulRequests": 6,
    "failedRequests": 0,
    "averageResponseTime": 854,
    "errorsByType": {}
  },
  "hourlyStats": [
    {
      "hour": "2025-08-05T03:00:00Z",
      "totalRequests": 6,
      "successfulRequests": 6,
      "failedRequests": 0,
      "averageResponseTime": 854
    }
  ],
  "recentMetrics": [
    {
      "requestId": "req_1754365742859_8zoucgz59",
      "timestamp": "2025-08-05T03:49:03.418Z",
      "responseTime": 559,
      "success": true,
      "query": "portrait",
      "sessionId": "test-session-stats"
    }
  ]
}
```

### 3. 配额监控 - `/api/image-description/quota`

**方法**: `GET`  
**描述**: 获取 API 配额使用情况和健康状态

**响应示例**:
```json
{
  "success": true,
  "timestamp": "2025-08-05T03:49:03.418Z",
  "quota": {
    "current": 45,
    "limit": 25000,
    "remaining": 24955,
    "usagePercentage": "0.18%",
    "resetTime": "2025-09-03T15:16:05.000Z"
  },
  "usage": {
    "requestsToday": 6,
    "requestsPerHour": 6,
    "estimatedDailyUsage": 6,
    "projectedMonthlyUsage": 180
  },
  "health": {
    "status": "healthy",
    "estimatedExhaustionTime": null,
    "recommendations": [
      "配额使用正常，建议继续监控"
    ]
  }
}
```

### 4. API 配置验证 - `/api/image-description/validate-api`

**方法**: `GET`  
**描述**: 验证 Pexels API 配置和密钥有效性

**成功响应示例**:
```json
{
  "success": true,
  "status": "valid",
  "message": "Pexels API 配置验证成功",
  "apiKey": {
    "status": "valid",
    "format": "correct"
  },
  "usage": {
    "totalRequests": 6,
    "successfulRequests": 6,
    "failedRequests": 0,
    "successRate": "100.00%",
    "averageResponseTime": "854ms",
    "lastRequestTime": "2025-08-05T03:49:03.418Z"
  },
  "sessions": {
    "activeSessions": 1,
    "totalImagesTracked": 6,
    "oldestSession": "2025-08-05T03:49:01.559Z"
  },
  "timestamp": "2025-08-05T03:49:03.418Z"
}
```

**失败响应示例**:
```json
{
  "success": false,
  "status": "invalid",
  "message": "Pexels API 配置验证失败",
  "apiKey": {
    "status": "invalid",
    "error": "API密钥无效或已过期"
  },
  "recommendations": [
    "检查 PEXELS_API_KEY 环境变量是否正确设置",
    "确认API密钥格式正确（应为64位十六进制字符串）",
    "验证API密钥是否已过期或被撤销",
    "访问 https://www.pexels.com/api/ 获取新的API密钥"
  ],
  "timestamp": "2025-08-05T03:49:03.418Z"
}
```

### 5. 重置统计数据 - `/api/image-description/reset-stats`

**方法**: `POST`  
**描述**: 重置所有统计数据（仅用于开发和测试环境）

**注意**: 在生产环境中此端点被禁用

**响应示例**:
```json
{
  "success": true,
  "message": "API 统计数据已重置",
  "timestamp": "2025-08-05T03:49:03.418Z"
}
```

## 健康状态说明

配额健康状态分为以下几个级别：

- **healthy**: 配额使用率 < 50%
- **moderate**: 配额使用率 50% - 75%
- **warning**: 配额使用率 75% - 90%
- **critical**: 配额使用率 > 90%

## 错误代码说明

API 可能返回的错误代码：

- `API_KEY_INVALID`: API 密钥无效或已过期
- `QUOTA_EXCEEDED`: API 配额已用完
- `RATE_LIMITED`: API 请求频率超限
- `NO_IMAGES_FOUND`: 未找到匹配的图片
- `NETWORK_ERROR`: 网络连接错误
- `UNKNOWN_ERROR`: 未知错误

## 使用建议

1. **定期监控**: 建议定期调用 `/stats` 端点监控 API 使用情况
2. **配额管理**: 使用 `/quota` 端点监控配额使用，避免超限
3. **性能优化**: 通过 `/metrics` 端点分析性能瓶颈
4. **故障排除**: 使用 `/validate-api` 端点诊断 API 配置问题
5. **开发测试**: 在开发环境中可使用 `/reset-stats` 重置统计数据

## 安全考虑

- 所有端点都应该在生产环境中添加适当的认证和授权
- 敏感信息（如 API 密钥）不会在响应中暴露
- 统计数据不包含用户的个人信息
- 建议对监控端点实施访问频率限制