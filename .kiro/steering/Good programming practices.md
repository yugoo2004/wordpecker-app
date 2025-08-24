---
inclusion: always
---

# WordPecker 项目编程规范

## 架构模式
- **分层架构**: 严格遵循路由层 → 服务层 → 数据层的分离
- **Agent模式**: 新增AI功能使用 `backend/src/agents/` 目录下的标准Agent结构
- **模块化**: 每个功能模块包含 `routes.ts`, `model.ts`, `schemas.ts`, `agent-service.ts`

## 目录结构规范
```
backend/src/
├── api/           # REST API路由和控制器
├── agents/        # AI Agent实现（prompt.md + schemas.ts + index.ts）
├── config/        # 配置文件（MongoDB, OpenAI, 环境变量）
├── middleware/    # 中间件（错误处理、限流）
├── services/      # 外部服务集成（ElevenLabs等）
└── types/         # TypeScript类型定义

frontend/src/
├── components/    # 可复用UI组件
├── pages/         # 页面组件
├── services/      # API调用服务
└── types/         # 前端类型定义
```

## TypeScript 要求
- **严格类型**: 禁用 `any`，使用具体类型或泛型
- **Schema验证**: 使用Zod进行运行时类型验证
- **类型复用**: 优先使用 `backend/src/types/index.ts` 中的共享类型

## API设计标准
- **RESTful**: 遵循标准HTTP方法和状态码
- **错误处理**: 使用 `errorHandler.ts` 中间件统一处理错误
- **输入验证**: 所有API端点必须使用Zod schema验证
- **响应格式**: 统一使用 `{ success: boolean, data?: any, error?: string }` 格式

## Agent开发规范
- **标准结构**: 每个Agent包含 `prompt.md`（提示词）、`schemas.ts`（输入输出schema）、`index.ts`（实现）
- **工具集成**: Agent工具放在 `tools/` 子目录
- **配置管理**: 使用 `agents/config.ts` 统一管理Agent配置

## 数据库操作
- **MongoDB**: 使用Mongoose进行数据建模
- **模型定义**: 在各模块的 `model.ts` 中定义Schema
- **查询优化**: 使用适当的索引和查询优化

## 代码质量
- **生产就绪**: 避免临时代码，直接编写生产级实现
- **真实数据**: 不使用模拟数据，除非明确标注为示例
- **测试覆盖**: 使用Jest为核心功能编写测试

## 特定于WordPecker的约定
- **多语言支持**: 使用 `config/languages.ts` 中定义的语言配置
- **音频处理**: 音频文件缓存在 `audio-cache/` 目录
- **模板系统**: 词汇模板存储在 `backend/data/templates/`
- **会话管理**: 使用SessionManager处理用户会话状态