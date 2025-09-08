/**
 * CI/CD 集成的命名规范检查器
 */

import { promises as fs } from 'fs';
import { EnvironmentValidator } from './environment-validator';
import { ReportValidator } from './report-validator';
import { CIValidationConfig, CIValidationResult } from './types';

export class CIValidator {
  private readonly defaultConfig: CIValidationConfig = {
    failOnErrors: true,
    failOnWarnings: false,
    outputFormat: 'text',
    excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    includePatterns: ['**/*'],
    thresholds: {
      maxErrors: 0,
      maxWarnings: 10,
      minValidationRate: 0.95
    }
  };

  /**
   * 运行 CI/CD 验证检查
   */
  async runValidation(
    projectRoot: string, 
    config: Partial<CIValidationConfig> = {}
  ): Promise<CIValidationResult> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    console.log('🔍 开始 CI/CD 命名规范验证...');
    
    const result: CIValidationResult = {
      success: true,
      exitCode: 0,
      summary: {
        totalChecks: 0,
        passedChecks: 0,
        failedChecks: 0,
        errors: 0,
        warnings: 0,
        validationRate: 0
      },
      environmentValidation: null as any,
      reportValidation: null as any,
      recommendations: []
    };

    try {
      // 1. 环境变量验证
      console.log('📋 验证环境变量命名一致性...');
      const envValidator = new EnvironmentValidator();
      result.environmentValidation = await envValidator.validateProject(projectRoot);
      
      // 2. 测试报告验证
      console.log('📊 验证测试报告格式...');
      const reportValidator = new ReportValidator();
      result.reportValidation = await reportValidator.validateProject(projectRoot);

      // 3. 汇总结果
      this.aggregateResults(result, finalConfig);

      // 4. 生成建议
      result.recommendations = this.generateRecommendations(result);

      console.log(`✅ 验证完成: ${result.success ? '通过' : '失败'}`);
      
    } catch (error) {
      result.success = false;
      result.exitCode = 2;
      result.summary.errors++;
      console.error('❌ 验证过程中发生错误:', error.message);
    }

    return result;
  }

  /**
   * 汇总验证结果
   */
  private aggregateResults(result: CIValidationResult, config: CIValidationConfig): void {
    const envResult = result.environmentValidation;
    const reportResult = result.reportValidation;

    // 统计总数
    result.summary.totalChecks = 2; // 环境变量 + 测试报告
    result.summary.passedChecks = (envResult.isValid ? 1 : 0) + (reportResult.isValid ? 1 : 0);
    result.summary.failedChecks = result.summary.totalChecks - result.summary.passedChecks;

    // 统计错误和警告
    result.summary.errors = envResult.errors.length + reportResult.errors.length;
    result.summary.warnings = envResult.warnings.length + reportResult.warnings.length;

    // 计算验证率
    const totalItems = envResult.summary.totalVariables + reportResult.summary.checkedFields;
    const validItems = envResult.summary.validVariables + reportResult.summary.validFields;
    result.summary.validationRate = totalItems > 0 ? validItems / totalItems : 1;

    // 判断是否成功
    result.success = this.determineSuccess(result.summary, config);
    result.exitCode = result.success ? 0 : 1;
  }

  /**
   * 判断验证是否成功
   */
  private determineSuccess(summary: CIValidationResult['summary'], config: CIValidationConfig): boolean {
    // 检查错误阈值
    if (config.failOnErrors && summary.errors > config.thresholds.maxErrors) {
      return false;
    }

    // 检查警告阈值
    if (config.failOnWarnings && summary.warnings > config.thresholds.maxWarnings) {
      return false;
    }

    // 检查验证率阈值
    if (summary.validationRate < config.thresholds.minValidationRate) {
      return false;
    }

    return summary.failedChecks === 0;
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(result: CIValidationResult): string[] {
    const recommendations: string[] = [];

    // 环境变量建议
    if (result.environmentValidation.errors.length > 0) {
      recommendations.push('修复环境变量命名问题，统一使用 SEEDREAM_ 前缀');
    }

    // 测试报告建议
    if (result.reportValidation.errors.length > 0) {
      recommendations.push('更新测试报告中的服务名称为 "SeeDream 3.0"');
    }

    // 验证率建议
    if (result.summary.validationRate < 0.9) {
      recommendations.push('提高命名规范的一致性，当前验证率较低');
    }

    // 通用建议
    if (recommendations.length === 0) {
      recommendations.push('命名规范良好，继续保持！');
    } else {
      recommendations.push('建议设置 pre-commit hook 以防止命名问题');
    }

    return recommendations;
  }

  /**
   * 生成 pre-commit hook 脚本
   */
  generatePreCommitHook(config: Partial<CIValidationConfig> = {}): string {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    return `#!/bin/sh
# SeeDream 命名规范 pre-commit hook
# 自动生成，请勿手动修改

echo "🔍 检查命名规范..."

# 运行命名规范验证
node tools/naming-scanner/dist/cli.js validate --ci \\
  --fail-on-errors=${finalConfig.failOnErrors} \\
  --fail-on-warnings=${finalConfig.failOnWarnings} \\
  --output-format=${finalConfig.outputFormat} \\
  --max-errors=${finalConfig.thresholds.maxErrors} \\
  --max-warnings=${finalConfig.thresholds.maxWarnings} \\
  --min-validation-rate=${finalConfig.thresholds.minValidationRate}

exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "❌ 命名规范检查失败，请修复问题后重新提交"
  echo "💡 运行 'npm run naming:fix' 尝试自动修复"
  exit 1
fi

echo "✅ 命名规范检查通过"
exit 0
`;
  }

  /**
   * 生成 GitHub Actions 工作流
   */
  generateGitHubWorkflow(config: Partial<CIValidationConfig> = {}): string {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    return `name: 命名规范检查

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  naming-validation:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: 设置 Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: 安装依赖
      run: |
        npm ci
        cd tools/naming-scanner && npm ci
    
    - name: 构建命名扫描器
      run: |
        cd tools/naming-scanner && npm run build
    
    - name: 运行命名规范验证
      run: |
        node tools/naming-scanner/dist/cli.js validate --ci \\
          --fail-on-errors=${finalConfig.failOnErrors} \\
          --fail-on-warnings=${finalConfig.failOnWarnings} \\
          --output-format=github \\
          --max-errors=${finalConfig.thresholds.maxErrors} \\
          --max-warnings=${finalConfig.thresholds.maxWarnings} \\
          --min-validation-rate=${finalConfig.thresholds.minValidationRate}
`;
  }
}