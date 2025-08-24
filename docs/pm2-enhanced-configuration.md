# PM2 增强配置文档

## 概述

本文档描述了 WordPecker 应用的增强 PM2 配置，该配置专为 Sealos devbox 环境中的持续服务部署而优化。

## 主要增强功能

### 1. 生产环境优化配置

#### 后端优化
- **内存优化**: `NODE_OPTIONS: '--max-old-space-size=512 --optimize-for-size'`
- **内存限制**: 500MB 自动重启保护
- **进程模式**: Fork 模式，适合单实例部署

#### 前端优化  
- **内存优化**: `NODE_OPTIONS: '--max-old-space-size=256'`
- **内存限制**: 200MB 自动重启保护
- **构建优化**: 使用预构建的生产版本

### 2. 自动重启策略和内存限制保护

#### 重启策略配置
```javascript
{
  autorestart: true,              // 启用自动重启
  max_memory_restart: '500M',     // 内存限制重启
  min_uptime: '10s',             // 最小运行时间
  max_restarts: 10,              // 最大重启次数
  restart_delay: 4000,           // 重启延迟 4 秒
  exp_backoff_restart_delay: 100 // 指数退避重启延迟
}
```

#### 内存保护机制
- **后端**: 500MB 内存限制，超出自动重启
- **前端**: 200MB 内存限制，超出自动重启
- **监控**: 实时监控内存使用情况

### 3. 详细的日志管理和进程监控参数

#### 日志配置
```javascript
{
  log_file: './logs/pm2-backend-combined.log',
  out_file: './logs/pm2-backend-out.log', 
  error_file: './logs/pm2-backend-error.log',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
  log_type: 'json'  // 结构化日志输出
}
```

#### 日志轮转配置
```javascript
{
  max_size: '10M',                    // 单个日志文件最大大小
  retain: 5,                          // 保留的日志文件数量
  compress: true,                     // 压缩旧日志文件
  dateFormat: 'YYYY-MM-DD_HH-mm-ss', // 时间戳格式
  rotateInterval: '0 0 * * *'         // 每天午夜轮转
}
```

#### 进程监控参数
```javascript
{
  health_check_grace_period: 3000,  // 健康检查宽限期
  kill_timeout: 5000,               // 进程终止超时
  listen_timeout: 3000,             // 监听超时
  monitoring: {
    http: true,                     // 启用HTTP监控
    port: 3000                      // 监控端口
  }
}
```

## 应用配置详情

### wordpecker-backend
- **脚本**: `npm start`
- **工作目录**: `./backend`
- **端口**: 3000
- **内存限制**: 500MB
- **最大重启次数**: 10
- **环境变量**: 生产环境优化
- **日志**: 结构化JSON格式，10MB轮转

### wordpecker-frontend  
- **脚本**: `npm run preview -- --host 0.0.0.0 --port 5173`
- **工作目录**: `./frontend`
- **端口**: 5173
- **内存限制**: 200MB
- **最大重启次数**: 5
- **环境变量**: 生产环境配置
- **日志**: 结构化JSON格式，5MB轮转

### wordpecker-frontend-dev (开发模式)
- **脚本**: `npm run dev -- --host 0.0.0.0 --port 5173`
- **用途**: 开发环境测试
- **内存限制**: 300MB
- **日志**: 开发模式日志

## 部署配置

### 生产环境部署
```javascript
deploy: {
  production: {
    user: 'devbox',
    host: 'localhost', 
    ref: 'origin/main',
    path: '/home/devbox/wordpecker-app',
    'post-deploy': '安装依赖 && 构建应用 && 重载PM2配置'
  }
}
```

### 部署流程
1. 拉取最新代码
2. 安装后端依赖 (`npm ci --production`)
3. 构建前端应用 (`npm run build`)
4. 创建必要目录
5. 重载PM2配置
6. 验证服务状态

## 监控和告警

### 资源监控阈值
- **CPU使用率**: 80% 告警
- **内存使用率**: 80% 告警  
- **重启次数**: 5次告警
- **监控间隔**: 60秒

### 错误处理策略
- **错误日志聚合**: 启用
- **错误日志保留**: 7天
- **自动清理**: 崩溃转储文件

## 使用方法

### 启动所有服务
```bash
pm2 start ecosystem.config.js --env production
```

### 启动特定服务
```bash
pm2 start ecosystem.config.js --only wordpecker-backend
pm2 start ecosystem.config.js --only wordpecker-frontend
```

### 重载配置
```bash
pm2 reload ecosystem.config.js --env production
```

### 查看状态
```bash
pm2 status
pm2 monit
```

### 查看日志
```bash
pm2 logs
pm2 logs wordpecker-backend
pm2 logs wordpecker-frontend
```

## 故障排除

### 常见问题

1. **服务无法启动**
   - 检查依赖是否安装: `npm ci`
   - 检查端口是否被占用: `netstat -tulpn | grep :3000`
   - 查看错误日志: `pm2 logs --err`

2. **内存使用过高**
   - 检查内存使用: `pm2 monit`
   - 调整内存限制: 修改 `max_memory_restart`
   - 重启服务: `pm2 restart all`

3. **日志文件过大**
   - 手动轮转: `pm2 flush`
   - 检查轮转配置: 确认 `max_size` 设置
   - 清理旧日志: `find logs -name "*.log" -mtime +7 -delete`

### 性能优化建议

1. **生产环境**
   - 使用 `--env production` 启动
   - 确保前端已预构建
   - 定期清理日志文件

2. **资源监控**
   - 定期检查 `pm2 monit`
   - 监控系统资源使用
   - 设置告警阈值

3. **日志管理**
   - 启用日志轮转
   - 定期备份重要日志
   - 监控日志文件大小

## 总结

增强的PM2配置提供了以下关键改进：

✅ **生产环境优化**: Node.js 内存优化和性能调优
✅ **自动重启策略**: 智能重启机制和内存保护
✅ **详细日志管理**: 结构化日志、轮转和压缩
✅ **进程监控**: 健康检查和资源监控
✅ **错误处理**: 重试机制和错误聚合
✅ **部署自动化**: 完整的部署流程配置

这些增强功能确保了 WordPecker 应用在 Sealos devbox 环境中的稳定运行和高可用性。