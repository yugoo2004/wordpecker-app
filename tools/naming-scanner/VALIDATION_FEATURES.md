# 自动化验证功能说明

## 概述

本文档描述了 SeeDream 命名扫描工具的自动化验证功能，这些功能用于检查环境变量命名一致性、测试报告格式验证，以及 CI/CD 集成的命名规范检查。

## 功能模块

### 1. 环境变量验证器 (EnvironmentValidator)

**功能**: 检查项目中所有环境变量的命名一致性

**验证规则**:
- ✅ 正确格式: `SEEDREAM_*`
- ❌ 错误格式: `SEEDDREAM_*`, `SEEDRAM_*`, `SEED_DREAM_*`

**扫描文件类型**:
- `.env*` 文件
- 配置文件 (`*.config.js`, `*.config.ts`)
- 环境配置目录下的文件

**使用方法**:
```bash
# 单独运行环境变量验证
npm run validate:env

# 或使用 CLI
node dist/cli.js validate --env-only
```

### 2. 测试报告验证器 (ReportValidator)

**功能**: 验证测试报告文件中的服务名称和格式

**验证规则**:
- ✅ 正确服务名称: `SeeDream 3.0`, `seedream`, `Seedream`
- ❌ 错误服务名称: `SeedDream 3.0`, `SeedRam 3.0`, `seedram`, `seeddream`

**扫描文件类型**:
- `*test-report*.json`
- `*-report-*.json`
- `reports/**/*.json`
- `test-results/**/*.json`

**使用方法**:
```bash
# 单独运行测试报告验证
npm run validate:reports

# 或使用 CLI
node dist/cli.js validate --reports-only
```

### 3. CI/CD 验证器 (CIValidator)

**功能**: 提供 CI/CD 集成的命名规范检查

**特性**:
- 可配置的错误和警告阈值
- 多种输出格式 (text, json, junit, github)
- 自动生成 pre-commit hook
- 自动生成 GitHub Actions 工作流

**使用方法**:
```bash
# 运行 CI 模式验证
npm run validate:ci

# 或使用 CLI
node dist/cli.js validate --ci --fail-on-errors --output-format=github
```

### 4. 验证运行器 (ValidationRunner)

**功能**: 统一的验证入口，协调所有验证器

**特性**:
- 运行所有验证检查
- 生成综合报告
- 提供改进建议和后续步骤
- 支持报告文件生成

**使用方法**:
```bash
# 运行完整验证
npm run validate

# 或使用 CLI
node dist/cli.js validate --output ./reports
```

## CLI 命令

### 基本验证命令

```bash
# 运行所有验证
node dist/cli.js validate

# 指定项目路径
node dist/cli.js validate --path /path/to/project

# 生成报告到指定目录
node dist/cli.js validate --output ./validation-reports
```

### CI/CD 模式

```bash
# 启用 CI 模式
node dist/cli.js validate --ci

# 配置失败条件
node dist/cli.js validate --ci --fail-on-errors --fail-on-warnings

# 设置阈值
node dist/cli.js validate --ci --max-errors 0 --max-warnings 5 --min-validation-rate 0.95

# 指定输出格式
node dist/cli.js validate --ci --output-format json --output-file results.json
```

### 设置 CI/CD 集成

```bash
# 生成 GitHub Actions 工作流
node dist/cli.js setup-ci --github-actions

# 生成 pre-commit hook
node dist/cli.js setup-ci --pre-commit

# 同时生成两者
node dist/cli.js setup-ci --github-actions --pre-commit
```

## 配置选项

### 验证运行器配置

```typescript
interface ValidationRunnerConfig {
  projectRoot: string;           // 项目根目录
  outputDir?: string;           // 报告输出目录
  generateReports: boolean;     // 是否生成报告文件
  ciMode: boolean;             // 是否启用 CI 模式
  ciConfig?: Partial<CIValidationConfig>;
}
```

### CI 验证配置

```typescript
interface CIValidationConfig {
  failOnErrors: boolean;        // 遇到错误时失败
  failOnWarnings: boolean;      // 遇到警告时失败
  outputFormat: 'json' | 'junit' | 'github' | 'text';
  outputFile?: string;          // 输出文件路径
  excludePatterns: string[];    // 排除模式
  includePatterns: string[];    // 包含模式
  thresholds: {
    maxErrors: number;          // 最大错误数
    maxWarnings: number;        // 最大警告数
    minValidationRate: number;  // 最小验证率 (0-1)
  };
}
```

## 输出格式

### 文本格式 (默认)

```
# SeeDream 命名规范验证报告

## 验证结果: ❌ 失败

## 摘要
- 总验证器: 2
- 通过验证: 1
- 失败验证: 1
- 成功率: 50.0%

## 详细结果

### 📋 环境变量验证
- 状态: ❌ 失败
- 错误数: 3
- 警告数: 1
```

### JSON 格式

```json
{
  "success": false,
  "exitCode": 1,
  "summary": {
    "totalChecks": 2,
    "passedChecks": 1,
    "failedChecks": 1,
    "errors": 3,
    "warnings": 1,
    "validationRate": 0.85
  },
  "environmentValidation": { ... },
  "reportValidation": { ... },
  "recommendations": [
    "修复环境变量命名问题，统一使用 SEEDREAM_ 前缀"
  ]
}
```

### GitHub Actions 格式

```
::error file=.env,line=5::使用了错误的环境变量前缀 "SEEDDREAM_": SEEDDREAM_API_KEY
::warning file=test-report.json::字段值 "SeedRam 3.0" 使用了错误的服务名称
::notice::验证完成: 1/2 通过, 验证率 85.0%
```

### JUnit XML 格式

```xml
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="命名规范验证" tests="2" failures="1" errors="3">
  <testsuite name="环境变量验证" tests="1">
    <testcase name="环境变量命名一致性" classname="EnvironmentValidator">
      <failure message="环境变量命名不一致">
        发现 3 个错误
      </failure>
    </testcase>
  </testsuite>
</testsuites>
```

## 集成示例

### GitHub Actions 工作流

```yaml
name: 命名规范检查

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  naming-validation:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: 设置 Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: 安装依赖
      run: |
        npm ci
        cd tools/naming-scanner && npm ci
    
    - name: 构建命名扫描器
      run: |
        cd tools/naming-scanner && npm run build
    
    - name: 运行命名规范验证
      run: |
        node tools/naming-scanner/dist/cli.js validate --ci \
          --fail-on-errors=true \
          --fail-on-warnings=false \
          --output-format=github \
          --max-errors=0 \
          --max-warnings=10 \
          --min-validation-rate=0.95
```

### Pre-commit Hook

```bash
#!/bin/sh
# SeeDream 命名规范 pre-commit hook

echo "🔍 检查命名规范..."

# 运行命名规范验证
node tools/naming-scanner/dist/cli.js validate --ci \
  --fail-on-errors=true \
  --fail-on-warnings=false \
  --output-format=text \
  --max-errors=0 \
  --max-warnings=10 \
  --min-validation-rate=0.95

exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "❌ 命名规范检查失败，请修复问题后重新提交"
  echo "💡 运行 'npm run naming:fix' 尝试自动修复"
  exit 1
fi

echo "✅ 命名规范检查通过"
exit 0
```

## 错误处理

### 常见错误类型

1. **环境变量错误**
   - 错误前缀使用
   - 命名格式不正确
   - 文件读取失败

2. **测试报告错误**
   - JSON 格式无效
   - 服务名称错误
   - 必需字段缺失

3. **系统错误**
   - 文件访问权限
   - 网络连接问题
   - 内存不足

### 错误恢复策略

- 自动跳过无法访问的文件
- 提供详细的错误信息和修复建议
- 支持部分失败的情况下继续执行
- 生成错误报告供后续分析

## 性能优化

### 扫描优化

- 并行文件处理
- 智能文件过滤
- 缓存扫描结果
- 增量验证支持

### 内存优化

- 流式文件处理
- 分批处理大型项目
- 及时释放资源
- 垃圾回收优化

## 扩展性

### 添加新的验证器

1. 实现验证器接口
2. 添加到验证运行器
3. 更新 CLI 命令
4. 编写测试用例

### 自定义验证规则

1. 扩展现有验证器
2. 添加配置选项
3. 更新文档
4. 提供示例

## 故障排除

### 常见问题

1. **构建失败**
   ```bash
   cd tools/naming-scanner
   npm install
   npm run build
   ```

2. **权限错误**
   ```bash
   chmod +x .git/hooks/pre-commit
   ```

3. **依赖问题**
   ```bash
   npm ci
   cd tools/naming-scanner && npm ci
   ```

### 调试模式

```bash
# 启用详细日志
DEBUG=naming-scanner:* node dist/cli.js validate

# 生成调试报告
node dist/cli.js validate --debug --output ./debug-reports
```

## 最佳实践

1. **定期运行验证**: 建议在每次提交前运行验证
2. **设置 CI 检查**: 在 CI/CD 流水线中集成验证
3. **团队培训**: 确保团队了解命名规范
4. **文档维护**: 保持命名规范文档的更新
5. **工具更新**: 定期更新验证工具以获得最新功能

## 总结

自动化验证功能为 SeeDream 项目提供了全面的命名规范检查能力，通过环境变量验证、测试报告验证和 CI/CD 集成，确保项目中的命名保持一致性和规范性。这些工具不仅可以发现现有的命名问题，还能防止新的命名问题引入，提高代码质量和团队协作效率。