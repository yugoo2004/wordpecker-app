#!/bin/bash

# SeeDream 命名规范验证脚本
# 用于 CI/CD 集成的自动化验证

set -e

# 脚本配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATOR_DIR="$PROJECT_ROOT/tools/naming-scanner"
CONFIG_FILE="$VALIDATOR_DIR/validation.config.json"
REPORT_DIR="$PROJECT_ROOT/validation-reports"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
SeeDream 命名规范验证脚本

用法: $0 [选项]

选项:
    -h, --help              显示此帮助信息
    -c, --config FILE       指定配置文件路径 (默认: validation.config.json)
    -r, --root DIR          指定项目根目录 (默认: 当前目录的上级)
    -o, --output FORMAT     输出格式 (text|json|junit) (默认: text)
    -f, --fail-on-warnings  警告时也失败退出
    --env-only              仅验证环境变量
    --report-only           仅验证测试报告
    --ci                    CI/CD 模式 (简化输出)
    --junit-report FILE     生成 JUnit 格式报告
    --json-report FILE      生成 JSON 格式报告

示例:
    $0                                    # 运行完整验证
    $0 --env-only                         # 仅验证环境变量
    $0 --ci --junit-report junit.xml      # CI 模式，生成 JUnit 报告
    $0 --fail-on-warnings                 # 警告时也失败

EOF
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先安装 Node.js"
        exit 1
    fi
    
    # 检查验证工具目录
    if [ ! -d "$VALIDATOR_DIR" ]; then
        log_error "验证工具目录不存在: $VALIDATOR_DIR"
        exit 1
    fi
    
    # 检查是否已构建
    if [ ! -d "$VALIDATOR_DI 脚本配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATOR_PATH="$PROJECT_ROOT/tools/naming-scanner"
REPORT_DIR="$PROJECT_ROOT/validation-reports"
CONFIG_FILE="$PROJECT_ROOT/validation.config.json"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC= if [ ! -d "$REPORT_DIR" ]; then
        mkdir -p "$REPORT_DIR"
        log_info "创建报告目录: $REPORT_DIR"
    fi
}

# 运行验证
run_validation() {'\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 显示帮助信息
show_help() {
    cat << EOF
SeeDream 命名规范验证脚本

用法: $0 [选项]

选项:
    -h, --help              显示此帮助信息
    -p, --project PATH      项目路径 (默认: 当前目录)
    -c, --config PATH       配置文件路径
    -o, --output    log_success "配置文件生成成功: $CONFIG_FILE"
        else
            log_warning "配置文件生成失败，将使用默认配置"
        fi
        
        cd "$PROJECT_ROOT"
    fi
}

# 运行验证
run_validation() {
    local project_pathcal output_format="$2"
    local report_path="$3"
    local fail_on_warnings="$4"
    local validation_type="$5"
    local config_file="$6"

    log_info "开始运行命名规范验证..."
    log_info "项目路径: $project_path"
    log_info "输出格式: $output_format"
    log_info "报告路径: $report_path"

    # 创建报告目录
    mkdir -p "$report_path"

    # 构建命令
    local cmd="node dist/cli-validator.js"
    local args=""

    case "$validation_type" in
        "env")
            cmd="$cmd env"
            ;;
        "reports")
            cmd="$cmd reports"
            ;;
        "ci")
            cmd="$cmd ci"
            args="$args --output $output_format --report-path $report_path"
            ;;
        *)
            cmd="$cmd validate"
            args="$args --output $output_format --report-path $report_path"
            ;;
    esac

    # 添加通用参数
    args="$args --project $project_path"

    if [ -n "$config_file" ] && [ -f "$config_file" ]; then
        args="$args --config $config_file"
    fi

    if [ "$fail_on_warnings" = "true" ]; then
        args="$args --fail-on-warnings"
    fi

    # 执行验证
    cd "$VALIDATOR_PATH"
    
    local exit_code=0
    if eval "$cmd $args"; then
        log_success "验证完成，所有检查通过"
    else
        exit_code=$?
        log_error "验证失败，发现问题需要修复"
    fi

    cd "$PROJECT_ROOT"
    return $exit_code
}

# 处理验证结果
handle_results() {
    local exit_code="$1"
    local report_path="$2"
    local output_format="$3"

    if [ $exit_code -eq 0 ]; then
        log_success "🎉 所有命名规范检查都已通过！"
        
        if [ "$CI" = "true" ] || [ "$GITHUB_ACTIONS" = "true" ]; then
            echo "::notice::命名规范验证通过"
        fi
    else
        log_error "❌ 命名规范验证失败"
        
        # 查找并显示报告文件
        if [ -d "$report_path" ]; then
            local latest_report
            case "$output_format" in
                "junit")
                    latest_report=$(find "$report_path" -name "*.xml" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
                    ;;
                "text")
                    latest_report=$(find "$report_path" -name "*.txt" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
                    ;;
                *)
                    latest_report=$(find "$report_path" -name "*.json" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
                    ;;
            esac

            if [ -n "$latest_report" ] && [ -f "$latest_report" ]; then
                log_info "详细报告: $latest_report"
                
                if [ "$CI" = "true" ] || [ "$GITHUB_ACTIONS" = "true" ]; then
                    echo "::error::命名规范验证失败，详细报告: $latest_report"
                fi
            fi
        fi
    fi

    return $exit_code
}

# 主函数
main() {
    # 默认参数
    local project_path="$PROJECT_ROOT"
    local output_format="json"
    local report_path="$REPORT_DIR"
    local fail_on_warnings="false"
    local validation_type="full"
    local config_file="$CONFIG_FILE"
    local quiet_mode="false"
    local verbose_mode="false"
    local install_deps="false"

    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -p|--project)
                project_path="$2"
                shift 2
                ;;
            -c|--config)
                config_file="$2"
                shift 2
                ;;
            -o|--output)
                output_format="$2"
                shift 2
                ;;
            -r|--report-path)
                report_path="$2"
                shift 2
                ;;
            -f|--fail-on-warnings)
                fail_on_warnings="true"
                shift
                ;;
            -q|--quiet)
                quiet_mode="true"
                shift
                ;;
            -v|--verbose)
                verbose_mode="true"
                shift
                ;;
            --env-only)
                validation_type="env"
                shift
                ;;
            --reports-only)
                validation_type="reports"
                shift
                ;;
            --ci-mode)
                validation_type="ci"
                fail_on_warnings="true"
                output_format="junit"
                shift
                ;;
            --install)
                install_deps="true"
                shift
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 静默模式设置
    if [ "$quiet_mode" = "true" ]; then
        exec 1>/dev/null
    fi

    # 详细模式设置
    if [ "$verbose_mode" = "true" ]; then
        set -x
    fi

    log_info "SeeDream 命名规范验证开始..."

    # 检查依赖
    check_dependencies

    # 安装依赖（如果需要）
    if [ "$install_deps" = "true" ]; then
        install_dependencies
    fi

    # 生成配置文件
    generate_config

    # 运行验证
    local exit_code=0
    run_validation "$project_path" "$output_format" "$report_path" "$fail_on_warnings" "$validation_type" "$config_file" || exit_code=$?

    # 处理结果
    handle_results $exit_code "$report_path" "$output_format"

    exit $exit_code
}

# 捕获中断信号
trap 'log_error "验证被中断"; exit 130' INT TERM

# 运行主函数
main "$@"