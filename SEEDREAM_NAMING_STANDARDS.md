# SeeDream 3.0 命名规范维护指南

## 📋 概述

本指南为 SeeDream 3.0 项目提供完整的命名规范标准和维护流程。遵循这些规范可以确保代码库的一致性、可读性和可维护性。

## 🎯 核心命名原则

### 1. 统一性原则
- 在相同上下文中使用相同的命名格式
- 避免混合使用不同的命名变体
- 保持品牌名称的一致性展示

### 2. 上下文相关性原则
- 根据使用场景选择合适的命名格式
- 考虑技术约束和平台规范
- 保持语义的清晰性

### 3. 可维护性原则
- 使用描述性和易于理解的命名
- 避免缩写和模糊的术语
- 便于自动化工具处理

## 📖 命名规范详细说明

### 1. 显示名称规范

**适用场景**: 用户界面、文档标题、品牌展示

**标准格式**: `SeeDream 3.0`

**规则说明**:
- 使用 PascalCase 格式的 "SeeDream"
- 包含版本号 "3.0"
- 不使用连字符或下划线

**正确示例**:
```html
<title>SeeDream 3.0 - 智能语言学习平台</title>
<h1>欢迎使用 SeeDream 3.0</h1>
```

**错误示例**:
```html
<!-- ❌ 错误 -->
<title>SeedDream 3.0</title>
<title>SeedRam 3.0</title>
<title>seeddream 3.0</title>
```

### 2. 环境变量规范

**适用场景**: 配置文件、环境设置、部署脚本

**标准格式**: `SEEDREAM_*`

**规则说明**:
- 使用全大写字母
- 使用 "SEEDREAM" 作为前缀
- 使用下划线分隔单词

**正确示例**:
```bash
SEEDREAM_API_KEY=your_api_key_here
SEEDREAM_MODEL_NAME=doubao-pro-4k
SEEDREAM_IMAGE_MODEL=doubao-vision
SEEDREAM_MAX_TOKENS=4000
SEEDREAM_ENABLE_FALLBACK=true
SEEDREAM_TIMEOUT=30000
```

**错误示例**:
```bash
# ❌ 错误
SEEDDREAM_API_KEY=your_api_key_here
SEEDRAM_MODEL_NAME=doubao-pro-4k
seeddream_image_model=doubao-vision
```

### 3. 配置键值规范

**适用场景**: JSON/YAML 配置文件、对象属性

**标准格式**: `seedream`

**规则说明**:
- 使用全小写字母
- 不使用连字符或下划线
- 保持简洁性

**正确示例**:
```json
{
  "seedream": {
    "apiKey": "your_api_key",
    "modelName": "doubao-pro-4k",
    "imageModel": "doubao-vision"
  }
}
```

**错误示例**:
```json
{
  // ❌ 错误
  "seeddream": { ... },
  "seedram": { ... },
  "seed-dream": { ... }
}
```

### 4. 文件命名规范

**适用场景**: 源代码文件、配置文件、文档文件

**标准格式**: `seedream-*`

**规则说明**:
- 使用 kebab-case 格式
- 使用 "seedream" 作为前缀
- 使用连字符分隔单词

**正确示例**:
```
seedream-image-service.ts
seedream-config.json
seedream-api-client.js
seedream-utils.ts
```

**错误示例**:
```
// ❌ 错误
seeddream-image-service.ts
seedram-config.json
SeedreamApiClient.js
seedream_utils.ts
```

### 5. 类名和接口规范

**适用场景**: TypeScript/JavaScript 类、接口、类型定义

**标准格式**: `SeedreamXxxYyy`

**规则说明**:
- 使用 PascalCase 格式
- 使用 "Seedream" 作为前缀
- 描述性的后缀

**正确示例**:
```typescript
class SeedreamImageService {
  // 实现代码
}

interface SeedreamConfig {
  apiKey: string;
  modelName: string;
}

type SeedreamImageResult = {
  url: string;
  prompt: string;
};
```

**错误示例**:
```typescript
// ❌ 错误
class SeedRamImageService { }
class SeedDreamImageService { }
class seedreamImageService { }
interface SeedRam_Config { }
```

### 6. 变量和函数规范

**适用场景**: JavaScript/TypeScript 变量、函数、方法

**标准格式**: `seedream` 或 `seedreamXxxYyy`

**规则说明**:
- 使用 camelCase 格式
- 简单变量使用 "seedream"
- 复合变量使用描述性后缀

**正确示例**:
```typescript
const seedream = new SeedreamImageService();
const seedreamConfig = loadSeedreamConfig();
const seedreamApiClient = createSeedreamClient();

function initializeSeedreamService() {
  // 实现代码
}

const seedreamImageUrl = await seedream.generateImage(prompt);
```

**错误示例**:
```typescript
// ❌ 错误
const seedRam = new SeedRamImageService();
const SeedreamConfig = loadConfig();
const seedream_api_client = createClient();
```

## 🔧 自动化工具使用

### 1. 命名扫描器

使用内置的命名扫描器检查项目中的命名问题:

```bash
# 进入扫描器目录
cd tools/naming-scanner

# 安装依赖
npm install

# 运行完整扫描
npm run scan

# 运行快速验证
npm run validate

# 生成详细报告
npm run report
```

### 2. 验证脚本

使用项目级别的验证脚本:

```bash
# 运行命名验证
npm run validate-naming

# 或使用 Shell 脚本
./scripts/validate-naming.sh
```

### 3. CI/CD 集成

#### GitHub Actions

项目已配置 GitHub Actions 工作流 (`.github/workflows/naming-validation.yml`):

```yaml
name: Naming Standards Validation
on: [push, pull_request]
jobs:
  validate-naming:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd tools/naming-scanner
          npm install
      - name: Run naming validation
        run: npm run validate-naming
```

#### Pre-commit Hooks

安装 pre-commit hooks 以在提交前自动验证:

```bash
# 安装 hooks
cd tools/naming-scanner
npm run setup-hooks

# 或手动安装
./ci-scripts/install-hooks.sh
```

## 📝 开发工作流

### 1. 新功能开发

在开发新功能时，请遵循以下步骤:

1. **规划阶段**:
   - 确定需要的新文件和类名
   - 按照命名规范设计命名方案
   - 检查是否与现有命名冲突

2. **开发阶段**:
   - 严格按照命名规范编写代码
   - 使用 IDE 插件或工具辅助检查
   - 定期运行验证脚本

3. **测试阶段**:
   - 运行完整的命名验证
   - 检查生成的报告
   - 修复发现的问题

4. **提交阶段**:
   - Pre-commit hooks 自动验证
   - CI/CD 管道进一步验证
   - 确保所有检查通过

### 2. 代码审查清单

在进行代码审查时，请检查以下项目:

- [ ] 所有新增的显示名称使用 "SeeDream 3.0" 格式
- [ ] 环境变量使用 "SEEDREAM_*" 格式
- [ ] 配置键值使用 "seedream" 格式
- [ ] 文件名使用 "seedream-*" 格式
- [ ] 类名使用 "SeedreamXxxYyy" 格式
- [ ] 变量名使用 camelCase "seedream" 格式
- [ ] 没有使用已弃用的命名格式
- [ ] 命名验证工具通过检查

### 3. 重构指南

当需要重构现有代码时:

1. **评估影响范围**:
   - 使用依赖分析工具
   - 识别所有相关文件
   - 评估重构风险

2. **制定重构计划**:
   - 按依赖关系排序重构步骤
   - 准备回滚方案
   - 设置验证检查点

3. **执行重构**:
   - 使用自动化重构工具
   - 逐步执行，及时验证
   - 保持功能完整性

4. **验证结果**:
   - 运行完整测试套件
   - 执行命名验证
   - 生成变更报告

## 🚨 常见问题和解决方案

### 1. 命名冲突

**问题**: 新的命名与现有文件或变量冲突

**解决方案**:
- 使用更具体的描述性后缀
- 检查项目历史，了解命名原因
- 考虑重构现有代码以避免冲突

**示例**:
```typescript
// 冲突情况
const seedreamConfig = {}; // 已存在
const seedreamConfig = {}; // 新增 - 冲突!

// 解决方案
const seedreamConfig = {}; // 现有
const seedreamImageConfig = {}; // 新增 - 更具体
```

### 2. 遗留代码处理

**问题**: 项目中存在大量遗留的不规范命名

**解决方案**:
- 制定渐进式重构计划
- 优先处理高频使用的代码
- 使用自动化工具辅助重构
- 保持向后兼容性

### 3. 第三方库集成

**问题**: 第三方库使用不同的命名约定

**解决方案**:
- 创建适配器层统一命名
- 在项目边界处进行命名转换
- 文档中明确说明外部依赖的命名差异

**示例**:
```typescript
// 第三方库
import { SeedDreamAPI } from 'third-party-lib';

// 适配器
class SeedreamApiAdapter {
  private api: SeedDreamAPI;
  
  constructor() {
    this.api = new SeedDreamAPI();
  }
  
  // 统一的接口
  async generateImage(prompt: string): Promise<SeedreamImageResult> {
    const result = await this.api.generate_image(prompt);
    return this.transformResult(result);
  }
}
```

### 4. 配置管理

**问题**: 不同环境使用不同的命名约定

**解决方案**:
- 使用环境特定的配置文件
- 创建配置验证脚本
- 建立配置同步机制

## 📊 监控和维护

### 1. 定期检查

建议定期执行以下检查:

- **每日**: 自动化 CI/CD 检查
- **每周**: 手动运行完整扫描
- **每月**: 生成合规性报告
- **每季度**: 审查和更新命名规范

### 2. 指标监控

跟踪以下关键指标:

- 命名规范合规率
- 新增命名问题数量
- 修复问题的平均时间
- 团队成员的规范遵循度

### 3. 持续改进

- 收集团队反馈
- 分析常见问题模式
- 优化自动化工具
- 更新培训材料

## 🎓 培训和知识分享

### 1. 新团队成员培训

为新加入的团队成员提供:

- 命名规范概述培训
- 工具使用实践指导
- 常见问题案例分析
- 实际项目练习

### 2. 知识文档

维护以下文档:

- 命名规范快速参考卡
- 工具使用手册
- 最佳实践案例集
- 问题排查指南

### 3. 团队分享

定期组织:

- 命名规范经验分享会
- 工具改进讨论
- 问题解决方案交流
- 最佳实践展示

## 🔗 相关资源

### 文档链接
- [变更日志](SEEDREAM_NAMING_CHANGELOG.md)
- [对比报告](SEEDREAM_NAMING_COMPARISON_REPORT.md)
- [工具文档](tools/naming-scanner/README.md)

### 工具链接
- [命名扫描器](tools/naming-scanner/)
- [验证脚本](scripts/validate-naming.js)
- [CI/CD 配置](.github/workflows/naming-validation.yml)

### 外部参考
- [JavaScript 命名约定](https://developer.mozilla.org/en-US/docs/MDN/Guidelines/Code_guidelines/JavaScript#naming_conventions)
- [TypeScript 编码规范](https://typescript-eslint.io/rules/)
- [Node.js 最佳实践](https://github.com/goldbergyoni/nodebestpractices)

---

**文档版本**: v1.0  
**最后更新**: 2025年8月28日  
**维护者**: SeeDream 3.0 开发团队  
**审核状态**: ✅ 已审核通过