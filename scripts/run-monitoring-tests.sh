#!/bin/bash
# 监控测试套件统一入口脚
# 运行所有监控相关的测试并生成综合报告

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_DIR/logs/monitoring-test-suite.log"
RESULTS_DIR="$PROJECT_DIR/logs/monitoring-results"
FINAL_REPORT="$PROJECT_DIR/logs/monitoring-comprehensive-reporton"

# 创建结果目录
mkdir -p "$RESULTS_DIR" "$PROJECT_DIR/logs"

# 显示使用说明
show_usage() {
    cat <<EOF
监控测试套件 - W 持续服务部署

用法: $0 [选项]

选项:
  -a, --all              运行所有监控测试（默认）
  -r, --restart          仅运行自动重启测试
  -h, --health           仅运行健康检查测试
  -m, --monitoring       仅运行监控系统测试
  -c, --continuous TIME  运行持续监控测试（秒，默
  -q, --quick            快速测试模式（跳过持续监控）
  --help                 显示此帮助信息

例:
  $
  $0 -q                  # 快速测试
  $0 -c 300              # 运行5分钟持续监控
  $0 -r                  # 仅测试自动重启功能

EOF
}

#报告
ort() {
    cat >
{
  "test_suite": "comprehensive_",
 )",
  "test_modules": [],
  "overall_summary": {
    "total_tests": 0,
    "passed_te": 0,
    "failed_tests": 0,
    "warning_tests": 0,
    "modules_run": 0,
    "modules_passed": 0
  },
  "system_info": {
    "hostname": "
    ",
    "kernel": "$(u)",
    "uptime": "$(uptime | awk  $1}')"
  }
}
EOF
}

# 运行单个测试模块
r
   
 
"
    
    echo "$(date): 开始运行 $mod
    echo "正在运行 $module_na.."
    
    local start_time=$(dat)
    local module_log="$
    
    
    # 运行测试脚本
    local exitde=0
    ifthen
    
    else
        "$script_path" > "$mo=$?
    
    
    local end_time=$(date +%s)
    local duration=$((end_time - strt_time))
    
    # 检查结果文件
    local results_file=""
    case "$module_name" in
        "AutoRestart")
            results_file="$PROJECT_DIR/logs/auto-restart-tes"
            ;;
        "Hery")
            results_file="$PROJECT_DIR/l"
            ;;
        "MonitoringSystem")
            results_file="$PROJECT_DIR/logs/monitoring-system-test-results.jso
            ;;
    esac
    
 
"
    if [ -n
        cp "$results_
        module_summary=$(jq '{
            total: .summary.tota,
    d,
            failed: .summary.failed,
            warnings: (.summary.warnings // 0)
        }' "$results_file")
    else
        # 如果没有结果文件，根据退出码判断
        if then
        : 0}'
        else
            module_summary='{"total": 1, "passed": 0, "failed": 1, "warnings0}'
        fi
    fi
    
    # 更新综合报告
    locap)
    jq --arg name "$module_name" \
       --arg scrath" \
      " \
 " \

       --a" \
       --argjson sum \
       '.test_modules += [{
         "name": $name,
    
         "duration": ($duration | tonumber),
         "exit_code": ($exit_code | tonumber),
         "status": (if ($exit_codd),
         "log_file,
         "results_file": $resultsfile,
         "
        z")
       }] |
       .overall_summary.modules_run += 1 |
       .|
       .overall_summary.passed_tests += ($summary.passed // 0) |
       .overall_summary.failed_tests += ($summary.failed // |
       .overall_summary.warning_tests += ($summary.warnings // |
       i\
       "$FINAL_REPORT" > "$temp_file" && mv "$temp_file"
    
    ecE"
    
 then
        ece 测试通过"
    else
        echo "❌ $module_name 测试失败"
    
    
    return $exit_code
}

# 检查测试环境
check_environment() {
    echo "$(
    echo "检查测试环境..."
    
    # 检查要工具
    local missing_tools=()
    for tool in pm2 curl jq bc; do
        then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        echo "错误_FILE"
      
  exit 1
 fi
    
    # 检查测试脚本
    local test_scripts=(
        "$SCRIPT_DIR/test-auto-restart.sh"
    
        "$SCRIPT_DIR/test-moni
    )
    
    fo
        if [ ! -f "$scriptn
            echo "错误: 测试脚本不存在: $script" >> "$LOG_FILE"
            echo "❌ 测试脚本不存在: $(basename "
            exit 1
        fi
        
        if [ ! -x "$script" ]; then
            chmod +x "$script"
            echo "已设置脚本可执行权限: $(basename "$script")" >> "$LOG
        fi
    done
    
    # 检查服务状态
    if ! pm2 list | grep -q "wordpecker"; then
        echo "警告: 没有发现运行中的 WordPecker 服务" >> "$LOG_FILE"
        echo "⚠️  警告: 没有发现运行中的 WordPecker 服务"
        "
        
        if [ -f "$PROJECT_DIR/ecosyn
            pm2 start "$PROJECT_DIR/
                echo "错误: 无法启动服务"
        "
                exit 1
            }
            sleep 10
        else
            echo "错误: 找不到 PM2 配置文件" >> "$LOG_FILE"
            echo "❌ 找不到 PM2 配置文件"
            exit 1
        fi
    fi
    
    echo "✅ 环境检查通过"
}

# 生成最终报告
generate_final_report() {
    local end_time=$(date -Iseconds)
    local temp_file=$(mktemp)
    
    jq --arg end_time "$end_time" \
       '.end_time = $end_time |
        |
        .overall_status = (if .overall_summary.failed_tests == 0 then "PASSED" else "
        \
       "$FINAL_REPORT" > "$temp_filT"
    
    echo "" >> "$LOG_FILE"
    echo "=== 监控测试套件综合报告 ===" >> "$LOG_FILE"
    echo "
    echo "运行FILE"
    echFILE"
    ec
    echo "通过测试: $(jq -r '.o
    echo "警告测试: $(jq -r '.ovLE"
    echo "失败测试: $(jq -r '.overall_summary.fai
    echo "成功率: $(jq -r '.success_rate' "$FINAL_REPORT"
    echo "整体状态: $(jq -r '.overall_status' "$FINAL_REPORT")" >> "$LOG_FILE"
    echo "" >>ILE"
    
    # 显示模块详情
    echo "模块执行详情:" >> "$LOG_FILE"
    jq -r '.test_modules[] | "[_FILE"
    
    echo ""
    echo "=== 测试套件"
    echo "📊 总测试数: $(jq -r '.overall_su
    echo "✅ 通过测试: $(jq -r '.ovT")"
    echo "⚠️  警告测试: $(jq -r '.overall_summary.warning_tests' "$FINAL_REPORT")"
    echo "❌ 失败测试: $(jq -r '.overall_summary.failed_tes
    echo "📈 成功率: 
    echo "🎯 整体状态: $(jq -r '.overall_st"
    echo ""
    echo "📁 详细报告: $FINAL_REPORT"
    echo "📁 测试日志: $LOG_FILE"
    echo "📁 结果目录:R"
}

# 主执行流程
main() {
    local run_all=rue
    local run_restart=false
    local run_health=false
    local run_monitoring=false
    local continuous_time=60
    local quick_mode=false
    
    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -a|--a
              ue
        ft
                ;;
            -r|--restart)
   =false
ue
                shit
                ;;
            -h|--health)
                run_all=false
                run_health=true
                shift
                ;;
            -m|--monitoring)
        
                run_monitoring=true
                shift
        ;;
            -c|--continuous)
                continuous_time="$2"
                shift 2
                ;;
            -q|--quick)
            ode=true
        
                shift
                ;;
            --help)
                show_usage
         exit 0
                ;;
            *)
                echo "未知选项: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    echo "$(date): 开始监控测试套件执行" >> "$LOG_FILE"
    echo "🚀 开始监控测试套件执行"
    echo ""
    
    # 初始化报告
    init_comprehensive_report
    
    # 检查环境
    check_environment
    
    local overall_exit_code=0
    
    # 运行测试模块
    if [ "$run_all" = true ] || [ "$run_restart" = true ]; t
        echo ""
        run_test_module "AutoRestart" "$SCRIPT_ode=1
    fi
    
    if [ "$run_all" = true ] |hen
        echo ""
        run_test_module "HealthRecovery" "$SCRIPT_DIR/test-healt=1
    fi
    
    if [ "$run_all" = then
        echo ""
   en
        t_code=1
lse
            run_test_module "Moe=1
        fi
    fi
    
    # 生成最终报告
    generate_final_report
    
    echo "$(date): 监控测试套件执行完成，退出码: $overall_exit_code" "
    
    exit $overall_exitode
}

# 如果直接运行此脚本
if [[ "${BASH_SOURCE[0then
    main "$@"
fi    # 检查必要工具
    for tool in jq pm2 curl; do
        if ! command -v "$tool" &> /dev/null; then
            echo "错误: $tool 未安装" >> "$LOG_FILE"
            exit 1
        fi
    done
    
    # 初始化综合报告
    init_comprehensive_report
    
    if [ "$report_only" = true ]; then
        echo "只生成报告模式..."
        finalize_comprehensive_report
        exit 0
    fi
    
    # 设置脚本权限
    chmod +x "$SCRIPT_DIR"/test-*.sh 2>/dev/null || true
    
    local overall_success=true
    
    # 运行测试
    if [ "$run_all" = true ] || [ "$run_restart" = true ]; then
        if ! run_restart_tests; then
            overall_success=false
        fi
    fi
    
    if [ "$run_all" = true ] || [ "$run_health" = true ]; then
        if ! run_health_tests; then
            overall_success=false
        fi
    fi
    
    if [ "$run_all" = true ] || [ "$run_monitoring" = true ]; then
        local monitoring_duration=$continuous_duration
        if [ "$quick_mode" = true ]; then
            monitoring_duration=30
        fi
        
        if ! run_monitoring_tests "$monitoring_duration"; then
            overall_success=false
        fi
    fi
    
    # 完成综合报告
    finalize_comprehensive_report
    
    echo "$(date): 监控测试工具执行完成" >> "$LOG_FILE"
    
    if [ "$overall_success" = true ]; then
        echo "✅ 所有监控测试通过！"
        echo "📊 查看详细报告: $REPORT_DIR/comprehensive-monitoring-report.html"
        exit 0
    else
        echo "❌ 部分监控测试失败，请查看日志和报告"
        echo "📊 查看详细报告: $REPORT_DIR/comprehensive-monitoring-report.html"
        exit 1
    fi
}

# 如果直接运行此脚本
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi