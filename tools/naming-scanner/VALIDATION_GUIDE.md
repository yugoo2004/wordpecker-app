# SeeDream 命名规范验证指南

## 概述

本验证系统提供了完整的自动化命名规范检查功能，确保 SeeDream 项目中的所有命名都符合统一标准。

## 功能特性

### 🔍 环境变量验证
- 检查环境变量前缀一致性 (`SEEDREAM_*`)
- 识别错误的命名格式 (`SEEDDREAM_*`, `SEEDRAM_*`)
- 验证环境变量引用的一致性

### 📊 测试报告验证
- 验证测试报告的格式和结构
- 检查服务名称的正确性
- 确保报告包含必需的字段

### 🏷️ 通用命名检查
- 文件命名规范验证
- 配置文件内容检查
- 文档中的命名一致性

### 🔄 CI/CD 集成
- GitHub Actions 工作流
- 多种输出格式 (JSON, JUnit XML, Text)
- 自动化报告生成

## 快速开始

### 1. 安装依赖

```bash
cd tools/naming-scanner
npm install
npm run build
```

### 2. 基本使用

```bash
# 运行完整验证
npm run validate

# 仅检查环境变量
npm run validate:env

# 仅检查测试报告
npm run validate:reports

# CI/CD 模式
npm run validate:ci
```

### 3. 命令行工具

```bash
# 生成配置文件
node dist/cli-validator.js init

# 运行完整验证
node dist/cli-validator.js validate

# 显示帮助信息
node dist/cli-validator.js help
```

## 配置文件

### 生成默认配置

```bash
node dist/cli-validator.js init --output validation.config.json
```

### 配置文件结构

```json
{
  "environment": {
    "requiredPrefix": "SEEDREAM_",
    "allowedPrefixes": ["SEEDREAM_"],
    "excludePatterns": ["node_modules/**", "dist/**"],
    "checkFiles": ["**/.env*", "**/src/**/*.ts"]
  },
  "report": {
    "requiredFields": ["serviceName", "version", "timestamp"],
    "allowedFormats": ["json", "xml"],
    "schemaValidation": true,
    "maxFileSize": 10485760
  },
  "ci": {
    "enabledChecks": ["environment", "reports", "naming"],
    "failOnWarnings": false,
    "outputFormat": "json",
    "reportPath": "./validation-reports"
  }
}
```

## CLI 命令参考

### 完整验证

```bash
node dist/cli-validator.js validate [选项]

选项:
  -p, --project <path>     项目路径 (默认: 当前目录)
  -c, --config <path>      配置文件路径
  --fail-on-warnings       警告时也失败退出
  --output <format>        输出格式 (json|junit|text)
  --report-path <path>     报告输出路径
```

### 环境变量验证

```bash
node dist/cli-validator.js env [选项]

选项:
  -p, --project <path>     项目路径
  --prefix <prefix>        要求的环境变量前缀
```

### 测试报告验证

```bash
node dist/cli-validator.js reports [选项]

选项:
  -p, --project <path>     项目路径
  --max-size <size>        最大文件大小 (字节)
```

### CI/CD 验证

```bash
node dist/cli-validator.js ci [选项]

选项:
  -p, --project <path>     项目路径
  --checks <checks>        启用的检查项 (逗号分隔)
  --fail-on-warnings       警告时也失败退出
  --output <format>        输出格式
  --report-path <path>     报告输出路径
```

## Shell 脚本使用

项目根目录提供了 `scripts/validate-naming.sh` 脚本：

```bash
# 基本验证
./scripts/validate-naming.sh

# CI/CD 模式
./scripts/validate-naming.sh --ci-mode

# 仅检查环境变量
./scripts/validate-naming.sh --env-only

# 生成 JUnit 报告
./scripts/validate-naming.sh --output junit --fail-on-warnings
```

### 脚本选项

- `-h, --help`: 显示帮助信息
- `-p, --project PATH`: 项目路径
- `-c, --config PATH`: 配置文件路径
- `-o, --output FORMAT`: 输出格式 (json|junit|text)
- `-r, --report-path PATH`: 报告输出路径
- `-f, --fail-on-warnings`: 警告时也失败退出
- `-q, --quiet`: 静默模式
- `-v, --verbose`: 详细输出模式
- `--env-only`: 仅检查环境变量
- `--reports-only`: 仅检查测试报告
- `--ci-mode`: CI/CD 模式
- `--install`: 安装验证工具依赖

## GitHub Actions 集成

项目包含了完整的 GitHub Actions 工作流 (`.github/workflows/naming-validation.yml`)：

### 工作流功能

1. **完整验证**: 运行所有命名规范检查
2. **环境变量检查**: 专门检查环境变量命名
3. **报告检查**: 验证测试报告格式
4. **自动评论**: 在 PR 中自动评论验证结果

### 触发条件

- Push 到 main/develop 分支
- Pull Request 到 main/develop 分支
- 手动触发

### 报告上传

- 验证报告自动上传为 Artifacts
- JUnit 格式报告集成到 GitHub 测试结果
- 失败时自动在 PR 中评论详细信息

## 输出格式

### JSON 格式

```json
{
  "timestamp": "2023-12-01T10:30:00Z",
  "summary": {
    "totalChecks": 150,
    "passedChecks": 145,
    "failedChecks": 5,
    "errorCount": 3,
    "warningCount": 2,
    "executionTime": 1500
  },
  "errors": [
    {
      "type": "environment-variable-error",
      "message": "环境变量使用了错误的前缀",
      "file": ".env.example",
      "line": 5,
      "severity": "high",
      "suggestion": "使用 SEEDREAM_ 前缀"
    }
  ],
  "warnings": [...],
  "isValid": false
}
```

### JUnit XML 格式

适用于 CI/CD 系统的标准 JUnit XML 格式，可以被大多数 CI/CD 工具识别和展示。

### Text 格式

人类可读的纯文本格式，适用于本地开发和调试。

## 常见问题

### Q: 如何添加新的检查规则？

A: 修改相应的验证器类：
- 环境变量: `src/validator/environment-validator.ts`
- 测试报告: `src/validator/report-validator.ts`
- 通用命名: `src/validator/ci-validator.ts`

### Q: 如何排除特定文件或目录？

A: 在配置文件的 `excludePatterns` 中添加 glob 模式：

```json
{
  "environment": {
    "excludePatterns": [
      "node_modules/**",
      "dist/**",
      "my-special-dir/**"
    ]
  }
}
```

### Q: 如何自定义环境变量前缀？

A: 修改配置文件中的 `requiredPrefix`：

```json
{
  "environment": {
    "requiredPrefix": "MYAPP_",
    "allowedPrefixes": ["MYAPP_", "LEGACY_"]
  }
}
```

### Q: 验证失败时如何调试？

A: 使用详细模式和查看报告：

```bash
# 详细输出
./scripts/validate-naming.sh --verbose

# 查看详细报告
cat validation-reports/validation-report-*.json
```

## 开发和扩展

### 添加新的验证器

1. 在 `src/validator/` 目录创建新的验证器类
2. 实现 `ValidationResult` 接口
3. 在 `ValidationRunner` 中集成新验证器
4. 添加相应的 CLI 命令

### 测试验证器

```bash
# 运行验证器测试
npm run test:validator

# 运行单元测试
npm test
```

### 构建和发布

```bash
# 构建项目
npm run build

# 清理构建文件
npm run clean
```

## 最佳实践

1. **定期运行验证**: 在开发过程中定期运行验证
2. **CI/CD 集成**: 将验证集成到 CI/CD 流程中
3. **配置管理**: 使用版本控制管理验证配置
4. **团队协作**: 确保团队成员了解命名规范
5. **持续改进**: 根据项目需求调整验证规则

## 支持和反馈

如有问题或建议，请：
1. 查看项目文档
2. 检查已知问题
3. 提交 Issue 或 Pull Request