# SeeDream 命名规范自动化验证指南

## 概述

本验证工具提供了完整的自动化验证解决方案，用于检查 SeeDream 项目中的命名规范一致性。支持环境变量、测试报告格式和 CI/CD 集成的验证。

## 功能特性

### 🔍 环境变量验证
- 检查环境变量命名一致性
- 验证 `SEEDREAM_*` 前缀格式
- 识别错误的 `SEEDDREAM_*` 和 `SEEDRAM_*` 格式
- 提供修复建议

### 📊 测试报告验证
- 验证测试报告 JSON 格式
- 检查必需字段完整性
- 验证服务名称命名规范
- 架构和数据类型验证

### ⚙️ CI/CD 集成验证
- 检查 CI/CD 配置文件
- 验证必需的验证步骤
- 确保命名规范检查已集成
- 支持 GitHub Actions、GitLab CI、Jenkins

## 安装和设置

### 1. 安装依赖

```bash
cd tools/naming-scanner
npm install
npm run build
```

### 2. 生成默认配置

```bash
npm run start -- init-config --output validation.config.json
```

## 使用方法

### 命令行界面

#### 运行所有验证
```bash
# 运行所有验证检查
npm run validate

# 严格模式（警告也会导致失败）
npm run validate -- --strict

# 输出报告到文件
npm run validate -- --output validation-report.md
```

#### 单独验证模块

```bash
# 仅验证环境变量
npm run validate-env

# 仅验证测试报告
npm run validate-reports

# 仅验证 CI/CD 配置
npm run validate-ci
```

#### 使用 CLI 工具

```bash
# 完整验证
npx tsx src/cli.ts validate

# 环境变量验证
npx tsx src/cli.ts validate-env --output env-report.json

# 测试报告验证
npx tsx src/cli.ts validate-reports --output report-validation.json

# CI/CD 验证
npx tsx src/cli.ts validate-ci --output ci-validation.json
```

### 独立验证脚本

项目根目录提供了独立的验证脚本：

```bash
# 运行完整验证
node scripts/validate-naming.js

# 严格模式
node scripts/validate-naming.js --strict

# 仅验证环境变量
node scripts/validate-naming.js --env-only

# 仅验证测试报告
node scripts/validate-naming.js --reports-only

# 仅验证 CI/CD
node scripts/validate-naming.js --ci-only

# 输出报告
node scripts/validate-naming.js --output validation-report.md
```

## 配置文件

### 配置文件结构

```json
{
  "environment": {
    "enabled": true,
    "checkFiles": ["**/.env*"],
    "requiredPrefix": "SEEDREAM_",
    "allowedVariables": ["SEEDREAM_API_KEY"],
    "forbiddenPatterns": ["SEEDDREAM_*", "SEEDRAM_*"]
  },
  "reports": {
    "enabled": true,
    "reportPaths": ["**/*test-report*.json"],
    "requiredFields": ["serviceName", "timestamp"],
    "formatValidation": true,
    "schemaValidation": true
  },
  "ci": {
    "enabled": true,
    "configFiles": [".github/workflows/*.yml"],
    "requiredSteps": ["naming-validation"],
    "integrationChecks": true
  },
  "general": {
    "strictMode": false,
    "failOnWarnings": false,
    "outputFormat": "text",
    "logLevel": "info"
  }
}
```

### 配置选项说明

#### 环境变量配置 (`environment`)
- `enabled`: 是否启用环境变量验证
- `checkFiles`: 要检查的文件模式
- `requiredPrefix`: 必需的环境变量前缀
- `allowedVariables`: 允许的环境变量列表
- `forbiddenPatterns`: 禁止的命名模式

#### 测试报告配置 (`reports`)
- `enabled`: 是否启用报告验证
- `reportPaths`: 报告文件路径模式
- `requiredFields`: 必需的字段列表
- `formatValidation`: 是否验证格式
- `schemaValidation`: 是否验证架构

#### CI/CD 配置 (`ci`)
- `enabled`: 是否启用 CI 验证
- `configFiles`: CI 配置文件模式
- `requiredSteps`: 必需的验证步骤
- `integrationChecks`: 是否检查集成状态

## CI/CD 集成

### GitHub Actions

创建 `.github/workflows/naming-validation.yml`:

```yaml
name: 命名规范验证

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  naming-validation:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: 设置 Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: 安装依赖
      run: |
        npm ci
        cd tools/naming-scanner && npm ci && npm run build
    
    - name: 运行命名规范验证
      run: |
        node scripts/validate-naming.js --output naming-validation-report.md
    
    - name: 上传验证报告
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: naming-validation-report
        path: naming-validation-report.md
```

### GitLab CI

在 `.gitlab-ci.yml` 中添加：

```yaml
naming-validation:
  stage: validate
  image: node:18
  
  before_script:
    - npm ci
    - cd tools/naming-scanner && npm ci && npm run build
    
  script:
    - node scripts/validate-naming.js --output naming-validation-report.md
    
  artifacts:
    when: always
    paths:
      - naming-validation-report.md
    expire_in: 1 week
```

### Jenkins

```groovy
pipeline {
    agent any
    
    stages {
        stage('命名规范验证') {
            steps {
                sh '''
                    npm ci
                    cd tools/naming-scanner
                    npm ci && npm run build
                    cd ../..
                    node scripts/validate-naming.js --output naming-validation-report.md
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'naming-validation-report.md'
                }
            }
        }
    }
}
```

## 验证规则

### 环境变量命名规则

| 正确格式 | 错误格式 | 说明 |
|---------|---------|------|
| `SEEDREAM_API_KEY` | `SEEDDREAM_API_KEY` | 前缀应为 SEEDREAM_ |
| `SEEDREAM_CONFIG` | `SEEDRAM_CONFIG` | 避免缩写形式 |
| `SEEDREAM_VERSION` | `seedream_version` | 使用大写格式 |

### 测试报告命名规则

| 字段 | 正确格式 | 错误格式 |
|------|---------|---------|
| serviceName | "SeeDream 3.0" | "SeedRam 3.0" |
| appName | "SeeDream API" | "SeedDream API" |
| 测试名称 | "SeeDream 功能测试" | "SeedRam 功能测试" |

### CI/CD 集成要求

- 必须包含命名验证步骤
- 建议在 lint 阶段运行
- 支持生成验证报告
- 失败时应阻止部署

## 输出格式

### 文本格式输出

```
🚀 开始运行自动化验证...

📋 验证环境变量命名一致性...
✅ 环境变量验证完成: 5/5 通过

📊 验证测试报告格式...
✅ 测试报告验证完成: 3/3 通过

🔧 验证 CI/CD 集成配置...
✅ CI/CD 验证完成: 2/2 通过

📊 验证总结:
   状态: ✅ 通过
   检查项: 10/10 通过
   错误: 0 个
   警告: 2 个
   耗时: 1250ms
```

### JSON 格式输出

```json
{
  "isValid": true,
  "errors": [],
  "warnings": [
    {
      "type": "environment-inconsistency",
      "message": "变量 API_KEY 在不同文件中使用了不同的格式",
      "suggestion": "建议统一使用: SEEDREAM_API_KEY"
    }
  ],
  "summary": {
    "totalChecks": 10,
    "passedChecks": 10,
    "failedChecks": 0,
    "warningCount": 2,
    "duration": 1250
  }
}
```

## 故障排除

### 常见问题

1. **找不到配置文件**
   ```bash
   # 生成默认配置
   npx tsx src/cli.ts init-config
   ```

2. **依赖安装失败**
   ```bash
   # 清理并重新安装
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **TypeScript 编译错误**
   ```bash
   # 重新构建
   npm run clean && npm run build
   ```

4. **权限错误**
   ```bash
   # 确保脚本有执行权限
   chmod +x scripts/validate-naming.js
   ```

### 调试模式

启用详细日志输出：

```bash
# 设置日志级别
export LOG_LEVEL=debug
npm run validate

# 或使用 CLI 选项
npx tsx src/cli.ts validate --log-level debug
```

## 最佳实践

1. **定期运行验证**
   - 在 pre-commit hook 中集成
   - 在 CI/CD 流程中自动运行
   - 定期手动检查

2. **配置管理**
   - 使用版本控制管理配置文件
   - 为不同环境创建不同配置
   - 定期更新验证规则

3. **团队协作**
   - 在团队中推广命名规范
   - 提供培训和文档
   - 建立代码审查流程

4. **持续改进**
   - 收集验证结果数据
   - 分析常见问题模式
   - 优化验证规则和性能

## 扩展开发

### 添加新的验证器

1. 创建验证器类：
```typescript
export class CustomValidator {
  async validate(projectRoot: string): Promise<ValidationResult> {
    // 实现验证逻辑
  }
}
```

2. 集成到验证运行器：
```typescript
// 在 ValidationRunner 中添加
const customResult = await customValidator.validate(projectRoot);
```

3. 更新配置类型：
```typescript
interface ValidationConfig {
  // 添加新的配置选项
  custom: CustomValidationConfig;
}
```

### 自定义输出格式

```typescript
class CustomReporter {
  generateReport(result: ValidationResult): string {
    // 实现自定义报告格式
  }
}
```

## 支持和反馈

如有问题或建议，请：

1. 查看本文档的故障排除部分
2. 检查项目的 GitHub Issues
3. 联系开发团队
4. 提交 Pull Request 贡献改进

---

*最后更新: 2024年8月*