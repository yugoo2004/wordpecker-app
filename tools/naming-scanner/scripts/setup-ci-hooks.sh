#!/bin/bash

# CI/CD 钩子设置脚本
# 用于设置 Git hooks 和 CI/CD 集成

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔧 设置 SeeDream 命名规范 CI/CD 钩子..."
echo "项目根目录: $PROJECT_ROOT"

# 检查是否在 Git 仓库中
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo "❌ 错误: 当前目录不是 Git 仓库"
    exit 1
fi

# 创建 hooks 目录（如果不存在）
mkdir -p "$HOOKS_DIR"

# 1. 设置 pre-commit hook
echo "📝 设置 pre-commit hook..."
cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/bin/bash

# SeeDream 命名规范预提交检查

echo "🔍 运行命名规范预提交检查..."

# 获取项目根目录
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
VALIDATOR_CLI="$PROJECT_ROOT/tools/naming-scanner/dist/cli-validator.js"

# 检查验证器是否存在
if [ ! -f "$VALIDATOR_CLI" ]; then
    echo "⚠️ 警告: 命名验证器未找到，跳过检查"
    echo "请运行: cd tools/naming-scanner && npm run build"
    exit 0
fi

# 运行验证
cd "$PROJECT_ROOT"
node "$VALIDATOR_CLI" ci --pre-commit --project "$PROJECT_ROOT"

exit_code=$?

if [ $exit_code -ne 0 ]; then
    echo ""
    echo "❌ 命名规范检查失败！"
    echo "请修复上述问题后重新提交。"
    echo ""
    echo "💡 提示:"
    echo "  - 使用 'git commit --no-verify' 跳过检查（不推荐）"
    echo "  - 运行 'npm run naming:fix' 自动修复问题"
    echo ""
    exit 1
fi

echo "✅ 命名规范检查通过！"
EOF

chmod +x "$HOOKS_DIR/pre-commit"
echo "✅ pre-commit hook 已设置"

# 2. 设置 pre-push hook
echo "📝 设置 pre-push hook..."
cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/bin/bash

# SeeDream 命名规范预推送检查

echo "🔍 运行命名规范预推送检查..."

# 获取项目根目录
PROJECT_ROOT="$(git rev-parse --show-toplevel)"
VALIDATOR_CLI="$PROJECT_ROOT/tools/naming-scanner/dist/cli-validator.js"

# 检查验证器是否存在
if [ ! -f "$VALIDATOR_CLI" ]; then
    echo "⚠️ 警告: 命名验证器未找到，跳过检查"
    exit 0
fi

# 运行完整验证
cd "$PROJECT_ROOT"
node "$VALIDATOR_CLI" validate --project "$PROJECT_ROOT" --fail-on-errors

exit_code=$?

if [ $exit_code -ne 0 ]; then
    echo ""
    echo "❌ 命名规范验证失败！"
    echo "请修复问题后重新推送。"
    echo ""
    exit 1
fi

echo "✅ 命名规范验证通过！"
EOF

chmod +x "$HOOKS_DIR/pre-push"
echo "✅ pre-push hook 已设置"

# 3. 创建 GitHub Actions 工作流
echo "📝 创建 GitHub Actions 工作流..."
GITHUB_DIR="$PROJECT_ROOT/.github/workflows"
mkdir -p "$GITHUB_DIR"

cat > "$GITHUB_DIR/naming-validation.yml" << 'EOF'
name: 命名规范验证

on:
  push:
    branches: [ main, master, develop ]
  pull_request:
    branches: [ main, master, develop ]

jobs:
  naming-validation:
    runs-on: ubuntu-latest
    
    steps:
    - name: 检出代码
      uses: actions/checkout@v3
      
    - name: 设置 Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: 安装依赖
      run: |
        cd tools/naming-scanner
        npm ci
        
    - name: 构建验证器
      run: |
        cd tools/naming-scanner
        npm run build
        
    - name: 运行命名规范验证
      run: |
        cd tools/naming-scanner
        node dist/cli-validator.js validate --project ../.. --fail-on-errors --generate-report --format json
        
    - name: 上传验证报告
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: naming-validation-report
        path: ci-reports/
        retention-days: 30
        
    - name: 评论 PR（如果失败）
      if: failure() && github.event_name == 'pull_request'
      uses: actions/github-script@v6
      with:
        script: |
          const fs = require('fs');
          const path = require('path');
          
          try {
            const reportDir = 'ci-reports';
            const files = fs.readdirSync(reportDir);
            const jsonFile = files.find(f => f.endsWith('.json'));
            
            if (jsonFile) {
              const reportPath = path.join(reportDir, jsonFile);
              const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
              
              let comment = '## 🚨 命名规范验证失败\n\n';
              comment += `**错误数量**: ${report.result.summary.errorCount}\n`;
              comment += `**警告数量**: ${report.result.summary.warningCount}\n\n`;
              
              if (report.result.errors.length > 0) {
                comment += '### 错误详情\n\n';
                report.result.errors.slice(0, 10).forEach((error, index) => {
                  comment += `${index + 1}. **${error.type}**: ${error.message}\n`;
                  if (error.file) comment += `   - 文件: \`${error.file}\`\n`;
                  if (error.suggestion) comment += `   - 建议: ${error.suggestion}\n`;
                  comment += '\n';
                });
                
                if (report.result.errors.length > 10) {
                  comment += `... 还有 ${report.result.errors.length - 10} 个错误\n\n`;
                }
              }
              
              comment += '请修复这些问题后重新提交。';
              
              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: comment
              });
            }
          } catch (error) {
            console.log('无法生成 PR 评论:', error.message);
          }
EOF

echo "✅ GitHub Actions 工作流已创建"

# 4. 创建 package.json 脚本
echo "📝 更新 package.json 脚本..."
PACKAGE_JSON="$PROJECT_ROOT/package.json"

if [ -f "$PACKAGE_JSON" ]; then
    # 使用 Node.js 脚本更新 package.json
    node -e "
    const fs = require('fs');
    const path = '$PACKAGE_JSON';
    
    try {
        const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
        
        if (!pkg.scripts) pkg.scripts = {};
        
        pkg.scripts['naming:validate'] = 'cd tools/naming-scanner && npm run build && node dist/cli-validator.js validate';
        pkg.scripts['naming:env'] = 'cd tools/naming-scanner && npm run build && node dist/cli-validator.js env';
        pkg.scripts['naming:reports'] = 'cd tools/naming-scanner && npm run build && node dist/cli-validator.js reports';
        pkg.scripts['naming:ci'] = 'cd tools/naming-scanner && npm run build && node dist/cli-validator.js ci';
        pkg.scripts['naming:setup-hooks'] = 'tools/naming-scanner/scripts/setup-ci-hooks.sh';
        
        fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
        console.log('✅ package.json 脚本已更新');
    } catch (error) {
        console.log('⚠️ 无法更新 package.json:', error.message);
    }
    "
else
    echo "⚠️ 警告: package.json 未找到，跳过脚本更新"
fi

# 5. 创建配置文件
echo "📝 创建默认配置文件..."
CONFIG_FILE="$PROJECT_ROOT/naming-validation.config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    cd "$PROJECT_ROOT/tools/naming-scanner"
    npm run build > /dev/null 2>&1 || true
    node dist/cli-validator.js config --output "$CONFIG_FILE" > /dev/null 2>&1 || true
    echo "✅ 默认配置文件已创建: $CONFIG_FILE"
else
    echo "ℹ️ 配置文件已存在: $CONFIG_FILE"
fi

# 6. 创建 CI 验证脚本
echo "📝 创建 CI 验证脚本..."
cat > "$SCRIPTS_DIR/ci-validate.sh" << 'EOF'
#!/bin/bash

# CI 环境中的命名规范验证脚本

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
VALIDATOR_DIR="$PROJECT_ROOT/tools/naming-scanner"

echo "🔍 CI 环境命名规范验证"
echo "项目根目录: $PROJECT_ROOT"

# 进入验证器目录
cd "$VALIDATOR_DIR"

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm ci
fi

# 构建验证器
echo "🔨 构建验证器..."
npm run build

# 运行验证
echo "🚀 运行验证..."
node dist/cli-validator.js validate \
    --project "$PROJECT_ROOT" \
    --fail-on-errors \
    --generate-report \
    --format json

echo "✅ CI 验证完成"
EOF

chmod +x "$SCRIPTS_DIR/ci-validate.sh"
echo "✅ CI 验证脚本已创建"

# 7. 创建本地验证脚本
echo "📝 创建本地验证脚本..."
cat > "$SCRIPTS_DIR/validate-local.sh" << 'EOF'
#!/bin/bash

# 本地开发环境的命名规范验证脚本

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
VALIDATOR_DIR="$PROJECT_ROOT/tools/naming-scanner"

echo "🔍 本地命名规范验证"
echo "项目根目录: $PROJECT_ROOT"

# 进入验证器目录
cd "$VALIDATOR_DIR"

# 构建验证器
echo "🔨 构建验证器..."
npm run build

# 运行验证
echo "🚀 运行验证..."
node dist/cli-validator.js validate \
    --project "$PROJECT_ROOT" \
    --generate-report \
    --format markdown

echo "✅ 本地验证完成"
echo "📄 查看报告: $PROJECT_ROOT/ci-reports/"
EOF

chmod +x "$SCRIPTS_DIR/validate-local.sh"
echo "✅ 本地验证脚本已创建"

echo ""
echo "🎉 CI/CD 钩子设置完成！"
echo ""
echo "📋 已创建的文件:"
echo "  - .git/hooks/pre-commit"
echo "  - .git/hooks/pre-push"
echo "  - .github/workflows/naming-validation.yml"
echo "  - naming-validation.config.json"
echo "  - tools/naming-scanner/scripts/ci-validate.sh"
echo "  - tools/naming-scanner/scripts/validate-local.sh"
echo ""
echo "🚀 可用的命令:"
echo "  npm run naming:validate     # 运行完整验证"
echo "  npm run naming:env          # 验证环境变量"
echo "  npm run naming:reports      # 验证测试报告"
echo "  npm run naming:ci           # 运行 CI 验证"
echo ""
echo "💡 提示:"
echo "  - Git hooks 将在每次提交和推送时自动运行"
echo "  - GitHub Actions 将在 PR 和推送时自动运行"
echo "  - 使用 'git commit --no-verify' 可以跳过 hooks（不推荐）"
echo ""