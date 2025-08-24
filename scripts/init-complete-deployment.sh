#!/bin/bash

# WordPecker 完整部署初始化脚本
# 一键完成环境初始化、Systemd 配置、Cron 任务设置和环境验证

set -e

# 配置变量
PROJECT_DIR="/home/devbox/wordpecker-app"
SCRIPT_DIR="$PROJECT_DIR/scripts"
LOG_FILE="./logs/complete-deployment-init.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date): [INFO] $1" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    echo "$(date): [SUCCESS] $1" >> "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    echo "$(date): [WARNING] $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    echo "$(date): [ERROR] $1" >> "$LOG_FILE"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
    echo "$(date): [STEP] $1" >> "$LOG_FILE"
}

# 显示欢迎信息
show_welcome() {
    clear
    echo "============================================================"
    echo "               WordPecker 完整部署初始化"
    echo "============================================================"
    echo
    echo "此脚本将自动完成以下操作："
    echo "1. 🔧 环境初始化和依赖安装"
    echo "2. ⚙️  Systemd 服务配置"
    echo "3. ⏰ 定时任务设置"
    echo "4. ✅ 部署环境验证"
    echo
    echo "预计耗时: 5-10 分钟"
    echo "============================================================"
    echo
    
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "操作已取消"
        exit 0
    fi
}

# 检查脚本权限
check_script_permissions() {
    log_info "检查脚本权限..."
    
    # 设置所有脚本为可执行
    find "$SCRIPT_DIR" -name "*.sh" -type f -exec chmod +x {} \; 2>/dev/null || true
    
    log_success "脚本权限设置完成"
}

# 步骤1: 环境初始化
step1_environment_init() {
    log_step "步骤 1/4: 环境初始化和依赖安装"
    echo "============================================================"
    
    if [ -f "$SCRIPT_DIR/init-deployment-environment.sh" ]; then
        log_info "运行环境初始化脚本..."
        bash "$SCRIPT_DIR/init-deployment-environment.sh"
        log_success "环境初始化完成"
    else
        log_error "环境初始化脚本不存在: $SCRIPT_DIR/init-deployment-environment.sh"
        exit 1
    fi
    
    echo
}

# 步骤2: Systemd 服务配置
step2_systemd_setup() {
    log_step "步骤 2/4: Systemd 服务配置"
    echo "============================================================"
    
    if [ -f "$SCRIPT_DIR/setup-systemd-service.sh" ]; then
        log_info "运行 Systemd 服务配置脚本..."
        bash "$SCRIPT_DIR/setup-systemd-service.sh"
        log_success "Systemd 服务配置完成"
    else
        log_error "Systemd 配置脚本不存在: $SCRIPT_DIR/setup-systemd-service.sh"
        exit 1
    fi
    
    echo
}

# 步骤3: 定时任务设置
step3_cron_setup() {
    log_step "步骤 3/4: 定时任务设置"
    echo "============================================================"
    
    if [ -f "$SCRIPT_DIR/setup-cron-tasks.sh" ]; then
        log_info "运行定时任务设置脚本..."
        bash "$SCRIPT_DIR/setup-cron-tasks.sh"
        log_success "定时任务设置完成"
    else
        log_error "定时任务设置脚本不存在: $SCRIPT_DIR/setup-cron-tasks.sh"
        exit 1
    fi
    
    echo
}

# 步骤4: 环境验证
step4_environment_verification() {
    log_step "步骤 4/4: 部署环境验证"
    echo "============================================================"
    
    if [ -f "$SCRIPT_DIR/verify-deployment-environment.sh" ]; then
        log_info "运行环境验证脚本..."
        if bash "$SCRIPT_DIR/verify-deployment-environment.sh"; then
            log_success "环境验证通过"
            return 0
        else
            log_warning "环境验证发现问题，请查看详细报告"
            return 1
        fi
    else
        log_error "环境验证脚本不存在: $SCRIPT_DIR/verify-deployment-environment.sh"
        exit 1
    fi
}

# 显示完成信息
show_completion_info() {
    local verification_passed=$1
    
    echo
    echo "============================================================"
    echo "               初始化完成"
    echo "============================================================"
    
    if [ "$verification_passed" -eq 0 ]; then
        echo -e "${GREEN}✅ 所有步骤已成功完成！${NC}"
        echo
        echo "🎉 WordPecker 部署环境已准备就绪"
        echo
        echo "下一步操作："
        echo "1. 编辑环境变量: nano $PROJECT_DIR/.env"
        echo "2. 运行部署脚本: $SCRIPT_DIR/deploy.sh"
        echo "3. 启动服务: $SCRIPT_DIR/service-start.sh"
        echo "4. 查看服务状态: $SCRIPT_DIR/service-status.sh"
    else
        echo -e "${YELLOW}⚠️  初始化完成，但环境验证发现问题${NC}"
        echo
        echo "请执行以下操作："
        echo "1. 查看验证报告: cat $PROJECT_DIR/logs/environment-verification-*.log"
        echo "2. 修复发现的问题"
        echo "3. 重新运行验证: $SCRIPT_DIR/verify-deployment-environment.sh"
        echo "4. 问题修复后运行部署: $SCRIPT_DIR/deploy.sh"
    fi
    
    echo
    echo "📚 有用的命令："
    echo "• 查看日志: tail -f $PROJECT_DIR/logs/*.log"
    echo "• PM2 状态: pm2 status"
    echo "• 服务状态: sudo systemctl status wordpecker"
    echo "• 定时任务: crontab -l"
    echo
    echo "📖 文档位置："
    echo "• 部署指南: $PROJECT_DIR/docs/"
    echo "• 脚本说明: $PROJECT_DIR/scripts/README.md"
    echo
    echo "============================================================"
}

# 创建快速参考文档
create_quick_reference() {
    log_info "创建快速参考文档..."
    
    cat > "$PROJECT_DIR/DEPLOYMENT_QUICK_REFERENCE.md" << 'EOF'
# WordPecker 部署快速参考

## 🚀 快速启动

```bash
# 启动服务
./scripts/service-start.sh

# 查看状态
./scripts/service-status.sh

# 重启服务
./scripts/service-restart.sh

# 停止服务
./scripts/service-stop.sh
```

## 📊 监控命令

```bash
# PM2 进程状态
pm2 status
pm2 logs

# 系统服务状态
sudo systemctl status wordpecker

# 健康检查
curl http://localhost:3000/api/health
curl http://localhost:5173
```

## 🔧 维护操作

```bash
# 部署更新
./scripts/deploy.sh

# 环境验证
./scripts/verify-deployment-environment.sh

# 日志清理
./scripts/log-cleanup.sh

# 资源监控
./scripts/resource-monitor.sh
```

## 📁 重要文件位置

- 环境变量: `.env`
- PM2 配置: `ecosystem.config.js`
- 服务配置: `/etc/systemd/system/wordpecker.service`
- 日志目录: `./logs/`
- 脚本目录: `./scripts/`

## 🆘 故障排除

1. **服务无法启动**
   ```bash
   # 检查日志
   sudo journalctl -u wordpecker -f
   pm2 logs
   
   # 检查端口占用
   netstat -tuln | grep -E '3000|5173'
   ```

2. **数据库连接问题**
   ```bash
   # 测试数据库连接
   node -e "require('mongoose').connect(process.env.MONGODB_URL).then(() => console.log('OK')).catch(console.error)"
   ```

3. **权限问题**
   ```bash
   # 修复权限
   sudo chown -R devbox:devbox /home/devbox/wordpecker-app
   chmod +x ./scripts/*.sh
   ```

## 📞 支持

- 查看详细日志: `./logs/`
- 运行环境验证: `./scripts/verify-deployment-environment.sh`
- 检查系统资源: `./scripts/resource-monitor.sh`
EOF
    
    log_success "快速参考文档已创建: $PROJECT_DIR/DEPLOYMENT_QUICK_REFERENCE.md"
}

# 主初始化流程
main() {
    # 创建日志目录
    mkdir -p ./logs
    
    # 显示欢迎信息
    show_welcome
    
    log_info "开始 WordPecker 完整部署初始化..."
    
    # 检查脚本权限
    check_script_permissions
    
    # 执行初始化步骤
    step1_environment_init
    step2_systemd_setup
    step3_cron_setup
    
    # 环境验证
    local verification_result=0
    step4_environment_verification || verification_result=$?
    
    # 创建快速参考
    create_quick_reference
    
    # 显示完成信息
    show_completion_info $verification_result
    
    log_success "WordPecker 完整部署初始化完成"
    
    # 返回验证结果
    exit $verification_result
}

# 错误处理
trap 'log_error "部署初始化过程中发生错误，请查看日志: $LOG_FILE"' ERR

# 执行主函数
main "$@"