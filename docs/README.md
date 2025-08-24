# WordPecker Sealos 部署文档

## 概述

本文档集提供了 WordPecker 应用在 Sealos 云平台上的完整部署、管理和维护指南。

## 文档结构

### 📚 主要文档

#### 1. [Sealos 部署指南](./sealos-deployment-guide.md)
**完整的部署指南，包含从环境准备到应用上线的全流程**

- 环境要求和 Sealos 环境准备
- 数据库配置和应用部署
- 服务管理和网络配置
- 监控日志和故障排查
- 成本优化和维护指南

#### 2. [环境变量配置清单](./environment-variables.md)
**详细的环境变量配置说明和示例**

- 后端环境变量完整清单
- 前端环境变量配置说明
- PM2 和 systemd 环境配置
- 配置验证和安全建议

#### 3. [故障排查和维护文档](./troubleshooting-maintenance.md)
**全面的故障排查指南和日常维护操作**

- 故障排查流程和诊断工具
- 常见问题及解决方案
- 日志分析和性能监控
- 日常维护和应急处理

#### 4. [成本优化指南](./cost-optimization.md)
**Sealos 平台成本控制和优化策略**

- 成本分析和资源优化策略
- 配置优化和监控告警
- 自动化管理和最佳实践

## 🚀 快速开始

### 新用户部署流程
1. 阅读 [Sealos 部署指南](./sealos-deployment-guide.md) 的环境要求部分
2. 按照指南创建 Sealos 环境和数据库
3. 参考 [环境变量配置清单](./environment-variables.md) 配置应用
4. 使用提供的脚本工具部署和启动应用
5. 参考 [成本优化指南](./cost-optimization.md) 优化资源配置

### 现有用户维护流程
1. 使用 [故障排查文档](./troubleshooting-maintenance.md) 解决问题
2. 执行日常维护任务和健康检查
3. 定期进行成本分析和优化
4. 保持文档和配置的更新

## 🛠️ 工具和脚本

### 部署和管理脚本
```bash
# 基础启动脚本
./scripts/start-app.sh          # 启动完整应用
./scripts/stop-app.sh           # 停止所有服务
./scripts/restart-app.sh        # 重启应用
./scripts/status-app.sh         # 查看服务状态

# PM2 进程管理
./scripts/pm2-start.sh          # PM2 启动管理
./scripts/pm2-stop.sh           # PM2 停止管理
./scripts/pm2-logs.sh           # PM2 日志管理

# systemd 服务管理
./scripts/setup-systemd.sh     # 配置 systemd 服务
./scripts/systemd-manage.sh    # systemd 服务管理
```

### 监控和维护脚本
```bash
# 监控工具
./scripts/monitor.sh            # 系统监控
./scripts/monitor.sh --watch    # 持续监控模式

# 日志管理
./scripts/setup-logrotate.sh   # 配置日志轮转
./scripts/test-logrotate.sh     # 测试日志轮转

# 诊断工具
./scripts/quick-diagnosis.sh   # 快速诊断
./scripts/detailed-diagnosis.sh # 详细诊断
```

### 成本优化脚本
```bash
# 成本分析
./scripts/cost-calculator.sh   # 成本计算器
./scripts/cost-monitor.sh      # 成本监控

# 资源优化
./scripts/storage-optimizer.sh # 存储优化
./scripts/memory-optimizer.sh  # 内存优化
./scripts/cpu-optimizer.sh     # CPU 优化

# 自动化管理
./scripts/auto-scaling.sh      # 自动扩缩容
./scripts/scheduled-optimization.sh # 定时优化
```

## 📋 检查清单

### 部署前检查
- [ ] Sealos 账户已创建并充值
- [ ] Devbox 实例已创建 (2核2GB推荐)
- [ ] MongoDB 数据库已创建
- [ ] 网络访问权限已配置
- [ ] 必要的工具已安装 (Node.js, npm)

### 部署后验证
- [ ] 后端服务正常启动 (端口 3000)
- [ ] 前端服务正常启动 (端口 5173)
- [ ] 数据库连接正常
- [ ] 公网访问正常
- [ ] 日志记录正常

### 日常维护检查
- [ ] 服务健康状态检查
- [ ] 资源使用率监控
- [ ] 日志文件清理
- [ ] 配置文件备份
- [ ] 安全更新检查

### 成本优化检查
- [ ] 资源使用率分析
- [ ] 成本趋势监控
- [ ] 配置优化评估
- [ ] 自动化任务设置

## 🔧 配置模板

### 后端环境变量模板
```env
# 服务配置
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# 数据库配置
MONGODB_URI=mongodb://username:password@host:27017/wordpecker
DB_NAME=wordpecker

# JWT 配置
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# CORS 配置
CORS_ORIGIN=http://101.126.5.123:5173,http://localhost:5173
```

### 前端环境变量模板
```env
# API 配置
VITE_API_URL=http://101.126.5.123:3000
VITE_API_PREFIX=/api

# 应用配置
VITE_APP_TITLE=WordPecker
VITE_APP_VERSION=1.0.0

# 开发服务器配置
VITE_DEV_SERVER_HOST=0.0.0.0
VITE_DEV_SERVER_PORT=5173
```

## 📞 支持和帮助

### 常见问题
1. **服务无法启动**: 检查端口占用和环境变量配置
2. **前端无法访问后端**: 检查 CORS 配置和网络连接
3. **数据库连接失败**: 验证连接字符串和网络权限
4. **内存不足**: 调整 PM2 配置或升级实例

### 获取帮助
- 查看相应的文档章节
- 使用诊断脚本进行问题定位
- 检查日志文件获取详细错误信息
- 参考故障排查文档的解决方案

### 文档更新
本文档集会根据实际使用情况和用户反馈持续更新。建议定期查看最新版本以获取最新的部署和维护指南。

## 📝 版本信息

- **文档版本**: v1.0.0
- **适用应用版本**: WordPecker v1.0.0
- **Sealos 平台**: 兼容当前版本
- **最后更新**: 2024年1月

---

**注意**: 在执行任何操作前，请仔细阅读相关文档章节，并在测试环境中验证操作的正确性。