# WordPecker 部署快速参考

## 🚀 快速命令

### 服务管理
```bash
# 查看状态
pm2 status
systemctl status wordpecker

# 重启服务
pm2 reload all --update-env
sudo systemctl restart wordpecker

# 查看日志
pm2 logs --lines 50
journalctl -u wordpecker -f
```

### 健康检查
```bash
# 优化健康检查
./scripts/optimized-health-check.sh --status
./scripts/optimized-health-check.sh --metrics

# 基础健康检查
curl http://localhost:3000/api/health
curl http://localhost:5173
```

### 资源监控
```bash
# 优化资源监控
./scripts/optimized-resource-monitor.sh --metrics
./scripts/optimized-resource-monitor.sh --cleanup

# 系统资源
top
free -h
df -h
```

### 部署操作
```bash
# 完整自动化部署
./scripts/complete-auto-deployment.sh

# 分步部署
./scripts/pre-deploy-check.sh
./scripts/deploy.sh
./scripts/post-deploy-verify.sh

# 回滚
./scripts/deploy.sh --rollback <backup-path>
```

## 📊 监控端点

- **后端健康**: http://localhost:3000/api/health
- **前端页面**: http://localhost:5173
- **管理API**: http://localhost:3000/api/management/status
- **监控仪表板**: http://localhost:3000/api/monitoring/dashboard

## 🔧 故障排除

### 服务无法启动
1. 检查日志: `pm2 logs --err`
2. 验证环境: `./scripts/verify-environment.sh`
3. 重新安装依赖: `cd backend && npm ci`

### 高资源使用
1. 检查资源: `./scripts/optimized-resource-monitor.sh --metrics`
2. 清理缓存: `./scripts/optimized-resource-monitor.sh --cleanup`
3. 重启服务: `pm2 restart all`

### 数据库连接问题
1. 测试连接: `node -e "mongoose.connect(process.env.MONGODB_URL)"`
2. 检查网络: `ping <mongodb-host>`
3. 重启后端: `pm2 restart wordpecker-backend`

## 📁 重要文件路径

```
/home/devbox/wordpecker-app/
├── logs/                           # 日志文件
├── scripts/                        # 管理脚本
├── backend/.env                    # 后端配置
├── frontend/.env                   # 前端配置
├── ecosystem.config.js             # PM2 配置
└── docs/                          # 文档
    ├── deployment-operations-manual.md
    ├── troubleshooting-guide.md
    └── remote-management-api.md
```

## 🚨 紧急联系

- **技术支持**: support@wordpecker.com
- **紧急热线**: +86-xxx-xxxx-xxxx
- **文档**: 查看 `docs/` 目录下的详细文档

---
**快速参考版本**: 1.0.0  
**生成时间**: $(date)