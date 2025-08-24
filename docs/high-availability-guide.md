# WordPecker 高可用性管理指南

## 概述

WordPecker 高可用性管理系统提供了完整的负载均衡、故障切换和自动扩缩容功能，确保应用在云端环境中的持续稳定运行。

## 核心组件

### 1. LoadBalancer (负载均衡器)
- **功能**: 自动监控系统负载并执行扩缩容操作
- **位置**: `backend/src/services/loadBalancer.ts`
- **特性**:
  - CPU和内存使用率监控
  - 自动扩容/缩容决策
  - 冷却时间管理
  - 实例健康状态检查

### 2. FailoverManager (故障切换管理器)
- **功能**: 监控服务健康状态并执行故障切换
- **位置**: `backend/src/services/failoverManager.ts`
- **特性**:
  - 定期健康检查
  - 自动服务重启
  - 故障恢复验证
  - 重启次数限制

### 3. HighAvailabilityManager (高可用性管理器)
- **功能**: 整合负载均衡和故障切换功能
- **位置**: `backend/src/services/highAvailabilityManager.ts`
- **特性**:
  - 统一管理接口
  - 事件监听和处理
  - 状态聚合和报告
  - 手动操作支持

## API 端点

### 管理操作
```bash
# 启动高可用性管理
POST /api/ha/start

# 停止高可用性管理
POST /api/ha/stop

# 获取完整状态
GET /api/ha/status

# 执行健康检查
GET /api/ha/health

# 获取性能指标
GET /api/ha/metrics
```

### 扩缩容操作
```bash
# 手动扩容
POST /api/ha/scale-up
Content-Type: application/json
{
  "targetInstances": 3
}

# 手动缩容
POST /api/ha/scale-down
Content-Type: application/json
{
  "targetInstances": 1
}
```

### 故障切换操作
```bash
# 手动触发故障切换
POST /api/ha/failover
Content-Type: application/json
{
  "serviceName": "wordpecker-backend",
  "reason": "Manual maintenance"
}

# 重置服务故障状态
POST /api/ha/reset-failure/wordpecker-backend
```

### 组件状态查询
```bash
# 获取负载均衡器状态
GET /api/ha/load-balancer

# 获取故障切换管理器状态
GET /api/ha/failover-manager
```

## 配置文件

### 1. 标准PM2配置 (`ecosystem.config.js`)
- 适用于开发和小规模部署
- 支持基本的自动重启和监控

### 2. 集群模式配置 (`ecosystem.cluster.config.js`)
- 适用于生产环境和高负载场景
- 启用PM2集群模式
- 支持多实例负载均衡
- 包含完整的扩缩容配置

## 部署和启动

### 1. 标准部署
```bash
# 使用标准配置启动
pm2 start ecosystem.config.js --env production

# 启动高可用性管理
./scripts/start-high-availability.sh
```

### 2. 集群模式部署
```bash
# 使用集群配置启动
pm2 start ecosystem.cluster.config.js --env production

# 启动高可用性管理
./scripts/start-high-availability.sh
```

### 3. 自动化部署
```bash
# 执行完整的自动化部署
./scripts/deploy.sh

# 高可用性管理会自动启动
```

## 监控和测试

### 1. 功能测试
```bash
# 执行完整的高可用性功能测试
./scripts/test-high-availability.sh
```

### 2. 健康检查
```bash
# 手动执行健康检查
./scripts/health-check.sh

# 查看当前状态
./scripts/health-check.sh --status

# 详细模式
./scripts/health-check.sh --verbose
```

### 3. 状态监控
```bash
# 查看PM2进程状态
pm2 status

# 查看PM2日志
pm2 logs

# 查看高可用性状态
curl http://localhost:3000/api/ha/status | jq
```

## 配置参数

### 负载均衡器配置
```javascript
const config = {
  CPU_THRESHOLD_HIGH: 80,      // CPU扩容阈值
  CPU_THRESHOLD_LOW: 30,       // CPU缩容阈值
  MEMORY_THRESHOLD_HIGH: 80,   // 内存扩容阈值
  MEMORY_THRESHOLD_LOW: 30,    // 内存缩容阈值
  MAX_INSTANCES: 4,            // 最大实例数
  MIN_INSTANCES: 1,            // 最小实例数
  SCALE_COOLDOWN: 60000        // 扩缩容冷却时间(ms)
};
```

### 故障切换配置
```javascript
const config = {
  HEALTH_CHECK_INTERVAL: 30000,    // 健康检查间隔(ms)
  MAX_RESTART_ATTEMPTS: 3,         // 最大重启尝试次数
  RESTART_COOLDOWN: 60000,         // 重启冷却时间(ms)
  HEALTH_CHECK_TIMEOUT: 5000       // 健康检查超时(ms)
};
```

## 故障排除

### 1. 高可用性管理未启动
```bash
# 检查后端服务状态
curl http://localhost:3000/api/health

# 手动启动高可用性管理
curl -X POST http://localhost:3000/api/ha/start

# 查看启动日志
tail -f logs/ha-startup.log
```

### 2. 扩缩容不工作
```bash
# 检查负载均衡器状态
curl http://localhost:3000/api/ha/load-balancer | jq

# 查看系统资源使用情况
curl http://localhost:3000/api/ha/metrics | jq

# 手动触发扩容测试
curl -X POST http://localhost:3000/api/ha/scale-up \
  -H "Content-Type: application/json" \
  -d '{"targetInstances": 2}'
```

### 3. 故障切换不工作
```bash
# 检查故障切换管理器状态
curl http://localhost:3000/api/ha/failover-manager | jq

# 手动触发故障切换测试
curl -X POST http://localhost:3000/api/ha/failover \
  -H "Content-Type: application/json" \
  -d '{"serviceName": "wordpecker-backend", "reason": "Test"}'

# 查看健康检查日志
tail -f logs/health-check.log
```

### 4. 服务重启循环
```bash
# 重置服务故障状态
curl -X POST http://localhost:3000/api/ha/reset-failure/wordpecker-backend

# 检查PM2进程状态
pm2 status

# 查看PM2日志
pm2 logs wordpecker-backend --lines 50
```

## 最佳实践

### 1. 监控设置
- 设置定期健康检查 (每5分钟)
- 配置资源使用率告警
- 启用日志轮转和清理

### 2. 扩缩容策略
- 根据实际负载调整阈值
- 设置合适的冷却时间
- 限制最大实例数以控制成本

### 3. 故障恢复
- 配置合理的重试次数
- 设置故障恢复验证
- 建立故障通知机制

### 4. 性能优化
- 使用集群模式提高并发能力
- 优化内存使用和垃圾回收
- 定期清理日志和缓存文件

## 日志文件

### 高可用性相关日志
- `logs/ha-startup.log` - 高可用性管理启动日志
- `logs/ha-test.log` - 功能测试日志
- `logs/ha-health.log` - 健康检查日志
- `logs/health-check.log` - 系统健康检查日志

### PM2日志
- `logs/cluster-backend-*.log` - 集群模式后端日志
- `logs/cluster-frontend-*.log` - 集群模式前端日志
- `logs/pm2-*.log` - 标准模式PM2日志

## 性能指标

### 系统指标
- CPU使用率
- 内存使用率
- 磁盘使用率
- 网络连接数

### 应用指标
- 响应时间
- 错误率
- 请求吞吐量
- 实例健康状态

### 高可用性指标
- 服务可用性 (%)
- 故障恢复时间 (MTTR)
- 扩缩容响应时间
- 故障切换成功率