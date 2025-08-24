# WordPecker 远程管理 API 文档

## 概述

WordPecker 远程管理 API 提供了完整的远程服务管理功能，允许开发者和运维人员通过 HTTP 接口远程控制和监控应用服务。本文档详细介绍了所有可用的 API 端点、参数、响应格式和使用示例。

## 目录

1. [API 基础信息](#api-基础信息)
2. [认证和安全](#认证和安全)
3. [服务管理 API](#服务管理-api)
4. [监控 API](#监控-api)
5. [高可用性管理 API](#高可用性管理-api)
6. [日志管理 API](#日志管理-api)
7. [系统信息 API](#系统信息-api)
8. [错误处理](#错误处理)
9. [使用示例](#使用示例)
10. [SDK 和工具](#sdk-和工具)

## API 基础信息

### 基础 URL

```
http://localhost:3000/api
```

### 请求格式

- **Content-Type**: `application/json`
- **Accept**: `application/json`
- **编码**: UTF-8

### 响应格式

所有 API 响应都遵循统一的格式：

```json
{
  "success": true|false,
  "data": {},
  "error": "错误信息",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### HTTP 状态码

- `200 OK`: 请求成功
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未授权访问
- `403 Forbidden`: 权限不足
- `404 Not Found`: 资源不存在
- `500 Internal Server Error`: 服务器内部错误
- `503 Service Unavailable`: 服务不可用

## 认证和安全

### API 密钥认证

```http
Authorization: Bearer YOUR_API_KEY
```

### IP 白名单

生产环境建议配置 IP 白名单限制访问：

```json
{
  "allowedIPs": [
    "127.0.0.1",
    "192.168.1.0/24",
    "10.0.0.0/8"
  ]
}
```

### 请求限流

- **默认限制**: 每分钟 100 次请求
- **管理操作**: 每分钟 10 次请求
- **监控查询**: 每分钟 60 次请求

## 服务管理 API

### 获取服务状态

获取所有 PM2 管理的服务状态信息。

**端点**: `GET /management/status`

**响应示例**:

```json
{
  "success": true,
  "data": [
    {
      "name": "wordpecker-backend",
      "status": "online",
      "uptime": 3600000,
      "memory": 134217728,
      "cpu": 5.2,
      "restarts": 0,
      "pid": 12345,
      "instances": 1
    },
    {
      "name": "wordpecker-frontend",
      "status": "online",
      "uptime": 3600000,
      "memory": 67108864,
      "cpu": 2.1,
      "restarts": 0,
      "pid": 12346,
      "instances": 1
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**cURL 示例**:

```bash
curl -X GET http://localhost:3000/api/management/status \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### 重启服务

重启指定的服务或所有服务。

**端点**: `POST /management/restart/:service`

**路径参数**:
- `service` (string): 服务名称，可选值：
  - `backend`: 重启后端服务
  - `frontend`: 重启前端服务
  - `all`: 重启所有服务

**请求体**: 无

**响应示例**:

```json
{
  "success": true,
  "message": "Service backend restarted successfully",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**cURL 示例**:

```bash
# 重启后端服务
curl -X POST http://localhost:3000/api/management/restart/backend \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"

# 重启所有服务
curl -X POST http://localhost:3000/api/management/restart/all \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json"
```

### 停止服务

停止指定的服务。

**端点**: `POST /management/stop/:service`

**路径参数**:
- `service` (string): 服务名称 (`backend`|`frontend`|`all`)

**响应示例**:

```json
{
  "success": true,
  "message": "Service backend stopped successfully",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 启动服务

启动指定的服务。

**端点**: `POST /management/start/:service`

**路径参数**:
- `service` (string): 服务名称 (`backend`|`frontend`|`all`)

**响应示例**:

```json
{
  "success": true,
  "message": "Service backend started successfully",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 扩缩容服务

调整服务实例数量。

**端点**: `POST /management/scale/:service`

**路径参数**:
- `service` (string): 服务名称

**请求体**:

```json
{
  "instances": 2
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "Service backend scaled to 2 instances",
  "data": {
    "previousInstances": 1,
    "currentInstances": 2
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 监控 API

### 获取监控仪表板数据

获取完整的监控仪表板数据，包括系统指标、服务状态和告警信息。

**端点**: `GET /monitoring/dashboard`

**响应示例**:

```json
{
  "success": true,
  "data": {
    "system": {
      "cpu": { "usage": 25.5, "cores": 4 },
      "memory": { "total": 8589934592, "used": 2147483648, "usage": 25 },
      "disk": { "total": 107374182400, "used": 21474836480, "usage": 20 },
      "network": { "bytesIn": 1048576, "bytesOut": 2097152 },
      "load": { "load1": 0.5, "load5": 0.3, "load15": 0.2 }
    },
    "health": {
      "backend": {
        "status": "healthy",
        "responseTime": 150,
        "availability": 99.9,
        "consecutiveFailures": 0
      },
      "frontend": {
        "status": "healthy",
        "responseTime": 50,
        "availability": 99.8,
        "consecutiveFailures": 0
      }
    },
    "services": [...],
    "alerts": {
      "critical": 0,
      "warning": 2,
      "info": 5,
      "total": 7,
      "period": "24小时"
    },
    "uptime": 86400,
    "lastUpdate": "2024-01-01T12:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 获取系统指标

获取详细的系统资源使用指标。

**端点**: `GET /monitoring/metrics`

**响应示例**:

```json
{
  "success": true,
  "data": {
    "cpu": {
      "usage": 25.5,
      "cores": 4,
      "processes": [
        { "name": "wordpecker-backend", "cpu": 5.2, "pid": 12345 },
        { "name": "wordpecker-frontend", "cpu": 2.1, "pid": 12346 }
      ]
    },
    "memory": {
      "total": 8589934592,
      "used": 2147483648,
      "available": 6442450944,
      "usage": 25,
      "processes": [
        { "name": "wordpecker-backend", "memory": 134217728, "pid": 12345 },
        { "name": "wordpecker-frontend", "memory": 67108864, "pid": 12346 }
      ]
    },
    "disk": {
      "total": 107374182400,
      "used": 21474836480,
      "available": 85899345920,
      "usage": 20,
      "filesystems": [
        { "mount": "/", "usage": 20, "available": 85899345920 }
      ]
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 获取性能趋势

获取指定时间范围内的性能趋势数据。

**端点**: `GET /monitoring/trends`

**查询参数**:
- `hours` (number, 可选): 时间范围（小时），默认 24

**响应示例**:

```json
{
  "success": true,
  "data": {
    "period": "24小时",
    "dataPoints": [
      {
        "timestamp": "2024-01-01T11:00:00.000Z",
        "cpu": 20.5,
        "memory": 22.3,
        "disk": 19.8
      },
      {
        "timestamp": "2024-01-01T12:00:00.000Z",
        "cpu": 25.5,
        "memory": 25.0,
        "disk": 20.0
      }
    ],
    "summary": {
      "avgCpu": 23.0,
      "avgMemory": 23.65,
      "avgDisk": 19.9
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 高可用性管理 API

### 获取高可用性状态

获取高可用性管理器的当前状态。

**端点**: `GET /high-availability/status`

**响应示例**:

```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "startTime": "2024-01-01T10:00:00.000Z",
    "summary": {
      "totalInstances": 2,
      "healthyServices": 2,
      "failedServices": 0,
      "lastHealthCheck": "2024-01-01T12:00:00.000Z"
    },
    "services": [
      {
        "name": "wordpecker-backend",
        "status": "healthy",
        "instances": 1,
        "lastCheck": "2024-01-01T12:00:00.000Z",
        "responseTime": 150
      },
      {
        "name": "wordpecker-frontend",
        "status": "healthy",
        "instances": 1,
        "lastCheck": "2024-01-01T12:00:00.000Z",
        "responseTime": 50
      }
    ],
    "configuration": {
      "checkInterval": 30000,
      "maxRetries": 3,
      "retryDelay": 5000
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 启动高可用性管理

启动高可用性管理器。

**端点**: `POST /high-availability/start`

**请求体**:

```json
{
  "checkInterval": 30000,
  "maxRetries": 3,
  "retryDelay": 5000
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "High availability manager started successfully",
  "data": {
    "startTime": "2024-01-01T12:00:00.000Z",
    "configuration": {
      "checkInterval": 30000,
      "maxRetries": 3,
      "retryDelay": 5000
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 停止高可用性管理

停止高可用性管理器。

**端点**: `POST /high-availability/stop`

**响应示例**:

```json
{
  "success": true,
  "message": "High availability manager stopped successfully",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 日志管理 API

### 获取服务日志

获取指定服务的日志内容。

**端点**: `GET /management/logs/:service`

**路径参数**:
- `service` (string): 服务名称 (`backend`|`frontend`)

**查询参数**:
- `lines` (number, 可选): 日志行数，默认 100
- `level` (string, 可选): 日志级别过滤 (`error`|`warn`|`info`|`debug`)
- `since` (string, 可选): 起始时间 (ISO 8601 格式)

**响应示例**:

```json
{
  "success": true,
  "data": {
    "service": "backend",
    "lines": 50,
    "content": "2024-01-01 12:00:00 [INFO] Server started on port 3000\n2024-01-01 12:00:01 [INFO] Database connected successfully\n...",
    "metadata": {
      "totalLines": 1000,
      "fileSize": 1048576,
      "lastModified": "2024-01-01T12:00:00.000Z"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**cURL 示例**:

```bash
# 获取后端服务最近100行日志
curl -X GET "http://localhost:3000/api/management/logs/backend?lines=100" \
  -H "Authorization: Bearer YOUR_API_KEY"

# 获取错误级别日志
curl -X GET "http://localhost:3000/api/management/logs/backend?level=error&lines=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### 下载日志文件

下载完整的日志文件。

**端点**: `GET /management/logs/:service/download`

**路径参数**:
- `service` (string): 服务名称

**查询参数**:
- `date` (string, 可选): 日期 (YYYY-MM-DD 格式)
- `compress` (boolean, 可选): 是否压缩，默认 true

**响应**: 文件下载流

**cURL 示例**:

```bash
# 下载后端服务今天的日志
curl -X GET "http://localhost:3000/api/management/logs/backend/download?date=2024-01-01" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -o backend-2024-01-01.log.gz
```

### 清理日志

清理指定服务的旧日志文件。

**端点**: `DELETE /management/logs/:service`

**路径参数**:
- `service` (string): 服务名称

**请求体**:

```json
{
  "olderThan": "7d",
  "keepRecent": 10
}
```

**响应示例**:

```json
{
  "success": true,
  "message": "Log cleanup completed",
  "data": {
    "deletedFiles": 5,
    "freedSpace": 52428800,
    "remainingFiles": 10
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 系统信息 API

### 获取系统信息

获取系统基本信息和配置。

**端点**: `GET /management/system-info`

**响应示例**:

```json
{
  "success": true,
  "data": {
    "system": {
      "hostname": "wordpecker-server",
      "platform": "linux",
      "arch": "x64",
      "uptime": 86400,
      "loadAverage": [0.5, 0.3, 0.2]
    },
    "node": {
      "version": "v18.17.0",
      "arch": "x64",
      "platform": "linux"
    },
    "application": {
      "name": "wordpecker",
      "version": "1.0.0",
      "environment": "production",
      "startTime": "2024-01-01T10:00:00.000Z"
    },
    "pm2": {
      "version": "5.3.0",
      "processes": 2,
      "status": "online"
    },
    "database": {
      "type": "mongodb",
      "status": "connected",
      "version": "7.0.0"
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 获取环境变量

获取应用相关的环境变量（敏感信息已脱敏）。

**端点**: `GET /management/environment`

**响应示例**:

```json
{
  "success": true,
  "data": {
    "NODE_ENV": "production",
    "PORT": "3000",
    "MONGODB_URL": "mongodb://***:***@host:port/database",
    "OPENAI_API_KEY": "sk-***",
    "LOG_LEVEL": "info"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 错误处理

### 错误响应格式

```json
{
  "success": false,
  "error": "详细错误信息",
  "code": "ERROR_CODE",
  "details": {
    "field": "具体错误字段",
    "message": "字段错误信息"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 常见错误代码

| 错误代码 | HTTP 状态 | 描述 |
|---------|----------|------|
| `INVALID_SERVICE` | 400 | 无效的服务名称 |
| `SERVICE_NOT_FOUND` | 404 | 服务不存在 |
| `OPERATION_FAILED` | 500 | 操作执行失败 |
| `UNAUTHORIZED` | 401 | 未授权访问 |
| `RATE_LIMITED` | 429 | 请求频率超限 |
| `SERVICE_UNAVAILABLE` | 503 | 服务不可用 |

### 错误处理最佳实践

```javascript
// JavaScript 示例
async function callAPI(endpoint, options = {}) {
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(`API Error: ${result.error} (${result.code})`);
    }
    
    return result.data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

## 使用示例

### 完整的服务重启流程

```bash
#!/bin/bash

API_BASE="http://localhost:3000/api"
API_KEY="your-api-key"

# 1. 检查当前服务状态
echo "检查服务状态..."
curl -s -X GET "$API_BASE/management/status" \
  -H "Authorization: Bearer $API_KEY" | jq .

# 2. 重启后端服务
echo "重启后端服务..."
curl -s -X POST "$API_BASE/management/restart/backend" \
  -H "Authorization: Bearer $API_KEY" | jq .

# 3. 等待服务启动
echo "等待服务启动..."
sleep 10

# 4. 验证服务状态
echo "验证服务状态..."
curl -s -X GET "$API_BASE/health" \
  -H "Authorization: Bearer $API_KEY" | jq .

# 5. 检查日志
echo "检查最近日志..."
curl -s -X GET "$API_BASE/management/logs/backend?lines=20" \
  -H "Authorization: Bearer $API_KEY" | jq -r .data.content
```

### Python 客户端示例

```python
import requests
import json
from typing import Dict, Any, Optional

class WordPeckerClient:
    def __init__(self, base_url: str, api_key: str):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        
        result = response.json()
        if not result.get('success'):
            raise Exception(f"API Error: {result.get('error')}")
        
        return result.get('data')
    
    def get_status(self) -> Dict[str, Any]:
        """获取服务状态"""
        return self._request('GET', '/management/status')
    
    def restart_service(self, service: str) -> Dict[str, Any]:
        """重启服务"""
        return self._request('POST', f'/management/restart/{service}')
    
    def get_logs(self, service: str, lines: int = 100) -> str:
        """获取服务日志"""
        params = {'lines': lines}
        result = self._request('GET', f'/management/logs/{service}', params=params)
        return result.get('content', '')
    
    def get_metrics(self) -> Dict[str, Any]:
        """获取系统指标"""
        return self._request('GET', '/monitoring/metrics')
    
    def get_dashboard(self) -> Dict[str, Any]:
        """获取监控仪表板数据"""
        return self._request('GET', '/monitoring/dashboard')

# 使用示例
client = WordPeckerClient('http://localhost:3000/api', 'your-api-key')

# 获取服务状态
status = client.get_status()
print(f"服务状态: {json.dumps(status, indent=2)}")

# 重启后端服务
result = client.restart_service('backend')
print(f"重启结果: {result}")

# 获取系统指标
metrics = client.get_metrics()
print(f"CPU 使用率: {metrics['cpu']['usage']}%")
print(f"内存使用率: {metrics['memory']['usage']}%")
```

### Node.js 客户端示例

```javascript
const axios = require('axios');

class WordPeckerClient {
  constructor(baseURL, apiKey) {
    this.client = axios.create({
      baseURL: baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    // 响应拦截器
    this.client.interceptors.response.use(
      response => {
        if (!response.data.success) {
          throw new Error(`API Error: ${response.data.error}`);
        }
        return response.data.data;
      },
      error => {
        throw error;
      }
    );
  }
  
  async getStatus() {
    return await this.client.get('/management/status');
  }
  
  async restartService(service) {
    return await this.client.post(`/management/restart/${service}`);
  }
  
  async getLogs(service, lines = 100) {
    const response = await this.client.get(`/management/logs/${service}`, {
      params: { lines }
    });
    return response.content;
  }
  
  async getMetrics() {
    return await this.client.get('/monitoring/metrics');
  }
  
  async getDashboard() {
    return await this.client.get('/monitoring/dashboard');
  }
}

// 使用示例
const client = new WordPeckerClient('http://localhost:3000/api', 'your-api-key');

async function main() {
  try {
    // 获取服务状态
    const status = await client.getStatus();
    console.log('服务状态:', status);
    
    // 获取系统指标
    const metrics = await client.getMetrics();
    console.log(`CPU 使用率: ${metrics.cpu.usage}%`);
    console.log(`内存使用率: ${metrics.memory.usage}%`);
    
    // 重启服务（如果需要）
    if (metrics.cpu.usage > 80) {
      console.log('CPU 使用率过高，重启后端服务...');
      await client.restartService('backend');
    }
  } catch (error) {
    console.error('操作失败:', error.message);
  }
}

main();
```

## SDK 和工具

### 官方 SDK

- **Node.js SDK**: `npm install @wordpecker/management-sdk`
- **Python SDK**: `pip install wordpecker-management`
- **Go SDK**: `go get github.com/wordpecker/go-sdk`

### CLI 工具

```bash
# 安装 CLI 工具
npm install -g @wordpecker/cli

# 配置 API 密钥
wordpecker config set api-key YOUR_API_KEY
wordpecker config set api-url http://localhost:3000/api

# 使用 CLI 命令
wordpecker status                    # 查看服务状态
wordpecker restart backend           # 重启后端服务
wordpecker logs backend --lines 50   # 查看日志
wordpecker metrics                   # 查看系统指标
```

### Postman 集合

导入 Postman 集合文件进行 API 测试：

```json
{
  "info": {
    "name": "WordPecker Management API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{api_key}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3000/api"
    },
    {
      "key": "api_key",
      "value": "your-api-key"
    }
  ]
}
```

## 最佳实践

### 1. 安全性

- 使用强 API 密钥并定期轮换
- 配置 IP 白名单限制访问
- 启用 HTTPS 加密传输
- 记录所有管理操作的审计日志

### 2. 监控和告警

- 设置关键指标的监控告警
- 定期检查 API 响应时间
- 监控 API 调用频率和错误率
- 建立服务状态变更通知机制

### 3. 错误处理

- 实现指数退避重试机制
- 设置合理的超时时间
- 记录详细的错误日志
- 提供友好的错误信息

### 4. 性能优化

- 使用连接池复用 HTTP 连接
- 实现客户端缓存机制
- 批量处理多个操作
- 避免频繁的状态查询

## 更新日志

### v1.0.0 (2024-01-01)

- 初始版本发布
- 基础服务管理功能
- 监控和日志管理
- 高可用性管理

### 未来计划

- 支持 WebSocket 实时通知
- 增加批量操作接口
- 提供 GraphQL 查询接口
- 支持自定义监控指标

---

**版本**: 1.0.0  
**最后更新**: 2024-01-01  
**维护者**: WordPecker 开发团队  
**联系方式**: api-support@wordpecker.com