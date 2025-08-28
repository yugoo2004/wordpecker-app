# WordPecker AI 模型替换升级设计

## 1. 概述

本设计文档规划 WordPecker 项目中 AI 模型的全面替换升级方案，将现有的 OpenAI/Agents 框架、GLM-4-voice、ElevenLabs 等服务全面替换为国产化方案：

- **文本模型**：使用豆包 1.6 模型替代 OpenAI GPT 系列
- **语音合成**：使用火山引擎语音模型替代 GLM-4-voice 和 ElevenLabs
- **文生图**：使用 SeedRam 3.0 替代 DALL-E

## 2. 架构概览

### 2.1 当前架构分析

```mermaid
graph TB
    subgraph "当前架构"
        A[OpenAI/Agents 框架] --> B[GPT-4o-mini/GLM-4.5]
        C[语音服务] --> D[GLM-4-voice]
        C --> E[ElevenLabs]
        F[图像生成] --> G[DALL-E 3]
    end
    
    subgraph "新架构"
        H[自定义 Agent 框架] --> I[豆包 1.6]
        J[火山引擎语音] --> K[火山 TTS]
        L[图像生成服务] --> M[SeedRam 3.0]
    end
```

### 2.2 升级后架构

```mermaid
graph LR
    subgraph "AI 代理层"
        VA[词汇代理]
        DA[定义代理]
        QA[测验代理]
        IA[图像代理]
    end
    
    subgraph "服务层"
        DM[豆包文本模型]
        VE[火山语音引擎]
        SR[SeedRam图像]
    end
    
    subgraph "配置层"
        AC[代理配置]
        SC[服务配置]
        FC[故障转移]
    end
    
    VA --> DM
    DA --> DM
    QA --> DM
    IA --> SR
    
    DM --> AC
    VE --> SC
    SR --> SC
    
    AC --> FC
    SC --> FC
```

## 3. 技术实现方案

### 3.1 豆包文本模型集成

#### 3.1.1 模型配置

豆包 1.6 模型将作为主要文本生成服务，采用火山引擎 API 接口规范：

- **API 端点**：`https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- **模型标识**：`ep-20250101-xxxxx`（豆包 1.6 端点）
- **认证方式**：Bearer Token

#### 3.1.2 API 配置结构

```typescript
interface DoubaoConfig {
  apiKey: string;
  baseUrl: string;
  endpoint: string;
  model: string;
  region: 'cn-beijing' | 'us-east-1';
}

const DOUBAO_CONFIG: DoubaoConfig = {
  apiKey: process.env.DOUBAO_API_KEY,
  baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  endpoint: process.env.DOUBAO_ENDPOINT,
  model: 'doubao-pro-32k',
  region: 'cn-beijing'
};
```

#### 3.1.3 服务适配器

```mermaid
classDiagram
    class DoubaoService {
        -apiKey: string
        -baseUrl: string
        -endpoint: string
        -httpClient: AxiosInstance
        +createChatCompletion(messages, options): Promise~ChatCompletion~
        +createStreamCompletion(messages, options): AsyncGenerator~string~
        +validateResponse(response): boolean
        +handleError(error): AIServiceError
    }
    
    class AIServiceManager {
        -providers: Map~string, AIService~
        -currentProvider: string
        -failoverConfig: FailoverConfig
        +switchProvider(provider): void
        +getAvailableProviders(): string[]
        +executeWithFallback(request): Promise~any~
    }
    
    DoubaoService --|> AIServiceManager
```

### 3.2 自定义 Agent 框架替换

#### 3.2.1 框架迁移策略

当前项目已有 `CustomAgent` 类基础，需要增强以完全替代 `@openai/agents`：

```typescript
interface CustomAgentConfig<TOutput> {
  name: string;
  instructions: string;
  outputSchema?: ZodSchema<TOutput>;
  modelProvider: 'doubao' | 'glm' | 'qwen';
  temperature?: number;
  maxTokens?: number;
  tools?: AgentTool[];
}

class EnhancedCustomAgent<TOutput = any> {
  private config: CustomAgentConfig<TOutput>;
  private aiService: DoubaoService;
  
  constructor(config: CustomAgentConfig<TOutput>) {
    this.config = config;
    this.aiService = new DoubaoService();
  }
  
  async run(input: string, context?: any): Promise<AgentResult<TOutput>> {
    // 实现完整的代理执行逻辑
  }
}
```

#### 3.2.2 代理迁移计划

| 原代理 | 迁移策略 | 优先级 |
|--------|----------|---------|
| vocabulary-agent | 直接迁移至豆包1.6 | 高 |
| definition-agent | 直接迁移至豆包1.6 | 高 |
| quiz-agent | 直接迁移至豆包1.6 | 高 |
| examples-agent | 直接迁移至豆包1.6 | 中 |
| image-generation-agent | 迁移至SeedRam3.0 | 中 |
| language-validation-agent | 直接迁移至豆包1.6 | 低 |

### 3.3 火山引擎语音服务集成

#### 3.3.1 语音服务架构

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant VS as 语音服务
    participant VE as 火山引擎TTS
    participant Cache as 音频缓存
    
    Client->>VS: 文本转语音请求
    VS->>VS: 生成缓存键
    VS->>Cache: 检查缓存
    alt 缓存命中
        Cache-->>VS: 返回音频数据
        VS-->>Client: 音频响应
    else 缓存未命中
        VS->>VE: 调用TTS API
        VE-->>VS: 音频流
        VS->>Cache: 保存音频
        VS-->>Client: 音频响应
    end
```

#### 3.3.2 火山引擎 TTS 配置

```typescript
interface VolcengineTTSConfig {
  appId: string;
  accessToken: string;
  cluster: 'volcano_tts';
  voiceType: string;
  encoding: 'mp3' | 'wav' | 'pcm';
  sampleRate: 16000 | 24000;
}

const VOLCENGINE_TTS_CONFIG: VolcengineTTSConfig = {
  appId: process.env.VOLCENGINE_APP_ID,
  accessToken: process.env.VOLCENGINE_ACCESS_TOKEN,
  cluster: 'volcano_tts',
  voiceType: 'BV001_streaming',
  encoding: 'mp3',
  sampleRate: 24000
};
```

#### 3.3.3 语音服务实现

```mermaid
classDiagram
    class VolcengineTTSService {
        -config: VolcengineTTSConfig
        -wsConnection: WebSocket
        -audioCache: AudioCache
        +generateSpeech(text, options): Promise~Buffer~
        +streamSpeech(text, options): AsyncGenerator~Buffer~
        +getSupportedVoices(): Promise~VoiceConfig[]~
        +validateAudio(buffer): boolean
    }
    
    class VoiceServiceManager {
        -providers: Map~string, VoiceService~
        -currentProvider: 'volcengine'
        -fallbackProviders: string[]
        +generateSpeech(text, options): Promise~Buffer~
        +switchProvider(provider): void
        +getServiceStatus(): ServiceStatus
    }
    
    VolcengineTTSService --|> VoiceServiceManager
```

### 3.4 SeedRam 3.0 图像生成集成

#### 3.4.1 图像生成服务架构

```mermaid
graph TB
    subgraph "图像生成流程"
        A[提示词输入] --> B[提示词优化]
        B --> C[SeedRam 3.0 API]
        C --> D[图像生成]
        D --> E[质量检测]
        E --> F[图像存储]
        F --> G[返回URL]
    end
    
    subgraph "服务组件"
        H[PromptEnhancer]
        I[SeedRamService]
        J[ImageValidator]
        K[ImageStorage]
    end
    
    B --> H
    C --> I
    E --> J
    F --> K
```

#### 3.4.2 SeedRam API 配置

```typescript
interface SeedRamConfig {
  apiKey: string;
  baseUrl: string;
  model: 'seedram-3.0';
  maxRetries: number;
  timeoutMs: number;
}

const SEEDRAM_CONFIG: SeedRamConfig = {
  apiKey: process.env.SEEDRAM_API_KEY,
  baseUrl: 'https://api.seedram.com/v1',
  model: 'seedram-3.0',
  maxRetries: 3,
  timeoutMs: 30000
};
```

#### 3.4.3 图像生成实现

```mermaid
classDiagram
    class SeedRamService {
        -config: SeedRamConfig
        -httpClient: AxiosInstance
        +generateImage(prompt, options): Promise~ImageResult~
        +enhancePrompt(prompt): Promise~string~
        +validateImage(imageUrl): Promise~boolean~
        +getGenerationStatus(taskId): Promise~TaskStatus~
    }
    
    class ImageGenerationAgent {
        -seedRamService: SeedRamService
        -promptEnhancer: PromptEnhancer
        -imageStorage: ImageStorage
        +generateVocabularyImage(context): Promise~ImageResult~
        +generateContextualImage(words, theme): Promise~ImageResult~
    }
    
    SeedRamService --|> ImageGenerationAgent
```

## 4. 数据流架构

### 4.1 整体数据流

```mermaid
flowchart TD
    subgraph "用户层"
        U[用户请求]
    end
    
    subgraph "API 层"
        API[REST API]
        WS[WebSocket]
    end
    
    subgraph "业务层"
        VA[词汇代理]
        QA[测验代理]
        IA[图像代理]
        SA[语音代理]
    end
    
    subgraph "AI 服务层"
        DM[豆包模型]
        VT[火山TTS]
        SR[SeedRam]
    end
    
    subgraph "存储层"
        DB[(MongoDB)]
        Cache[(Redis缓存)]
        Files[文件存储]
    end
    
    U --> API
    U --> WS
    API --> VA
    API --> QA
    API --> IA
    WS --> SA
    
    VA --> DM
    QA --> DM
    IA --> SR
    SA --> VT
    
    DM --> Cache
    VT --> Files
    SR --> Files
    
    VA --> DB
    QA --> DB
```

### 4.2 错误处理和故障转移

```mermaid
stateDiagram-v2
    [*] --> Healthy
    Healthy --> Degraded: 服务异常
    Healthy --> Failed: 严重错误
    Degraded --> Healthy: 服务恢复
    Degraded --> Failed: 持续异常
    Failed --> Degraded: 部分恢复
    Failed --> [*]: 服务下线
    
    state Healthy {
        [*] --> Primary
        Primary --> Secondary: 主服务故障
        Secondary --> Primary: 主服务恢复
    }
    
    state Degraded {
        [*] --> Limited
        Limited --> Backup: 切换备用
        Backup --> Limited: 备用正常
    }
```

## 5. 配置管理体系

### 5.1 环境配置结构

```typescript
interface AIServiceEnvironment {
  // 豆包文本模型配置
  doubao: {
    apiKey: string;
    endpoint: string;
    model: string;
    region: 'cn-beijing' | 'us-east-1';
    maxTokens: number;
    temperature: number;
  };
  
  // 火山引擎语音配置
  volcengine: {
    appId: string;
    accessToken: string;
    cluster: string;
    voiceType: string;
    sampleRate: number;
  };
  
  // SeedRam 图像配置
  seedram: {
    apiKey: string;
    model: 'seedram-3.0';
    imageSize: '512x512' | '1024x1024';
    quality: 'standard' | 'hd';
  };
  
  // 服务故障转移配置
  failover: {
    retryAttempts: number;
    timeoutMs: number;
    cooldownMs: number;
    fallbackProviders: string[];
  };
}
```

### 5.2 服务注册表

| 服务类型 | 主服务 | 备用服务 | 故障转移策略 |
|----------|--------|----------|-------------|
| 文本生成 | 豆包1.6 | GLM-4.5 | 自动切换 |
| 语音合成 | 火山引擎 | - | 错误重试 |
| 图像生成 | SeedRam3.0 | - | 错误重试 |

## 6. 接口适配方案

### 6.1 豆包模型接口适配

```typescript
class DoubaoAPIAdapter {
  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const volcengineRequest = {
      model: this.config.endpoint,
      messages: request.messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      stream: request.stream || false
    };
    
    const response = await this.httpClient.post('/chat/completions', volcengineRequest);
    
    return this.transformResponse(response.data);
  }
  
  private transformResponse(volcResponse: any): ChatCompletionResponse {
    return {
      id: volcResponse.id,
      object: 'chat.completion',
      created: volcResponse.created,
      model: volcResponse.model,
      choices: volcResponse.choices.map(choice => ({
        index: choice.index,
        message: choice.message,
        finish_reason: choice.finish_reason
      })),
      usage: volcResponse.usage
    };
  }
}
```

### 6.2 火山引擎语音接口适配

```typescript
class VolcengineTTSAdapter {
  async textToSpeech(request: TTSRequest): Promise<TTSResponse> {
    const volcRequest = {
      app: {
        appid: this.config.appId,
        token: this.config.accessToken,
        cluster: this.config.cluster
      },
      user: {
        uid: request.userId || 'default'
      },
      audio: {
        voice_type: request.voice || 'BV001_streaming',
        encoding: request.format || 'mp3',
        speed_ratio: request.speed || 1.0,
        volume_ratio: request.volume || 1.0,
        pitch_ratio: request.pitch || 1.0
      },
      request: {
        reqid: this.generateRequestId(),
        text: request.text,
        text_type: 'plain',
        operation: 'query'
      }
    };
    
    const response = await this.sendTTSRequest(volcRequest);
    return this.processAudioResponse(response);
  }
}
```

### 6.3 SeedRam图像接口适配

```typescript
class SeedRamAPIAdapter {
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    const seedramRequest = {
      prompt: request.prompt,
      model: 'seedram-3.0',
      size: request.size || '1024x1024',
      quality: request.quality || 'standard',
      n: request.n || 1,
      response_format: 'url'
    };
    
    const response = await this.httpClient.post('/images/generations', seedramRequest);
    
    return {
      created: Date.now(),
      data: response.data.data.map(item => ({
        url: item.url,
        revised_prompt: item.revised_prompt
      }))
    };
  }
}
```

## 7. 性能优化策略

### 7.1 缓存策略

```mermaid
graph LR
    subgraph "多级缓存"
        L1[内存缓存<br/>热点数据]
        L2[Redis缓存<br/>会话数据]
        L3[文件缓存<br/>音频/图像]
        L4[CDN缓存<br/>静态资源]
    end
    
    Request --> L1
    L1 --> L2
    L2 --> L3
    L3 --> L4
    L4 --> Database
```

### 7.2 性能指标

| 指标类型 | 目标值 | 监控方式 |
|----------|--------|----------|
| 文本生成响应时间 | < 3秒 | APM监控 |
| 语音合成响应时间 | < 5秒 | 性能日志 |
| 图像生成响应时间 | < 30秒 | 异步任务 |
| 系统可用性 | > 99.5% | 健康检查 |
| 错误率 | < 1% | 错误统计 |

### 7.3 资源管理

```mermaid
classDiagram
    class ResourceManager {
        -connectionPools: Map~string, Pool~
        -rateLimiters: Map~string, RateLimiter~
        -circuitBreakers: Map~string, CircuitBreaker~
        +acquireConnection(service): Connection
        +checkRateLimit(service, user): boolean
        +getCircuitState(service): CircuitState
    }
    
    class ConnectionPool {
        -maxSize: number
        -currentSize: number
        -waitingQueue: Queue
        +acquire(): Promise~Connection~
        +release(connection): void
        +destroy(): void
    }
    
    ResourceManager --> ConnectionPool
```

## 8. 测试策略

### 8.1 测试分层

```mermaid
pyramid
    title 测试金字塔
    bottom "单元测试<br/>组件逻辑测试"
    middle "集成测试<br/>服务接口测试"
    top "端到端测试<br/>用户场景测试"
```

### 8.2 测试覆盖范围

| 测试类型 | 覆盖内容 | 工具 |
|----------|----------|------|
| 单元测试 | 各服务适配器逻辑 | Jest |
| 集成测试 | API接口调用 | Supertest |
| 性能测试 | 响应时间和吞吐量 | Artillery |
| 故障测试 | 错误处理和恢复 | Chaos Monkey |

### 8.3 测试环境

```typescript
interface TestEnvironment {
  doubao: {
    mockEndpoint: string;
    testApiKey: string;
  };
  volcengine: {
    mockAppId: string;
    testToken: string;
  };
  seedram: {
    mockApiKey: string;
    testModel: string;
  };
}
```

## 9. 部署与运维

### 9.1 部署架构

```mermaid
graph TB
    subgraph "生产环境"
        LB[负载均衡器]
        subgraph "应用集群"
            A1[应用实例1]
            A2[应用实例2]
            A3[应用实例3]
        end
        subgraph "数据层"
            DB[(MongoDB集群)]
            CACHE[(Redis集群)]
            FILES[文件存储]
        end
    end
    
    subgraph "监控系统"
        PROM[Prometheus]
        GRAF[Grafana]
        ALERT[AlertManager]
    end
    
    LB --> A1
    LB --> A2
    LB --> A3
    
    A1 --> DB
    A2 --> DB
    A3 --> DB
    
    A1 --> CACHE
    A2 --> CACHE
    A3 --> CACHE
    
    A1 --> PROM
    A2 --> PROM
    A3 --> PROM
    
    PROM --> GRAF
    PROM --> ALERT
```

### 9.2 容器化配置

```dockerfile
# Dockerfile 示例
FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制源码
COPY . .

# 编译TypeScript
RUN npm run build

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

EXPOSE 3000

CMD ["npm", "start"]
```

### 9.3 监控指标

```mermaid
dashboard
    title "系统监控面板"
    
    metric "API响应时间" {
        target: "< 3s"
        current: "2.1s"
        status: "healthy"
    }
    
    metric "错误率" {
        target: "< 1%"
        current: "0.3%"
        status: "healthy"
    }
    
    metric "服务可用性" {
        target: "> 99.5%"
        current: "99.8%"
        status: "healthy"
    }
    
    metric "资源使用率" {
        target: "< 80%"
        current: "65%"
        status: "healthy"
    }
```

## 10. 风险评估与应对

### 10.1 技术风险

| 风险类型 | 影响程度 | 概率 | 应对策略 |
|----------|----------|------|----------|
| API变更 | 高 | 中 | 版本锁定+适配层 |
| 服务限流 | 中 | 高 | 配额管理+降级 |
| 性能下降 | 中 | 中 | 性能监控+优化 |
| 数据丢失 | 高 | 低 | 备份策略+恢复 |

### 10.2 业务风险

```mermaid
mindmap
  root((业务风险))
    服务中断
      用户体验下降
      业务流失
      声誉影响
    成本增加
      API调用费用
      服务器资源
      运维成本
    合规问题
      数据安全
      隐私保护
      法规遵循
```

### 10.3 应急预案

```mermaid
flowchart TD
    A[监控告警] --> B{严重程度}
    B -->|低| C[自动恢复]
    B -->|中| D[人工介入]
    B -->|高| E[紧急处理]
    
    C --> F[记录日志]
    D --> G[故障排查]
    E --> H[服务降级]
    
    G --> I[问题修复]
    H --> J[通知用户]
    
    I --> K[服务恢复]
    J --> K
    
    K --> L[事后复盘]
```

## 11. 迁移路线图

### 11.1 分阶段实施

```mermaid
gantt
    title 模型替换实施计划
    dateFormat  YYYY-MM-DD
    section 准备阶段
    环境搭建           :prep1, 2024-01-01, 7d
    接口调研           :prep2, after prep1, 5d
    架构设计           :prep3, after prep2, 10d
    
    section 开发阶段
    豆包模型集成       :dev1, after prep3, 14d
    火山语音集成       :dev2, after prep3, 10d
    SeedRam集成        :dev3, after dev2, 7d
    测试验证           :dev4, after dev1, 10d
    
    section 部署阶段
    灰度发布           :deploy1, after dev4, 7d
    全量发布           :deploy2, after deploy1, 3d
    监控优化           :deploy3, after deploy2, 7d
```

### 11.2 里程碑检查点

| 阶段 | 里程碑 | 验收标准 | 负责人 |
|------|--------|----------|--------|
| 准备 | 技术方案确认 | 架构评审通过 | 架构师 |
| 开发 | 核心功能完成 | 单元测试覆盖率>80% | 开发团队 |
| 测试 | 集成测试完成 | 所有用例通过 | 测试团队 |
| 部署 | 生产环境上线 | 服务稳定运行7天 | 运维团队 |
