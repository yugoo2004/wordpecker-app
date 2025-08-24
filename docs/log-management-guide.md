# WordPecker 日志管理系统指南

## 概述

WordPecker 应用实现了完整的日志聚合和管理系统，包括结构化日志记录、自动轮转、监控告警和清理策略。

## 日志架构

### 日志分类

1. **综合日志** (`combined-*.log`)
   - 记录所有级别的日志信息
   - 使用结构化JSON格式
   - 每日轮转，保留14天

2. **错误日志** (`error-*.log`)
   - 仅记录错误级别及以上的日志
   - 用于快速定位问题
   - 每日轮转，保留14天

3. **API日志** (`api-*.log`)
   - 记录所有API请求和响应
   - 包含请求ID、响应时间等性能指标
   - 每日轮转，保留7天

4. **数据库日志** (`database-*.log`)
   - 记录数据库连接、查询和错误
   - 包含查询性能监控
   - 每日轮转，保留7天

5. **性能日志** (`performance-*.log`)
   - 记录慢请求和性能指标
   - 用于性能分析和优化
   - 每日轮转，保留3天

6. **安全日志** (`security-*.log`)
   - 记录认证、授权和安全事件
   - 保留时间较长（30天）
   - 用于安全审计

### 日志格式

#### 结构化日志格式
```json
{
  "timestamp": "2025-08-20T08:46:05.123Z",
  "level": "info",
  "message": "Request completed",
  "service": "wordpecker-backend",
  "pid": 12345,
  "hostname": "wordpecker",
  "requestId": "uuid-string",
  "method": "GET",
  "url": "/api/health",
  "statusCode": 200,
  "responseTime": 45,
  "metadata": {
    "userId": "user123",
    "ip": "192.168.1.100"
  }
}
```

#### 人类可读格式（开发环境）
```
2025-08-20 08:46:05 [INFO] [wordpecker-backend]: Request completed
  Meta: {
    "requestId": "uuid-string",
    "method": "GET",
    "url": "/api/health",
    "responseTime": 45
  }
```

## 日志配置

### Winston 配置

日志系统基于 Winston 框架，配置文件位于 `backend/src/config/logger.ts`：

- **日志级别**: debug, info, warn, error
- **文件大小限制**: 20MB
- **保留时间**: 14天（可配置）
- **压缩**: 自动压缩旧日志文件
- **符号链接**: 创建指向当前日志的符号链接

### 环境变量

```bash
# 日志级别配置
LOG_LEVEL=info              # debug, info, warn, error

# 控制台日志（生产环境）
CONSOLE_LOG=false           # true 启用生产环境控制台输出

# 测试环境静默
NODE_ENV=test               # 测试环境下禁用日志输出
```

## 日志中间件

### 请求日志中间件

自动记录所有HTTP请求：

```typescript
import { requestLogger, errorLogger, logContextMiddleware } from './middleware/loggerMiddleware';

app.use(requestLogger);      // 记录请求开始和完成
app.use(logContextMiddleware); // 添加请求上下文
app.use(errorLogger);        // 记录错误信息
```

### 数据库日志

```typescript
import { dbLogger } from './middleware/loggerMiddleware';

// 记录查询
dbLogger.logQuery('find', 'users', { email: 'user@example.com' }, 25);

// 记录连接事件
dbLogger.logConnection('connected', { host: 'localhost', port: 27017 });

// 记录错误
dbLogger.logError('insert', error, { collection: 'users' });
```

### 外部API日志

```typescript
import { apiCallLogger } from './middleware/loggerMiddleware';

// 记录API请求
apiCallLogger.logRequest('openai', '/v1/chat/completions', 'POST', requestData);

// 记录API响应
apiCallLogger.logResponse('openai', '/v1/chat/completions', 200, 1500);
```

### 安全日志

```typescript
import { securityLogger } from './middleware/loggerMiddleware';

// 记录认证尝试
securityLogger.logAuthAttempt(true, 'user123', '192.168.1.100', 'Mozilla/5.0...');

// 记录可疑活动
securityLogger.logSuspiciousActivity('multiple_failed_logins', { attempts: 5 }, '192.168.1.100');

// 记录限流事件
securityLogger.logRateLimitExceeded('192.168.1.100', '/api/chat', 100);
```

## 日志管理脚本

### 日志管理器 (`scripts/log-manager.sh`)

主要的日志管理工具，支持以下操作：

```bash
# 清理旧日志文件
./scripts/log-manager.sh cleanup

# 压缩大日志文件
./scripts/log-manager.sh compress

# 检查日志目录大小
./scripts/log-manager.sh check-size

# 生成统计报告
./scripts/log-manager.sh stats

# 清理PM2日志
./scripts/log-manager.sh pm2

# 监控错误率
./scripts/log-manager.sh monitor

# 执行所有任务
./scripts/log-manager.sh all
```

### 日志监控器 (`scripts/log-monitor.sh`)

实时监控日志文件并发出告警：

```bash
# 单次监控检查
./scripts/log-monitor.sh once

# 守护进程模式（持续监控）
./scripts/log-monitor.sh daemon
```

监控功能：
- 错误率监控（每分钟错误数阈值）
- 关键字监控（CRITICAL, FATAL等）
- 性能监控（慢请求检测）
- 系统资源监控（CPU、内存、磁盘）
- 进程状态监控

## 系统集成

### Logrotate 配置

设置系统级日志轮转：

```bash
# 安装logrotate配置（需要root权限）
sudo ./scripts/setup-logrotate.sh
```

配置特点：
- 每日轮转
- 压缩旧文件
- 保留14天
- 自动重新加载应用日志

### Cron 定时任务

设置自动化日志管理：

```bash
# 设置定时任务
./scripts/setup-log-cron.sh
```

定时任务包括：
- 每小时清理日志 (xx:05)
- 每6小时检查大小 (0:10, 6:10, 12:10, 18:10)
- 每天完整管理 (2:00)
- 每天清理PM2日志 (3:00)
- 每周生成报告 (周日 4:00)
- 每5分钟监控检查

## 监控和告警

### 告警级别

1. **INFO**: 正常信息记录
2. **WARN**: 警告信息，需要关注
3. **HIGH**: 高优先级问题，需要及时处理
4. **CRITICAL**: 严重问题，需要立即处理

### 告警触发条件

- 错误率超过阈值（每分钟>10个错误）
- 发现关键错误关键字
- 响应时间过长（>2秒）
- 数据库查询过慢（>100ms）
- 磁盘空间不足（>80%）
- 内存使用过高（>80%）
- 服务进程异常

### 告警输出

告警信息会记录到：
- 系统日志 (`/var/log/syslog`)
- 告警日志文件 (`logs/log-alerts.log`)
- 监控日志文件 (`logs/log-monitor.log`)

## 日志查看和分析

### 实时监控

```bash
# 监控综合日志
tail -f logs/combined-current.log

# 监控错误日志
tail -f logs/error-current.log

# 监控API日志
tail -f logs/api-current.log

# 监控性能日志
tail -f logs/performance-current.log
```

### 日志搜索

```bash
# 搜索特定错误
grep "ERROR" logs/combined-current.log

# 搜索特定请求ID
grep "request-id-123" logs/api-current.log

# 搜索慢请求
grep "responseTime.*[0-9]{4,}" logs/performance-current.log

# 搜索特定时间段
grep "2025-08-20 08:" logs/combined-current.log
```

### 日志分析工具

```bash
# 统计错误数量
grep -c "ERROR" logs/error-current.log

# 分析响应时间分布
grep "responseTime" logs/api-current.log | jq '.responseTime' | sort -n

# 统计API端点访问量
grep "Request completed" logs/api-current.log | jq '.url' | sort | uniq -c

# 分析错误类型分布
grep "ERROR" logs/combined-current.log | jq '.error.name' | sort | uniq -c
```

## 性能优化

### 日志性能配置

1. **异步写入**: Winston 使用异步写入提高性能
2. **文件轮转**: 避免单个文件过大影响性能
3. **压缩存储**: 自动压缩旧日志节省空间
4. **分类存储**: 不同类型日志分别存储，提高查询效率

### 存储优化

1. **大小限制**: 单个文件最大20MB
2. **保留策略**: 根据重要性设置不同保留时间
3. **自动清理**: 定期清理过期日志文件
4. **压缩策略**: 自动压缩非当前日志文件

## 故障排除

### 常见问题

1. **日志文件过大**
   ```bash
   # 手动清理
   ./scripts/log-manager.sh cleanup
   
   # 检查磁盘空间
   df -h
   ```

2. **日志写入失败**
   ```bash
   # 检查目录权限
   ls -la logs/
   
   # 检查磁盘空间
   df -h logs/
   ```

3. **监控告警过多**
   ```bash
   # 调整监控阈值
   vim scripts/log-monitor.sh
   
   # 检查应用状态
   pm2 status
   ```

4. **日志格式异常**
   ```bash
   # 检查Winston配置
   node -e "console.log(require('./backend/dist/config/logger'))"
   
   # 测试日志系统
   ./scripts/test-log-system.sh
   ```

### 调试模式

启用详细日志记录：

```bash
# 设置调试级别
export LOG_LEVEL=debug

# 启动应用
npm start
```

## 最佳实践

### 日志记录原则

1. **结构化记录**: 使用JSON格式便于解析
2. **上下文信息**: 包含请求ID、用户ID等关联信息
3. **敏感信息**: 自动过滤密码、令牌等敏感数据
4. **性能考虑**: 避免在高频路径记录过多日志
5. **错误详情**: 记录完整的错误堆栈和上下文

### 监控策略

1. **主动监控**: 定期检查关键指标
2. **告警分级**: 根据严重程度设置不同告警
3. **趋势分析**: 关注错误率和性能趋势
4. **容量规划**: 监控日志存储使用情况

### 维护建议

1. **定期检查**: 每周检查日志系统状态
2. **配置调优**: 根据实际使用情况调整配置
3. **存储管理**: 定期清理和归档旧日志
4. **性能监控**: 关注日志系统对应用性能的影响

## 扩展功能

### 日志聚合

可以集成外部日志聚合系统：

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Fluentd** + **Grafana**
- **Prometheus** + **Grafana**

### 告警集成

可以集成外部告警系统：

- **邮件通知**
- **Slack 通知**
- **钉钉通知**
- **短信告警**

### 日志分析

可以添加更多分析功能：

- **用户行为分析**
- **API性能分析**
- **错误趋势分析**
- **安全事件分析**