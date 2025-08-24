#!/bin/bash
# WordPecker 快速部署脚本
# 功能：一键执行完整的部署流程

set -e

# 配置变量
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_DIR/logs/quick-deploy.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# 显示帮助信息
show_help() {
    cat << EOF
WordPecker 快速部署脚本

用法: $0 [选项]

选项:
  -h, --help              显示此帮助信息
  -c, --check-only        仅执行部署前检查
  -s, --skip-check        跳过部署前检查
  -f, --force             强制部署（跳过某些安全检查）
  -v, --verify-only       仅执行部署后验证
  -q, --quiet             静默模式（减少输出）
  --clean                 执行清理安装
  --no-backup             跳过备份步骤（不推荐）

部署流程:
  1. 部署前检查 (pre-deploy-check.sh)
  2. 自动化部署 (deploy.sh)
  3. 部署后验证 (post-deploy-verify.sh)

示例:
  $0                      # 完整部署流程
  $0 --check-only         # 仅检查环境
  $0 --skip-check         # 跳过检查直接部署
  $0 --verify-only        # 仅验证当前部署
EOF
}

# 检查脚本文件
check_script_files() {
    local required_scripts=(
        "pre-deploy-check.sh"
        "deploy.sh"
        "post-deploy-verify.sh"
    )
    
    for script in "${required_scripts[@]}"; do
        local script_path="$SCRIPT_DIR/$script"
        if [ ! -f "$script_path" ]; then
            log_error "缺少必需的脚本文件: $script"
            return 1
        fi
        
        if [ ! -x "$script_path" ]; then
            log_info "设置脚本执行权限: $script"
            chmod +x "$script_path"
        fi
    done
    
    log_success "所有必需的脚本文件检查通过"
}

# 执行部署前检查
run_pre_deploy_check() {
    log_info "=========================================="
    log_info "步骤 1/3: 执行部署前检查"
    log_info "=========================================="
    
    local check_script="$SCRIPT_DIR/pre-deploy-check.sh"
    
    if [ ! -f "$check_script" ]; then
        log_error "部署前检查脚本不存在: $check_script"
        return 1
    fi
    
    log_info "运行部署前检查脚本..."
    
    if bash "$check_script"; then
        log_success "部署前检查通过"
        return 0
    else
        log_error "部署前检查失败"
        
        if [ "$FORCE_DEPLOY" = "true" ]; then
            log_warning "强制部署模式，忽略检查失败"
            return 0
        else
            log_error "建议修复检查失败的问题后重新部署"
            log_info "或使用 --force 选项强制部署（不推荐）"
            return 1
        fi
    fi
}

# 执行自动化部署
run_deployment() {
    log_info "=========================================="
    log_info "步骤 2/3: 执行自动化部署"
    log_info "=========================================="
    
    local deploy_script="$SCRIPT_DIR/deploy.sh"
    
    if [ ! -f "$deploy_script" ]; then
        log_error "部署脚本不存在: $deploy_script"
        return 1
    fi
    
    # 构建部署参数
    local deploy_args=()
    
    if [ "$CLEAN_INSTALL" = "true" ]; then
        deploy_args+=("--clean")
    fi
    
    if [ "$FORCE_DEPLOY" = "true" ]; then
        deploy_args+=("--force")
    fi
    
    if [ "$QUIET_MODE" = "true" ]; then
        deploy_args+=("--verbose")  # 实际上我们想要详细日志用于调试
    fi
    
    log_info "运行部署脚本: bash $deploy_script ${deploy_args[*]}"
    
    if bash "$deploy_script" "${deploy_args[@]}"; then
        log_success "自动化部署完成"
        return 0
    else
        log_error "自动化部署失败"
        return 1
    fi
}

# 执行部署后验证
run_post_deploy_verification() {
    log_info "=========================================="
    log_info "步骤 3/3: 执行部署后验证"
    log_info "=========================================="
    
    local verify_script="$SCRIPT_DIR/post-deploy-verify.sh"
    
    if [ ! -f "$verify_script" ]; then
        log_error "部署后验证脚本不存在: $verify_script"
        return 1
    fi
    
    log_info "运行部署后验证脚本..."
    
    if bash "$verify_script"; then
        log_success "部署后验证通过"
        return 0
    else
        log_error "部署后验证失败"
        return 1
    fi
}

# 显示部署摘要
show_deployment_summary() {
    local start_time=$1
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))
    
    echo
    log_info "=========================================="
    log_info "WordPecker 快速部署完成"
    log_info "=========================================="
    log_info "开始时间: $(date -d @$start_time '+%Y-%m-%d %H:%M:%S')"
    log_info "结束时间: $(date -d @$end_time '+%Y-%m-%d %H:%M:%S')"
    log_info "总耗时: ${minutes}分${seconds}秒"
    echo
    
    # 显示服务信息
    log_info "服务访问信息:"
    log_info "  前端应用: http://localhost:5173"
    log_info "  后端API: http://localhost:3000/api"
    log_info "  健康检查: http://localhost:3000/api/health"
    log_info "  就绪检查: http://localhost:3000/api/ready"
    echo
    
    # 显示管理命令
    log_info "常用管理命令:"
    log_info "  查看进程状态: pm2 status"
    log_info "  查看日志: pm2 logs"
    log_info "  重启服务: pm2 restart all"
    log_info "  停止服务: pm2 stop all"
    echo
    
    # 显示日志文件位置
    log_info "日志文件位置:"
    log_info "  部署日志: $LOG_FILE"
    log_info "  应用日志: $PROJECT_DIR/logs/"
    log_info "  PM2日志: ~/.pm2/logs/"
    echo
    
    log_success "🎉 WordPecker 部署成功！"
}

# 显示部署失败信息
show_deployment_failure() {
    local failed_step=$1
    
    echo
    log_error "=========================================="
    log_error "WordPecker 部署失败"
    log_error "=========================================="
    log_error "失败步骤: $failed_step"
    echo
    
    log_info "故障排除建议:"
    
    case "$failed_step" in
        "pre-check")
            log_info "1. 检查系统环境和依赖是否满足要求"
            log_info "2. 确认环境变量是否正确设置"
            log_info "3. 检查网络连接和外部API访问"
            log_info "4. 查看详细错误信息: cat $PROJECT_DIR/logs/pre-deploy-check.log"
            ;;
        "deployment")
            log_info "1. 检查代码仓库连接和权限"
            log_info "2. 确认依赖安装过程是否正常"
            log_info "3. 检查PM2进程状态: pm2 status"
            log_info "4. 查看详细错误信息: cat $PROJECT_DIR/logs/deploy.log"
            ;;
        "verification")
            log_info "1. 检查服务是否正常启动"
            log_info "2. 确认端口是否被占用"
            log_info "3. 检查防火墙和网络配置"
            log_info "4. 查看详细错误信息: cat $PROJECT_DIR/logs/post-deploy-verify.log"
            ;;
    esac
    
    echo
    log_info "获取帮助:"
    log_info "  查看完整日志: cat $LOG_FILE"
    log_info "  重新运行检查: $0 --check-only"
    log_info "  强制部署: $0 --force"
    echo
}

# 清理函数
cleanup() {
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        log_warning "部署过程被中断"
    fi
    
    # 这里可以添加清理逻辑
    exit $exit_code
}

# 设置陷阱
trap cleanup EXIT INT TERM

# 主函数
main() {
    local start_time=$(date +%s)
    
    # 解析命令行参数
    local check_only=false
    local skip_check=false
    local verify_only=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--check-only)
                check_only=true
                shift
                ;;
            -s|--skip-check)
                skip_check=true
                shift
                ;;
            -f|--force)
                export FORCE_DEPLOY=true
                shift
                ;;
            -v|--verify-only)
                verify_only=true
                shift
                ;;
            -q|--quiet)
                export QUIET_MODE=true
                shift
                ;;
            --clean)
                export CLEAN_INSTALL=true
                shift
                ;;
            --no-backup)
                export NO_BACKUP=true
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 切换到项目目录
    cd "$PROJECT_DIR"
    
    # 创建日志目录
    mkdir -p "$PROJECT_DIR/logs"
    
    log_info "=========================================="
    log_info "WordPecker 快速部署开始"
    log_info "时间: $(date)"
    log_info "项目目录: $PROJECT_DIR"
    log_info "用户: $(whoami)"
    log_info "主机: $(hostname)"
    log_info "=========================================="
    
    # 检查脚本文件
    if ! check_script_files; then
        log_error "脚本文件检查失败"
        exit 1
    fi
    
    # 根据参数执行相应操作
    if [ "$check_only" = true ]; then
        log_info "执行仅检查模式"
        if run_pre_deploy_check; then
            log_success "✅ 环境检查通过，可以进行部署"
            exit 0
        else
            log_error "❌ 环境检查失败"
            exit 1
        fi
    fi
    
    if [ "$verify_only" = true ]; then
        log_info "执行仅验证模式"
        if run_post_deploy_verification; then
            log_success "✅ 部署验证通过"
            exit 0
        else
            log_error "❌ 部署验证失败"
            exit 1
        fi
    fi
    
    # 完整部署流程
    local failed_step=""
    
    # 步骤1: 部署前检查
    if [ "$skip_check" != true ]; then
        if ! run_pre_deploy_check; then
            failed_step="pre-check"
            show_deployment_failure "$failed_step"
            exit 1
        fi
    else
        log_warning "跳过部署前检查（不推荐）"
    fi
    
    # 步骤2: 自动化部署
    if ! run_deployment; then
        failed_step="deployment"
        show_deployment_failure "$failed_step"
        exit 1
    fi
    
    # 步骤3: 部署后验证
    if ! run_post_deploy_verification; then
        failed_step="verification"
        show_deployment_failure "$failed_step"
        exit 1
    fi
    
    # 显示成功摘要
    show_deployment_summary "$start_time"
}

# 脚本入口点
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi