# Sealos 部署设计文档

## Overview

本设计文档描述了如何将 WordPecker 语言学习应用部署到 Sealos 云平台的 devbox 环境。基于实际的部署环境分析，项目当前运行在 Sealos devbox 中，这是一个基于 Ubuntu 22.04 的开发环境，内网 IP 为 10.108.38.66，公网 IP 为 101.126.5.123。我们将配置应用在此环境中运行并提供公网访问。

## Architecture

### 整体架构

```mermaid
graph TB
    subgraph "Internet"
        USER[用户访问]
        APIS[外部 API 服务]
    end
    
    subgraph "Sealos Devbox Environment"
        subgraph "Public IP: 101.126.5.123"
            PROXY[Nginx/反向代理<br/>公网端口映射]
        end
        
        subgraph "Internal Network: 10.108.38.66"
            FE[Frontend Service<br/>React + Vite<br/>localhost:5173]
            BE[Backend Service<br/>Express.js<br/>localhost:3000]
        end
        
        subgraph "Sealos Managed Services"
            MONGO[MongoDB 6.0<br/>wordpecker-db-mongodb.ns-t1zw83xe.svc:27017<br/>User: root]
        end
        
        subgraph "External APIs"
            OPENAI[OpenAI API<br/>GPT-4 + DALL-E + Voice]
            ELEVEN[ElevenLabs API<br/>Audio Synthesis]
            PEXELS[Pexels API<br/>Stock Photos]
        end
    end
    
    USER --> PROXY
    PROXY --> FE
    FE --> BE
    BE --> MONGO
    BE --> OPENAI
    BE --> ELEVEN
    BE --> PEXELS
    APIS --> BE
```

### 服务部署策略

基于当前 Sealos devbox 环境的实际情况：

1. **前端服务 (Frontend)**
   - 在 devbox 环境中直接运行 Vite 开发服务器
   - 监听 localhost:5173
   - 通过 Sealos 端口转发或反向代理提供公网访问
   - 配置环境变量指向内网后端服务

2. **后端服务 (Backend)**
   - 在 devbox 环境中运行 Express.js 服务
   - 监听 localhost:3000
   - 内部服务，通过前端代理或直接端口映射访问
   - 配置环境变量和 API 密钥

3. **数据库服务 (MongoDB)**
   - 使用 Sealos 托管的 MongoDB 6.0 服务
   - 内网地址: wordpecker-db-mongodb.ns-t1zw83xe.svc:27017
   - 认证信息: root/td6szbxh
   - 自动持久化存储和备份

## Components and Interfaces

### 1. 前端组件 (Frontend Component)

**技术栈:**
- React 18 + TypeScript
- Vite 构建工具
- Chakra UI 组件库
- 直接在 devbox 环境运行

**Devbox 配置:**
```bash
# 环境变量配置
export VITE_API_URL=http://localhost:3000
# 或者配置为公网访问
export VITE_API_URL=http://101.126.5.123:3000

# 启动命令
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

**网络配置:**
- 内网监听: 0.0.0.0:5173 (允许外部访问)
- 公网访问: 通过 Sealos 端口转发 101.126.5.123:5173
- 支持通过 Sealos 提供的域名访问

### 2. 后端组件 (Backend Component)

**技术栈:**
- Express.js + TypeScript
- OpenAI Agents SDK
- MongoDB 连接
- 直接在 devbox 环境运行

**Devbox 配置:**
```bash
# 环境变量配置 (.env 文件)
NODE_ENV=production
PORT=3000
MONGODB_URL=mongodb://root:td6szbxh@wordpecker-db-mongodb.ns-t1zw83xe.svc:27017/wordpecker
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
PEXELS_API_KEY=your_pexels_api_key_here

# 启动命令
cd backend
npm install
npm run build
npm start
# 或开发模式
npm run dev
```

### 3. 数据库组件 (MongoDB Component)

**Sealos 托管 MongoDB 配置:**
- 数据库类型: MongoDB 6.0
- 用户名: root
- 密码: td6szbxh
- 内网地址: wordpecker-db-mongodb.ns-t1zw83xe.svc
- 端口: 27017
- 连接字符串: `mongodb://root:td6szbxh@wordpecker-db-mongodb.ns-t1zw83xe.svc:27017/wordpecker`

**配置特点:**
- 自动持久化存储
- 内置备份策略
- 高可用性保障
- 从 devbox 环境可直接访问

### 4. 外部 API 集成

**API 密钥管理:**
- 使用 Sealos Secret 管理敏感信息
- 环境变量注入到后端服务
- 支持密钥轮换和更新

**必需的 API 服务:**
1. **OpenAI API** (必需)
   - GPT-4 用于语言处理
   - DALL-E 用于图像生成
   - Realtime API 用于语音对话

2. **ElevenLabs API** (可选)
   - 语音合成和发音功能
   - 音频缓存优化

3. **Pexels API** (可选)
   - 图像描述功能的库存照片
   - Vision Garden 功能支持

## Data Models

### 环境变量配置模型

```typescript
interface SealosEnvironmentConfig {
  // 必需配置
  required: {
    OPENAI_API_KEY: string;
    MONGODB_URL: string;
    NODE_ENV: 'production' | 'development';
    PORT: number;
  };
  
  // 可选配置
  optional: {
    ELEVENLABS_API_KEY?: string;
    PEXELS_API_KEY?: string;
    OPENAI_BASE_URL?: string;
  };
  
  // 前端配置
  frontend: {
    VITE_API_URL: string;
  };
}
```

### 资源配置模型

```typescript
interface ResourceConfiguration {
  frontend: {
    cpu: { request: '100m', limit: '500m' };
    memory: { request: '128Mi', limit: '512Mi' };
    replicas: 1;
  };
  
  backend: {
    cpu: { request: '200m', limit: '1000m' };
    memory: { request: '256Mi', limit: '1Gi' };
    replicas: 1;
  };
  
  database: {
    storage: '10Gi';
    backupRetention: '7d';
    version: '7.0';
  };
}
```

## Error Handling

### 1. 服务启动失败处理

**健康检查配置:**
```yaml
# 后端健康检查
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

**错误恢复策略:**
- 自动重启失败的容器
- 服务依赖检查和等待
- 数据库连接重试机制

### 2. API 密钥错误处理

**验证流程:**
1. 启动时验证必需的 API 密钥
2. 运行时 API 调用错误处理
3. 密钥失效时的降级策略

**错误响应:**
```typescript
interface APIErrorResponse {
  error: string;
  code: 'MISSING_API_KEY' | 'INVALID_API_KEY' | 'API_QUOTA_EXCEEDED';
  service: 'openai' | 'elevenlabs' | 'pexels';
  fallback?: string;
}
```

### 3. 数据库连接错误

**连接重试策略:**
- 最大重试次数: 5
- 重试间隔: 指数退避 (1s, 2s, 4s, 8s, 16s)
- 连接池配置优化

## Testing Strategy

### 1. 部署前测试

**本地验证:**
```bash
# 构建和测试 Docker 镜像
docker build -t wordpecker-frontend ./frontend
docker build -t wordpecker-backend ./backend

# 本地 Docker Compose 测试
docker-compose up --build
```

**环境变量验证:**
```bash
# 验证必需的环境变量
./scripts/validate-env.sh
```

### 2. Sealos 部署测试

**分阶段部署:**
1. **数据库部署测试**
   - 创建 MongoDB 实例
   - 验证连接和认证
   - 测试数据持久化

2. **后端服务测试**
   - 部署后端应用
   - 验证数据库连接
   - 测试 API 端点

3. **前端服务测试**
   - 部署前端应用
   - 验证后端 API 调用
   - 测试公网访问

### 3. 集成测试

**功能测试清单:**
- [ ] 用户注册和登录流程
- [ ] 词汇列表创建和管理
- [ ] OpenAI API 集成测试
- [ ] 语音功能测试 (如果配置了 ElevenLabs)
- [ ] 图像功能测试 (如果配置了 Pexels)
- [ ] 数据持久化测试

**性能测试:**
- 并发用户负载测试
- API 响应时间测试
- 数据库查询性能测试

### 4. 监控和日志

**监控指标:**
- 服务可用性和响应时间
- 资源使用情况 (CPU, 内存, 存储)
- API 调用成功率和错误率
- 数据库连接状态

**日志管理:**
- 结构化日志输出
- 错误日志聚合和告警
- 性能日志分析

## 部署流程

### 1. 环境准备
1. 确认 devbox 环境已就绪 (当前: Ubuntu 22.04, IP: 10.108.38.66/101.126.5.123)
2. 准备 API 密钥 (OpenAI 必需, ElevenLabs 和 Pexels 可选)
3. 安装必要的依赖 (Node.js, npm, Docker 可选)

### 2. 数据库部署
1. 确认 Sealos 托管 MongoDB 实例已创建 ✅
2. 验证数据库连接 (wordpecker-db-mongodb.ns-t1zw83xe.svc:27017)
3. 测试认证和数据库访问权限

### 3. 后端服务部署
1. 配置环境变量 (.env 文件)
2. 安装依赖并构建项目
3. 启动后端服务 (localhost:3000)
4. 验证 API 端点可访问

### 4. 前端服务部署
1. 配置前端环境变量
2. 安装依赖并启动开发服务器
3. 配置 Vite 监听所有网络接口 (0.0.0.0:5173)
4. 验证前端可通过公网访问

### 5. 公网访问配置
1. 配置 Sealos 端口转发或反向代理
2. 测试公网访问 (101.126.5.123:5173)
3. 配置域名绑定 (可选)
4. 启用 HTTPS (可选)

### 6. 验证和优化
1. 端到端功能测试
2. 性能监控和调优
3. 日志配置
4. 备份策略设置