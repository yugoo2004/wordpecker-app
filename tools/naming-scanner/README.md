# SeeDream 命名标准化扫描工具

这是一个专门用于 SeeDream 项目的命名标准化扫描和分析工具，能够自动检测项目中所有不规范的命名并提供修复建议。

## 🚀 功能特性

- **全面扫描**: 支持多种文件类型的命名问题检测
- **智能分析**: 基于上下文的智能匹配和分类
- **详细报告**: 生成 Markdown、JSON、CSV 格式的详细报告
- **优先级分级**: 按严重程度对问题进行分级
- **修复建议**: 为每个问题提供具体的修复建议

## 📋 支持的命名模式

| 类别 | 正确格式 | 常见错误格式 | 描述 |
|------|----------|----------|------|
| 环境变量 | `SEEDREAM_*` | `SEEDDREAM_*`, `SEEDRAM_*` | 环境变量前缀 |
| 配置键值 | `seedream` | `seeddream`, `seedram` | 配置文件中的键值 |
| 显示名称 | `SeeDream 3.0` | `SeedRam 3.0`, `SeedDream` | 用户界面显示名称 |
| 文件命名 | `seedream-*` | `seeddream-*`, `seedram-*` | 文件名前缀 |
| 类名 | `SeedreamService` | `SeedRamService`, `SeedDreamService` | TypeScript/JavaScript 类名 |
| 变量名 | `seedreamVariable` | `seedramVariable`, `seedDreamVariable` | 变量和函数名 |
| API 路由 | `/api/seedream` | `/api/seeddream`, `/api/seedram` | API 端点路径 |
| 数据库字段 | `seedream_field` | `seedram_field`, `seeddream_field` | 数据库字段名 |

## 🛠️ 安装和使用

### 安装依赖

```bash
cd tools/naming-scanner
npm install
```

### 构建项目

```bash
npm run build
```

### 运行扫描

```bash
# 扫描当前项目
npm run scan

# 扫描指定路径
npm run scan -- --path /path/to/project

# 自定义输出目录
npm run scan -- --output ./my-reports

# 显示帮助信息
npm run dev -- --help
```

### 命令行选项

```bash
# 基本扫描
npm run scan

# 高级选项
npm run scan -- \
  --path /path/to/project \
  --output ./reports \
  --include "**/*.ts" "**/*.js" \
  --exclude "node_modules/**" \
  --max-size 5 \
  --no-save
```

### 查看支持的模式

```bash
npm run dev patterns
```

### 运行测试扫描

```bash
npm run dev test
```

## 📊 报告格式

工具会生成三种格式的报告：

### 1. Markdown 报告 (详细)
- 包含完整的问题分析和修复建议
- 按类别和文件组织
- 适合人工阅读和审查

### 2. JSON 报告 (结构化)
- 机器可读的结构化数据
- 适合程序化处理和集成
- 包含所有扫描结果的详细信息

### 3. CSV 报告 (表格)
- 适合在电子表格中查看
- 便于数据分析和统计
- 支持筛选和排序

## 🔧 开发和测试

### 运行测试

```bash
npm test
```

### 开发模式

```bash
npm run dev scan -- --path ./test-project
```

### 代码结构

```
src/
├── types/           # TypeScript 类型定义
├── patterns/        # 命名模式定义
├── scanner/         # 文件和内容扫描器
├── analyzer/        # 问题分析器
├── cli.ts          # 命令行界面
└── index.ts        # 主入口文件
```

## 📈 使用示例

### 基本扫描

```typescript
import { NamingScanner } from './src/index.js';

const scanner = new NamingScanner({
  rootPath: './seedream-project',
  excludePatterns: ['node_modules/**', 'dist/**']
});

const result = await scanner.scanProject();
await scanner.saveReport(result, './reports');
```

### 自定义配置

```typescript
const scanner = new NamingScanner({
  rootPath: './seedream-project',
  includePatterns: ['**/*.ts', '**/*.js', '**/*.vue'],
  excludePatterns: ['node_modules/**', '**/*.test.ts'],
  fileTypes: ['.ts', '.js', '.vue', '.json'],
  maxFileSize: 5 * 1024 * 1024, // 5MB
  followSymlinks: false
});
```

## 🎯 修复建议

工具会按优先级提供修复建议：

### 🔴 高优先级
1. **环境变量**: 立即修复，可能影响应用配置
2. **显示名称**: 影响用户体验的品牌名称
3. **API 路由**: 可能影响前后端通信

### 🟡 中优先级
1. **配置文件**: 统一配置键值命名
2. **文件命名**: 重命名文件并更新引用
3. **类名**: 更新 TypeScript/JavaScript 类名

### 🟢 低优先级
1. **变量名**: 统一代码中的变量和函数命名
2. **数据库字段**: 更新数据库相关的字段命名

## 🔄 建议修复流程

1. **备份项目**: 在开始修复前创建完整备份
2. **按优先级修复**: 从高优先级问题开始
3. **分批处理**: 避免一次性修改过多文件
4. **测试验证**: 每次修复后运行测试
5. **提交变更**: 及时提交代码变更

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交变更
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 LICENSE 文件

## 🆘 故障排除

### 常见问题

1. **权限错误**: 确保有读取项目文件的权限
2. **内存不足**: 使用 `--max-size` 限制文件大小
3. **扫描缓慢**: 使用 `--exclude` 排除不必要的目录

### 获取帮助

- 查看命令行帮助: `npm run dev -- --help`
- 运行测试扫描: `npm run dev test`
- 查看支持的模式: `npm run dev patterns`