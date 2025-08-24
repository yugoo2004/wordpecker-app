#!/bin/bash

# WordPecker 部署环境验证脚本
# 用于验证部署环境的完整性和配置正确性

set -e

# 配置变量
PROJECT_DIR="/home/devbox/wordpecker-app"
SERVICE_USER="devbox"
SERVICE_NAME="wordpecker"
LOG_FILE="./logs/environment-verification.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 验证结果统计
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    echo "$(date): [INFO] $1" >> "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[✓ PASS]${NC} $1"
    echo "$(date): [PASS] $1" >> "$LOG_FILE"
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
}

log_warning() {
    echo -e "${YELLOW}[⚠ WARN]${NC} $1"
    echo "$(date): [WARN] $1" >> "$LOG_FILE"
    WARNING_CHECKS=$((WARNING_CHECKS + 1))
}

log_error() {
    echo -e "${RED}[✗ FAIL]${NC} $1"
    echo "$(date): [FAIL] $1" >> "$LOG_FILE"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
}

# 增加检查计数
increment_check() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

# 验证系统要求
verify_system_requirements() {
    echo "=========================================="
    echo "1. 系统要求验证"
    echo "=========================================="
    
    # 检查操作系统
    increment_check
    if grep -q "Ubuntu" /etc/os-release; then
        local ubuntu_version=$(grep VERSION_ID /etc/os-release | cut -d'"' -f2)
        log_success "操作系统: Ubuntu $ubuntu_version"
    else
        log_warning "操作系统不是 Ubuntu，可能存在兼容性问题"
    fi
    
    # 检查内存
    increment_check
    local memory_gb=$(free -g | awk 'NR==2{printf "%.1f", $2}')
    if (( $(echo "$memory_gb >= 2" | bc -l) )); then
        log_success "系统内存: ${memory_gb}GB (≥2GB)"
    else
        log_warning "系统内存: ${memory_gb}GB (<2GB，可能影响性能)"
    fi
    
    # 检查磁盘空间
    increment_check
    local disk_free=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    local disk_usage=$(df -h / | awk 'NR==2{print $5}')
    if [ "$disk_free" -gt 5 ]; then
        log_success "磁盘空间: ${disk_free}GB 可用，使用率 $disk_usage"
    else
        log_error "磁盘空间不足: 仅 ${disk_free}GB 可用"
    fi
    
    # 检查 CPU 核心数
    increment_check
    local cpu_cores=$(nproc)
    if [ "$cpu_cores" -ge 2 ]; then
        log_success "CPU 核心数: $cpu_cores"
    else
        log_warning "CPU 核心数: $cpu_cores (建议≥2)"
    fi
}

# 验证软件依赖
verify_software_dependencies() {
    echo
    echo "=========================================="
    echo "2. 软件依赖验证"
    echo "=========================================="
    
    # 检查 Node.js
    increment_check
    if command -v node &> /dev/null; then
        local node_version=$(node -v)
        local node_major=$(echo "$node_version" | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_major" -ge 16 ]; then
            log_success "Node.js: $node_version (≥16.0.0)"
        else
            log_error "Node.js 版本过低: $node_version (<16.0.0)"
        fi
    else
        log_error "Node.js 未安装"
    fi
    
    # 检查 npm
    increment_check
    if command -v npm &> /dev/null; then
        local npm_version=$(npm -v)
        log_success "npm: $npm_version"
    else
        log_error "npm 未安装"
    fi
    
    # 检查 PM2
    increment_check
    if command -v pm2 &> /dev/null; then
        local pm2_version=$(pm2 -v)
        log_success "PM2: $pm2_version"
    else
        log_error "PM2 未安装"
    fi
    
    # 检查基础工具
    local tools=("curl" "wget" "git" "jq" "bc")
    for tool in "${tools[@]}"; do
        increment_check
        if command -v "$tool" &> /dev/null; then
            log_success "$tool 已安装"
        else
            log_error "$tool 未安装"
        fi
    done
}

# 验证项目结构
verify_project_structure() {
    echo
    echo "=========================================="
    echo "3. 项目结构验证"
    echo "=========================================="
    
    # 检查项目根目录
    increment_check
    if [ -d "$PROJECT_DIR" ]; then
        log_success "项目目录存在: $PROJECT_DIR"
    else
        log_error "项目目录不存在: $PROJECT_DIR"
        return 1
    fi
    
    cd "$PROJECT_DIR"
    
    # 检查必要目录
    local required_dirs=("backend" "frontend" "scripts" "logs")
    for dir in "${required_dirs[@]}"; do
        increment_check
        if [ -d "$dir" ]; then
            log_success "目录存在: $dir"
        else
            log_error "目录缺失: $dir"
        fi
    done
    
    # 检查配置文件
    local config_files=("ecosystem.config.js" "package.json")
    for file in "${config_files[@]}"; do
        increment_check
        if [ -f "$file" ]; then
            log_success "配置文件存在: $file"
        else
            log_warning "配置文件缺失: $file"
        fi
    done
    
    # 检查环境变量文件
    increment_check
    if [ -f ".env" ]; then
        log_success "环境变量文件存在: .env"
    else
        log_warning "环境变量文件缺失: .env"
    fi
}

# 验证项目依赖
verify_project_dependencies() {
    echo
    echo "=========================================="
    echo "4. 项目依赖验证"
    echo "=========================================="
    
    cd "$PROJECT_DIR"
    
    # 检查后端依赖
    increment_check
    if [ -d "backend/node_modules" ]; then
        log_success "后端依赖已安装"
        
        # 检查关键依赖
        local backend_deps=("express" "mongoose" "winston")
        for dep in "${backend_deps[@]}"; do
            increment_check
            if [ -d "backend/node_modules/$dep" ]; then
                log_success "后端依赖: $dep"
            else
                log_warning "后端依赖缺失: $dep"
            fi
        done
    else
        log_error "后端依赖未安装"
    fi
    
    # 检查前端依赖和构建
    increment_check
    if [ -d "frontend/node_modules" ]; then
        log_success "前端依赖已安装"
    else
        log_error "前端依赖未安装"
    fi
    
    increment_check
    if [ -d "frontend/dist" ]; then
        log_success "前端已构建"
    else
        log_warning "前端未构建"
    fi
}

# 验证环境变量配置
verify_environment_configuration() {
    echo
    echo "=========================================="
    echo "5. 环境变量配置验证"
    echo "=========================================="
    
    cd "$PROJECT_DIR"
    
    if [ -f ".env" ]; then
        # 检查必需的环境变量
        local required_vars=("NODE_ENV" "MONGODB_URL" "OPENAI_API_KEY")
        for var in "${required_vars[@]}"; do
            increment_check
            if grep -q "^${var}=" .env && ! grep -q "^${var}=.*your_.*_here" .env; then
                log_success "环境变量已配置: $var"
            else
                log_error "环境变量未配置或使用默认值: $var"
            fi
        done
        
        # 检查可选的环境变量
        local optional_vars=("ELEVENLABS_API_KEY" "PEXELS_API_KEY")
        for var in "${optional_vars[@]}"; do
            increment_check
            if grep -q "^${var}=" .env && ! grep -q "^${var}=.*your_.*_here" .env; then
                log_success "可选环境变量已配置: $var"
            else
                log_warning "可选环境变量未配置: $var"
            fi
        done
    else
        log_error "环境变量文件不存在"
    fi
}

# 验证 Systemd 服务配置
verify_systemd_service() {
    echo
    echo "=========================================="
    echo "6. Systemd 服务配置验证"
    echo "=========================================="
    
    # 检查服务文件
    increment_check
    if [ -f "/etc/systemd/system/${SERVICE_NAME}.service" ]; then
        log_success "Systemd 服务文件存在"
        
        # 检查服务状态
        increment_check
        local service_enabled=$(sudo systemctl is-enabled ${SERVICE_NAME}.service 2>/dev/null || echo "disabled")
        if [ "$service_enabled" = "enabled" ]; then
            log_success "服务已启用"
        else
            log_warning "服务未启用"
        fi
        
        # 检查服务配置语法
        increment_check
        if sudo systemctl cat ${SERVICE_NAME}.service > /dev/null 2>&1; then
            log_success "服务配置语法正确"
        else
            log_error "服务配置语法错误"
        fi
    else
        log_error "Systemd 服务文件不存在"
    fi
}

# 验证定时任务配置
verify_cron_configuration() {
    echo
    echo "=========================================="
    echo "7. 定时任务配置验证"
    echo "=========================================="
    
    # 检查 crontab 配置
    increment_check
    if crontab -l 2>/dev/null | grep -q "wordpecker\|health-check"; then
        log_success "定时任务已配置"
        
        # 显示相关的定时任务
        echo "已配置的定时任务："
        crontab -l 2>/dev/null | grep -E "wordpecker|health-check|resource-monitor|log-cleanup" | while read -r line; do
            echo "  $line"
        done
    else
        log_warning "定时任务未配置"
    fi
    
    # 检查定时任务脚本
    local cron_scripts=("health-check.sh" "resource-monitor.sh" "log-cleanup.sh")
    for script in "${cron_scripts[@]}"; do
        increment_check
        if [ -f "$PROJECT_DIR/scripts/$script" ] && [ -x "$PROJECT_DIR/scripts/$script" ]; then
            log_success "定时任务脚本: $script"
        else
            log_warning "定时任务脚本缺失或不可执行: $script"
        fi
    done
}

# 验证网络连接
verify_network_connectivity() {
    echo
    echo "=========================================="
    echo "8. 网络连接验证"
    echo "=========================================="
    
    # 检查基本网络连接
    increment_check
    if ping -c 1 google.com > /dev/null 2>&1; then
        log_success "互联网连接正常"
    else
        log_error "互联网连接异常"
    fi
    
    # 检查 API 端点连接
    local api_endpoints=("api.openai.com" "api.elevenlabs.io" "api.pexels.com")
    for endpoint in "${api_endpoints[@]}"; do
        increment_check
        if curl -s --connect-timeout 5 "https://$endpoint" > /dev/null 2>&1; then
            log_success "API 端点可达: $endpoint"
        else
            log_warning "API 端点不可达: $endpoint"
        fi
    done
}

# 验证数据库连接
verify_database_connection() {
    echo
    echo "=========================================="
    echo "9. 数据库连接验证"
    echo "=========================================="
    
    cd "$PROJECT_DIR"
    
    # 检查环境变量中的数据库 URL
    increment_check
    if [ -f ".env" ] && grep -q "^MONGODB_URL=" .env; then
        local mongodb_url=$(grep "^MONGODB_URL=" .env | cut -d'=' -f2-)
        
        # 尝试连接数据库
        if command -v node &> /dev/null; then
            local connection_test=$(node -e "
                const mongoose = require('mongoose');
                mongoose.connect('$mongodb_url', { 
                    serverSelectionTimeoutMS: 5000,
                    connectTimeoutMS: 5000 
                })
                .then(() => {
                    console.log('SUCCESS');
                    process.exit(0);
                })
                .catch(err => {
                    console.log('FAILED');
                    process.exit(1);
                });
            " 2>/dev/null || echo "FAILED")
            
            if [ "$connection_test" = "SUCCESS" ]; then
                log_success "数据库连接正常"
            else
                log_error "数据库连接失败"
            fi
        else
            log_warning "无法测试数据库连接（Node.js 不可用）"
        fi
    else
        log_error "数据库 URL 未配置"
    fi
}

# 验证服务端口
verify_service_ports() {
    echo
    echo "=========================================="
    echo "10. 服务端口验证"
    echo "=========================================="
    
    # 检查端口占用情况
    local ports=("3000" "5173")
    local port_names=("后端服务" "前端服务")
    
    for i in "${!ports[@]}"; do
        local port="${ports[$i]}"
        local name="${port_names[$i]}"
        
        increment_check
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            log_warning "$name 端口 $port 已被占用"
        else
            log_success "$name 端口 $port 可用"
        fi
    done
}

# 生成验证报告
generate_verification_report() {
    echo
    echo "=========================================="
    echo "验证报告"
    echo "=========================================="
    
    local report_file="$PROJECT_DIR/logs/environment-verification-$(date +%Y%m%d-%H%M%S).log"
    
    cat > "$report_file" << EOF
WordPecker 部署环境验证报告
==========================
验证时间: $(date)
验证脚本: $0

验证统计:
---------
总检查项: $TOTAL_CHECKS
通过: $PASSED_CHECKS
失败: $FAILED_CHECKS
警告: $WARNING_CHECKS

通过率: $(( PASSED_CHECKS * 100 / TOTAL_CHECKS ))%

系统信息:
---------
操作系统: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
内核版本: $(uname -r)
内存: $(free -h | grep Mem | awk '{print $2}')
磁盘使用: $(df -h / | awk 'NR==2{print $5}')
CPU 核心: $(nproc)

软件版本:
---------
Node.js: $(node -v 2>/dev/null || echo "未安装")
npm: $(npm -v 2>/dev/null || echo "未安装")
PM2: $(pm2 -v 2>/dev/null || echo "未安装")

验证结果:
---------
EOF
    
    # 添加详细的验证日志
    if [ -f "$LOG_FILE" ]; then
        echo "详细日志:" >> "$report_file"
        cat "$LOG_FILE" >> "$report_file"
    fi
    
    echo "验证报告已生成: $report_file"
}

# 显示验证结果摘要
show_verification_summary() {
    echo
    echo "=========================================="
    echo "验证结果摘要"
    echo "=========================================="
    
    echo "总检查项: $TOTAL_CHECKS"
    echo -e "通过: ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "失败: ${RED}$FAILED_CHECKS${NC}"
    echo -e "警告: ${YELLOW}$WARNING_CHECKS${NC}"
    echo
    
    local pass_rate=$(( PASSED_CHECKS * 100 / TOTAL_CHECKS ))
    
    if [ "$FAILED_CHECKS" -eq 0 ] && [ "$pass_rate" -ge 90 ]; then
        echo -e "${GREEN}✅ 环境验证通过，可以进行部署${NC}"
    elif [ "$FAILED_CHECKS" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  环境基本满足要求，但有一些警告项需要注意${NC}"
    else
        echo -e "${RED}❌ 环境验证失败，请解决以下问题后重新验证${NC}"
        echo "失败的检查项需要修复才能正常部署"
    fi
    
    echo
    echo "建议操作："
    if [ "$FAILED_CHECKS" -gt 0 ]; then
        echo "1. 查看详细日志: $LOG_FILE"
        echo "2. 修复失败的检查项"
        echo "3. 重新运行验证脚本"
    else
        echo "1. 运行部署脚本: ./scripts/deploy.sh"
        echo "2. 启动服务: ./scripts/service-start.sh"
    fi
}

# 主验证流程
main() {
    echo "=========================================="
    echo "WordPecker 部署环境验证"
    echo "开始时间: $(date)"
    echo "=========================================="
    
    # 创建日志目录
    mkdir -p ./logs
    
    # 执行验证步骤
    verify_system_requirements
    verify_software_dependencies
    verify_project_structure
    verify_project_dependencies
    verify_environment_configuration
    verify_systemd_service
    verify_cron_configuration
    verify_network_connectivity
    verify_database_connection
    verify_service_ports
    
    # 生成报告和摘要
    generate_verification_report
    show_verification_summary
    
    echo
    echo "验证完成时间: $(date)"
    
    # 返回适当的退出码
    if [ "$FAILED_CHECKS" -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# 错误处理
trap 'log_error "环境验证过程中发生错误"' ERR

# 执行主函数
main "$@"