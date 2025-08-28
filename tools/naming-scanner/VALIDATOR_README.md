# SeeDream 命名规范自动化验证器

## 概述

自动化验证器是 SeeDream 命名标准化工具的重要组成部分，用于检查项目中的命名规范一致性和测试报告格式。

## 功能特性

### 1. 环境变量验证
- ✅ 检查环境变量命名规范（SEEDREAM_* 格式）
- ✅ 识别常见的命名错误（SEEDDREAM_*, SEEDRAM_* 等）
- ✅ 提供修正建议
- ✅ 支持一致性检查

### 2. 测试报告验证
- ✅ 验证测试报告格式
- ✅ 检查报告内容中的命名规范
- ✅ 支持多种报告格式（Jest, Volcengine API 等）
- ✅ 识别显示名称错误

### 3. CI/CD 集成
- ✅ Git hooks 支持（pre-commit, pre-push）
- ✅ GitHub Actions 工作流
- ✅ 多种报告格式（JSON, JUnit, Markdown）
- ✅ 自动化验证流程

## 快速开始

### 1. 构建验证器

```bash
cd tools/naming-scanner
npm run build
```

### 2. 运行验证

```bash
# 完整验证
node dist/cli-validator.js validate

# 仅验证环境变量
node dist/cli-validator.js env

# 仅验证测试报告
node dist/cli-validator.js reports

# 生成配置文件
node dist/cli-validator.js config
```

### 3. 验证当前项目

```bash
# 验证整个 SeeDream 项目
node validate-project.js
```

## CLI 命令

### validate
运行完整的命名规范验证

```bash
node dist/cli-validator.js validate [options]

选项:
  -p, --project <path>    项目路径 (默认: 当前目录)
  --fail-on-errors        遇到错误时失败退出
```

### env
仅验证环境变量命名

```bash
node dist/cli-validator.js env [options]

选项:
  -p, --project <path>    项目路径 (默认: 当前目录)
```

### reports
仅验证测试报告格式

```bash
node dist/cli-validator.js reports [options]

选项:
  -p, --project <path>    项目路径 (默认: 当前目录)
```

### config
生成默认配置文件

```bash
node dist/cli-validator.js config [options]

选项:
  -o, --output <path>     输出文件路径 (默认: ./naming-validation.config.json)
```

## 配置文件

验证器支持通过配置文件自定义验证规则：

```json
{
  "environment": {
    "requiredPrefix": "SEEDREAM_",
    "allowedPatterns": [
      "^SEEDREAM_[A-Z0-9_]+$"
    ],
    "excludeFiles": [
      "**/node_modules/**",
      "**/dist/**"
    ],
    "checkConsistency": true
  },
  "report": {
    "requiredFields": ["serviceName"],
    "allowedFormats": ["json"],
    "schemaValidation": false,
    "contentValidation": true
  },
  "ci": {
    "enablePreCommitHooks": false,
    "enablePRChecks": false,
    "failOnErrors": true,
    "generateReports": false,
    "outputFormat": "json"
  }
}
```

## CI/CD 集成

### 设置 Git Hooks

```bash
# 运行设置脚本
./scripts/setup-ci-hooks.sh
```

这将创建：
- `.git/hooks/pre-commit` - 预提交检查
- `.git/hooks/pre-push` - 预推送检查
- `.github/workflows/naming-validation.yml` - GitHub Actions 工作流

### GitHub Actions

工作流会在以下情况自动运行：
- 推送到 main/master/develop 分支
- 创建 Pull Request

### 手动 CI 验证

```bash
# 运行 CI 验证脚本
./scripts/ci-validate.sh

# 本地验证脚本
./scripts/validate-local.sh
```

## 验证规则

### 环境变量命名规范

| 正确格式 | 错误格式 | 说明 |
|----------|----------|------|
| `SEEDREAM_API_KEY` | `SEEDDREAM_API_KEY` | 前缀错误 |
| `SEEDREAM_DATABASE_URL` | `SEEDRAM_DATABASE_URL` | 前缀错误 |
| `SEEDREAM_PORT` | `SEED_DREAM_PORT` | 格式错误 |

### 测试报告命名规范

| 正确格式 | 错误格式 | 说明 |
|----------|----------|------|
| `"SeeDream 3.0"` | `"SeedDream 3.0"` | 显示名称错误 |
| `"SeeDream 3.0"` | `"SeedRam 3.0"` | 品牌名称错误 |

## 输出格式

### 控制台输出

```
🔍 验证项目: /path/to/project

🚀 开始运行命名规范验证...

1️⃣ 环境变量命名验证...
   ✅ 完成: 15/18 通过

2️⃣ 测试报告格式验证...
   ✅ 完成: 8/10 通过

📋 验证摘要
==================================================
状态: ❌ 失败
总检查项: 28
通过检查: 23
失败检查: 5
错误数量: 5
警告数量: 0
执行时间: 1234ms
==================================================

❌ 错误详情:
1. [environment-naming] 环境变量 "SEEDDREAM_API_KEY" 不符合命名规范
   文件: .env.example
   行号: 5
   建议: SEEDREAM_API_KEY
```

### JSON 报告

```json
{
  "timestamp": "2025-08-28T14:30:00.000Z",
  "result": {
    "isValid": false,
    "errors": [
      {
        "type": "environment-naming",
        "message": "环境变量 \"SEEDDREAM_API_KEY\" 不符合命名规范",
        "file": ".env.example",
        "line": 5,
        "severity": "high",
        "suggestion": "SEEDREAM_API_KEY"
      }
    ],
    "warnings": [],
    "summary": {
      "totalChecks": 28,
      "passedChecks": 23,
      "failedChecks": 5,
      "warningCount": 0,
      "errorCount": 5,
      "executionTime": 1234
    }
  }
}
```

## 故障排除

### 常见问题

1. **构建失败**
   ```bash
   # 清理并重新构建
   npm run clean
   npm run build
   ```

2. **权限错误**
   ```bash
   # 确保脚本有执行权限
   chmod +x scripts/*.sh
   ```

3. **Git hooks 不工作**
   ```bash
   # 重新设置 hooks
   ./scripts/setup-ci-hooks.sh
   ```

### 调试模式

```bash
# 启用详细输出
DEBUG=naming-validator node dist/cli-validator.js validate
```

## 开发指南

### 添加新的验证规则

1. 在 `src/validator/types.ts` 中定义新的错误类型
2. 在相应的验证器中实现验证逻辑
3. 添加测试用例
4. 更新文档

### 扩展验证器

```typescript
// 自定义验证器示例
export class CustomValidator {
  async validate(projectPath: string): Promise<ValidationResult> {
    // 实现验证逻辑
  }
}
```

## 贡献

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证

MIT License