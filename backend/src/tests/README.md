# 随机图片 API 测试文档

## 概述

本文档描述了为随机图片 API 功能编写的完整测试套件，包括单元测试和集成测试，涵盖了 API 密钥验证、随机选择算法、错误处理场景、新API端点功能、Pexels API集成完整性和会话管理的端到端流程。

## 测试文件结构

### 1. API 密钥验证测试 (`api-key-validation.test.ts`)

**测试覆盖范围：**
- `validatePexelsApiKey` 函数的格式验证
- `StockPhotoService.validateApiKey` 方法的网络验证
- 边界情况和性能测试

**主要测试用例：**
- ✅ 有效 API 密钥格式验证（30-60个字符的字母数字字符串）
- ✅ 无效 API 密钥格式拒绝（太短、太长、包含特殊字符）
- ✅ 边界情况处理（null、undefined、非字符串类型）
- ✅ HTTP 状态码处理（200、401、429、500等）
- ✅ 网络错误处理（超时、DNS解析失败、SSL证书错误）
- ✅ 并发验证请求处理
- ✅ 性能测试（验证在合理时间内完成）

### 2. 随机选择算法测试 (`random-algorithm.test.ts`)

**测试覆盖范围：**
- 随机数生成的基本功能验证
- 算法逻辑的正确性测试

**主要测试用例：**
- ✅ 随机数生成范围验证（0-1之间）
- ✅ 随机性分布验证（生成的数字有足够的多样性）

### 3. 错误处理场景测试 (`error-handling-scenarios.test.ts`)

**测试覆盖范围：**
- 网络错误处理
- HTTP 错误状态码处理
- API 响应数据错误处理
- 会话管理错误处理
- 内存和资源错误处理
- 边界条件错误处理
- API 统计错误处理

**主要测试用例：**
- ✅ 网络连接超时、DNS解析失败、SSL证书错误
- ✅ HTTP 状态码处理（400、401、403、404、429、500、502、503）
- ✅ 空响应体、格式错误的JSON、缺少必需字段
- ✅ 无效会话ID、会话统计错误、会话清理错误
- ✅ 内存不足、并发请求过多的情况
- ✅ 极长搜索查询、特殊字符、数值和对象类型查询
- ✅ API调用失败时的统计更新

## 集成测试文件结构

### 4. 随机图片API集成测试 (`random-image-integration.test.ts`)

**测试覆盖范围：**
- 新的随机图片API端点功能测试
- API错误处理和响应格式验证
- 端点参数验证和边界情况处理

**主要测试用例：**
- ✅ GET /api/image-description/random 端点功能测试
- ✅ GET /api/image-description/random/:category 分类端点测试
- ✅ GET /api/image-description/validate-api 配置验证端点测试
- ✅ GET /api/image-description/stats API使用统计端点测试
- ✅ GET /api/image-description/metrics 性能指标端点测试
- ✅ GET /api/image-description/quota 配额监控端点测试
- ✅ 错误响应格式和HTTP状态码验证
- ✅ 查询参数处理和验证

### 5. 会话管理集成测试 (`session-management-integration.test.ts`)

**测试覆盖范围：**
- 会话创建和生命周期管理
- 会话统计和监控功能
- 会话管理API端点测试
- 端到端会话流程验证

**主要测试用例：**
- ✅ 会话创建和图片去重机制
- ✅ 多会话并发处理
- ✅ GET /api/image-description/sessions/:sessionId/stats 会话统计端点
- ✅ POST /api/image-description/sessions/:sessionId/manage 会话管理端点
- ✅ GET /api/image-description/sessions/overview 会话概览端点
- ✅ 会话偏好设置更新和验证
- ✅ 会话清理和超时处理
- ✅ 端到端会话生命周期测试

### 6. Pexels API集成完整性测试 (`pexels-api-integration.test.ts`)

**测试覆盖范围：**
- Pexels API密钥验证和认证
- 图片获取功能完整性验证
- API使用统计和监控集成
- 错误处理和重试机制测试
- 性能和负载测试

**主要测试用例：**
- ✅ API密钥有效性验证
- ✅ 随机图片获取功能测试
- ✅ 基于查询的图片搜索测试
- ✅ 会话内图片去重验证
- ✅ API使用统计跟踪测试
- ✅ 配额使用监控测试
- ✅ 性能指标收集验证
- ✅ 网络错误和API错误处理
- ✅ 重试机制验证
- ✅ 并发请求处理测试
- ✅ 数据完整性和格式验证
- ✅ 国际化查询支持测试

## 测试统计

### 单元测试
- **测试文件数：** 3个
- **测试用例数：** 51个
- **测试通过率：** 100%

### 集成测试
- **测试文件数：** 3个
- **测试用例数：** 45+个
- **测试覆盖范围：** API端点、会话管理、Pexels集成

### 总体覆盖的需求
- **需求 1.3：** API 密钥验证功能
- **需求 2.1：** 随机选择算法的正确性
- **需求 2.4：** 新的API端点功能
- **需求 3.4：** 错误处理场景
- **需求 4.1：** 会话管理的端到端流程

## 运行测试

### 运行所有测试（单元测试 + 集成测试）
```bash
# 运行所有测试
npm test

# 运行所有随机图片API相关测试
npm test -- --testPathPattern="api-key-validation|random-algorithm|error-handling-scenarios|random-image-integration|session-management-integration|pexels-api-integration"
```

### 运行单元测试
```bash
# 运行所有单元测试
npm test -- --testPathPattern="api-key-validation|random-algorithm|error-handling-scenarios"

# 运行特定单元测试文件
npm test -- --testPathPattern="api-key-validation"
npm test -- --testPathPattern="random-algorithm"
npm test -- --testPathPattern="error-handling-scenarios"
```

### 运行集成测试
```bash
# 使用集成测试运行器（推荐）
ts-node src/tests/integration-test-runner.ts

# 运行特定类别的集成测试
ts-node src/tests/integration-test-runner.ts --category api      # API端点测试
ts-node src/tests/integration-test-runner.ts --category session # 会话管理测试
ts-node src/tests/integration-test-runner.ts --category pexels  # Pexels API测试

# 直接运行集成测试文件
npm test -- --testPathPattern="random-image-integration"
npm test -- --testPathPattern="session-management-integration"
npm test -- --testPathPattern="pexels-api-integration"
```

### 运行测试并生成覆盖率报告
```bash
# 生成完整覆盖率报告
npm test -- --coverage

# 生成随机图片API功能的覆盖率报告
npm test -- --coverage --testPathPattern="api-key-validation|random-algorithm|error-handling-scenarios|random-image-integration|session-management-integration|pexels-api-integration"
```

## 测试环境配置

### 基础配置
- **测试框架：** Jest
- **TypeScript 支持：** ts-jest
- **测试超时：** 30秒（集成测试）/ 15秒（单元测试）
- **测试环境：** Node.js
- **HTTP测试：** Supertest

### 环境变量要求
```bash
# 必需的环境变量
PEXELS_API_KEY=your_pexels_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# 可选的测试配置
NODE_ENV=test
MONGODB_URL=mongodb://localhost:27017/wordpecker_test
```

### 集成测试特殊配置
- **真实API调用：** 集成测试会进行真实的Pexels API调用
- **会话管理：** 测试会创建和清理真实的会话数据
- **网络依赖：** 需要稳定的网络连接
- **API配额：** 会消耗真实的API配额

## 测试最佳实践

### 单元测试最佳实践
1. **模拟外部依赖：** 所有网络请求都被模拟，确保测试的独立性和可重复性
2. **边界条件测试：** 覆盖了各种边界情况和异常输入
3. **性能测试：** 验证关键操作在合理时间内完成
4. **错误处理：** 全面测试各种错误场景和恢复机制
5. **清理机制：** 每个测试后都清理状态，避免测试间的相互影响

### 集成测试最佳实践
1. **真实环境测试：** 使用真实的API和服务进行端到端测试
2. **数据隔离：** 每个测试使用独立的会话ID和测试数据
3. **资源清理：** 测试完成后自动清理创建的会话和数据
4. **错误恢复：** 测试各种网络错误和API错误的处理
5. **性能监控：** 验证API响应时间和系统性能指标
6. **并发测试：** 验证系统在并发请求下的稳定性
7. **数据完整性：** 验证返回数据的格式和完整性

## 持续集成

### 测试执行策略
**单元测试：** 应该在每次代码提交时运行
- 代码提交前
- Pull Request 创建时
- 合并到主分支时

**集成测试：** 应该在以下情况下运行
- 部署到测试环境前
- 部署到生产环境前
- 定期的回归测试（每日/每周）
- 重要功能发布前

### CI/CD 配置建议
```yaml
# 示例 GitHub Actions 配置
test-unit:
  runs-on: ubuntu-latest
  steps:
    - name: Run Unit Tests
      run: npm test -- --testPathPattern="api-key-validation|random-algorithm|error-handling-scenarios"

test-integration:
  runs-on: ubuntu-latest
  needs: test-unit
  steps:
    - name: Run Integration Tests
      run: ts-node src/tests/integration-test-runner.ts
      env:
        PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

## 维护说明

### 测试维护指南
- **新功能开发：** 添加新功能时，应该同时编写对应的单元测试和集成测试
- **功能修改：** 修改现有功能时，应该更新相关的测试用例
- **API变更：** API接口变更时，必须更新集成测试中的端点测试
- **错误处理：** 新增错误类型时，应该添加对应的错误处理测试

### 测试覆盖率监控
- 定期审查测试覆盖率报告
- 确保关键代码路径都被测试覆盖
- 新代码的测试覆盖率应该不低于80%
- 核心功能的测试覆盖率应该达到95%以上

### 测试性能监控
- 监控集成测试的执行时间
- 如果测试执行时间过长，考虑优化或并行化
- 定期检查API调用的响应时间
- 监控测试环境的资源使用情况

### 故障排除指南
1. **集成测试失败：** 检查网络连接和API密钥配置
2. **超时错误：** 增加测试超时时间或优化测试逻辑
3. **API配额超限：** 使用测试专用的API密钥或实施请求限流
4. **会话冲突：** 确保每个测试使用唯一的会话ID
5. **数据不一致：** 检查测试数据的清理和隔离机制