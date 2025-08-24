# 监控测试工具使用指南

本目录包含了 WordPecker 持续服务部署的监控测试工具套件，用于验证自动重启、健康检查恢复和监控系统的功能。

## 📋 测试工具概览

### 1. 自动重启功能测试 (`test-auto-restart.sh`)
测试 PM2 和 Systemd 的自动重启机制，包括：
- PM2 进程自动重启
- 服务崩溃后的自动恢复
- 内存限制重启机制
- 重启次数限制保护

### 2. 健康检查恢复测试 (`test-health-recovery.sh`)
验证健康检查系统的故障检测和自动恢复能力：
- 基础健康检查端点测试
- 服务中断检测能力
- 数据库连接状态检测
- 外部API配置检测
- 负载压力下的健康检查
- 健康检查脚本的自动恢复

### 3. 监控系统持续测试 (`test-monitoring-system.sh`)
提供全面的监控系统验证和持续测试：
- 系统资源监控（CPU、内存、磁盘）
- 服务性能监控
- 响应时间监控
- 日志监控
- 监控脚本可用性检查
- 持续监控数据收集和分析

### 4. 统一测试套件 (`run-monitoring-tests.sh`)
提供统一的测试入口和综合报告生成。

## 🚀 快速开始

### 运行所有监控测试
```bash
./scripts/run-monitoring-tests.sh
```

### 快速测试模式（跳过持续监控）
```bash
./scripts/run-monitoring-tests.sh -q
```

### 运行特定测试模块
```bash
# 只测试自动重启功能
./scripts/run-monitoring-tests.sh -r

# 只测试健康检查恢复
./scripts/run-monitoring-tests.sh -h

# 只测试监控系统
./scripts/run-monitoring-tests.sh -m
```

### 自定义持续监控时间
```bash
# 运行5分钟持续监控测试
./scripts/run-monitoring-tests.sh -c 300
```

## 📊 测试报告

测试完成后，会在 `logs/` 目录下生成以下文件：

### JSON 格式报告
- `monitoring-comprehensive-report.json` - 综合测试报告
- `auto-restart-test-results.json` - 自动重启测试结果
- `health-recovery-test-results.json` - 健康检查测试结果
- `monitoring-system-test-results.json` - 监控系统测试结果

### 日志文件
- `monitoring-test-suite.log` - 测试套件执行日志
- `auto-restart-test.log` - 自动重启测试日志
- `health-recovery-test.log` - 健康检查测试日志
- `monitoring-system-test.log` - 监控系统测试日志

### HTML 报告
- `monitoring-test-report.html` - 可视化测试报告

## 🔧 环境要求

### 必需工具
- `pm2` - 进程管理器
- `curl` - HTTP 客户端
- `jq` - JSON 处理工具
- `bc` - 计算器工具

### 服务要求
- WordPecker 后端服务运行在端口 3000
- WordPecker 前端服务运行在端口 5173
- MongoDB 数据库连接正常
- PM2 配置文件 `ecosystem.config.js` 存在

## 📝 测试详情

### 自动重启测试项目
1. **PM2 自动重启** - 强制终止进程后验证自动重启
2. **服务崩溃恢复** - 停止服务后验证自动恢复
3. **内存限制重启** - 验证内存监控和限制重启
4. **重启次数限制** - 验证重启计数器和限制保护

### 健康检查测试项目
1. **基础健康端点** - 测试 `/api/health` 和 `/api/ready` 端点
2. **服务中断检测** - 验证服务中断时的检测能力
3. **数据库连接检测** - 检查数据库连接状态监控
4. **外部API检测** - 验证外部API配置状态检查
5. **负载压力测试** - 高并发下的健康检查稳定性
6. **脚本恢复测试** - 健康检查脚本的自动恢复能力

### 监控系统测试项目
1. **系统资源监控** - CPU、内存、磁盘使用率监控
2. **服务性能监控** - PM2 进程状态和性能指标
3. **响应时间监控** - 各端点的响应时间测量
4. **日志监控** - 日志文件状态和错误统计
5. **脚本可用性** - 监控脚本的存在性和可执行性
6. **持续监控** - 长时间运行的监控数据收集

## 🎯 测试结果解读

### 状态说明
- **PASSED** ✅ - 测试通过，功能正常
- **FAILED** ❌ - 测试失败，需要修复
- **WARNING** ⚠️ - 测试通过但有警告，建议关注
- **SKIPPED** ⏭️ - 测试跳过，通常因为前置条件不满足

### 性能指标
- **响应时间** - API 端点的响应延迟
- **资源使用率** - CPU、内存、磁盘使用百分比
- **成功率** - 请求成功的百分比
- **重启次数** - 服务重启的统计

## 🔍 故障排除

### 常见问题

#### 1. 服务未运行
```bash
# 检查 PM2 状态
pm2 list

# 启动服务
pm2 start ecosystem.config.js --env production
```

#### 2. 端口被占用
```bash
# 检查端口使用情况
netstat -tlnp | grep :3000
netstat -tlnp | grep :5173
```

#### 3. 权限问题
```bash
# 设置脚本可执行权限
chmod +x scripts/*.sh
```

#### 4. 依赖缺失
```bash
# 安装必需工具
sudo apt update
sudo apt install curl jq bc

# 安装 PM2
npm install -g pm2
```

### 调试模式
在脚本中添加调试输出：
```bash
# 启用详细输出
set -x

# 查看详细日志
tail -f logs/monitoring-test-suite.log
```

## 📈 持续集成

### 定时执行
可以通过 cron 定时执行监控测试：
```bash
# 每小时执行快速测试
0 * * * * /path/to/wordpecker/scripts/run-monitoring-tests.sh -q

# 每天执行完整测试
0 2 * * * /path/to/wordpecker/scripts/run-monitoring-tests.sh
```

### 告警集成
测试失败时可以集成告警系统：
```bash
# 测试失败时发送邮件
./scripts/run-monitoring-tests.sh || echo "监控测试失败" | mail -s "WordPecker 监控告警" admin@example.com
```

## 🔗 相关文档

- [持续服务部署需求文档](../.kiro/specs/persistent-service-deployment/requirements.md)
- [持续服务部署设计文档](../.kiro/specs/persistent-service-deployment/design.md)
- [部署任务清单](../.kiro/specs/persistent-service-deployment/tasks.md)

## 📞 支持

如果遇到问题或需要帮助，请：
1. 查看测试日志文件
2. 检查系统环境和依赖
3. 参考故障排除部分
4. 查看相关文档

---

**注意**: 这些测试工具设计用于验证监控系统的可靠性，建议在生产环境部署前充分测试。