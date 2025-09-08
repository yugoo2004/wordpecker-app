/**
 * 验证运行器 - 统一执行所有验证任务
 */

import { EnvironmentValidator } from './environment-validator.js';
import { ReportValidator } from './report-validator.js';
import { CIValidator } from './ci-validator';
import { ValidationRunnerConfig, ValidationSummary } from './types';
import { promises as fs } from 'fs';
import * as path from 'path';

export class ValidationRunner {
  private readonly config: ValidationRunnerConfig;

  constructor(config: ValidationRunnerConfig) {
    this.config = config;
  }

  /**
   * 运行所有验证检查
   */
  async runAll(): Promise<ValidationSummary> {
    console.log('🚀 开始运行命名规范验证...');
    console.log(`📁 项目路径: ${this.config.projectRoot}`);
    
    const summary: ValidationSummary = {
      timestamp: new Date().toISOString(),
      projectRoot: this.config.projectRoot,
      totalValidators: this.config.ciMode ? 3 : 2,
      passedValidators: 0,
      failedValidators: 0,
      overallSuccess: true,
      results: {} as any,
      recommendations: [],
      nextSteps: []
    };

    try {
      // 1. 环境变量验证
      console.log('\n📋 运行环境变量验证...');
      const envValidator = new EnvironmentValidator();
      summary.results.environment = await envValidator.validateProject(this.config.projectRoot);
      
      if (summary.results.environment.isValid) {
        summary.passedValidators++;
        console.log('✅ 环境变量验证通过');
      } else {
        summary.failedValidators++;
        summary.overallSuccess = false;
        console.log(`❌ 环境变量验证失败: ${summary.results.environment.errors.length} 个错误`);
      }

      // 2. 测试报告验证
      console.log('\n📊 运行测试报告验证...');
      const reportValidator = new ReportValidator();
      summary.results.reports = await reportValidator.validateProject(this.config.projectRoot);
      
      if (summary.results.reports.isValid) {
        summary.passedValidators++;
        console.log('✅ 测试报告验证通过');
      } else {
        summary.failedValidators++;
        summary.overallSuccess = false;
        console.log(`❌ 测试报告验证失败: ${summary.results.reports.errors.length} 个错误`);
      }

      // 3. CI 模式验证（如果启用）
      if (this.config.ciMode) {
        console.log('\n🔧 运行 CI/CD 验证...');
        const ciValidator = new CIValidator();
        summary.results.ci = await ciValidator.runValidation(
          this.config.projectRoot, 
          this.config.ciConfig
        );
        
        if (summary.results.ci.success) {
          summary.passedValidators++;
          console.log('✅ CI/CD 验证通过');
        } else {
          summary.failedValidators++;
          summary.overallSuccess = false;
          console.log(`❌ CI/CD 验证失败: 退出码 ${summary.results.ci.exitCode}`);
        }
      }

      // 4. 生成建议和后续步骤
      summary.recommendations = this.generateRecommendations(summary);
      summary.nextSteps = this.generateNextSteps(summary);

      // 5. 生成报告（如果启用）
      if (this.config.generateReports) {
        await this.generateReports(summary);
      }

      // 6. 输出摘要
      this.printSummary(summary);

    } catch (error) {
      console.error('❌ 验证过程中发生错误:', error);
      summary.overallSuccess = false;
      summary.failedValidators = summary.totalValidators;
    }

    return summary;
  }

  /**
   * 生成改进建议
   */
  private generateRecommendations(summary: ValidationSummary): string[] {
    const recommendations: string[] = [];

    // 环境变量建议
    if (!summary.results.environment.isValid) {
      const errorCount = summary.results.environment.errors.length;
      recommendations.push(`修复 ${errorCount} 个环境变量命名问题`);
    }

    // 测试报告建议
    if (!summary.results.reports.isValid) {
      const errorCount = summary.results.reports.errors.length;
      recommendations.push(`修复 ${errorCount} 个测试报告格式问题`);
    }

    // 通用建议
    if (summary.overallSuccess) {
      recommendations.push('命名规范良好，建议定期运行验证以保持一致性');
    } else {
      recommendations.push('使用自动修复工具批量处理命名问题');
    }

    return recommendations;
  }

  /**
   * 生成后续步骤
   */
  private generateNextSteps(summary: ValidationSummary): string[] {
    const steps: string[] = [];

    if (!summary.overallSuccess) {
      steps.push('1. 查看详细的验证报告了解具体问题');
      steps.push('2. 运行自动修复工具: npm run naming:fix');
      steps.push('3. 手动修复无法自动处理的问题');
      steps.push('4. 重新运行验证确保问题已解决');
    } else {
      steps.push('1. 设置 pre-commit hook 防止未来的命名问题');
      steps.push('2. 在 CI/CD 流水线中添加命名规范检查');
    }

    return steps;
  }

  /**
   * 生成验证报告文件
   */
  private async generateReports(summary: ValidationSummary): Promise<void> {
    const outputDir = this.config.outputDir || path.join(this.config.projectRoot, 'reports', 'naming-validation');
    
    try {
      // 确保输出目录存在
      await fs.mkdir(outputDir, { recursive: true });

      // 生成主报告
      const mainReport = this.generateMainReport(summary);
      await fs.writeFile(
        path.join(outputDir, 'validation-summary.md'),
        mainReport,
        'utf-8'
      );

      // 生成 JSON 格式的详细数据
      await fs.writeFile(
        path.join(outputDir, 'validation-data.json'),
        JSON.stringify(summary, null, 2),
        'utf-8'
      );

      console.log(`📄 验证报告已生成: ${outputDir}`);

    } catch (error) {
      console.warn(`⚠️ 无法生成报告文件: ${error.message}`);
    }
  }

  /**
   * 生成主验证报告
   */
  private generateMainReport(summary: ValidationSummary): string {
    const lines: string[] = [];
    
    lines.push('# SeeDream 命名规范验证报告');
    lines.push('');
    lines.push(`**生成时间**: ${new Date(summary.timestamp).toLocaleString('zh-CN')}`);
    lines.push(`**项目路径**: ${summary.projectRoot}`);
    lines.push(`**验证结果**: ${summary.overallSuccess ? '✅ 通过' : '❌ 失败'}`);
    lines.push('');

    // 验证摘要
    lines.push('## 验证摘要');
    lines.push('');
    lines.push(`- **总验证器**: ${summary.totalValidators}`);
    lines.push(`- **通过验证**: ${summary.passedValidators}`);
    lines.push(`- **失败验证**: ${summary.failedValidators}`);
    lines.push(`- **成功率**: ${((summary.passedValidators / summary.totalValidators) * 100).toFixed(1)}%`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * 打印验证摘要
   */
  private printSummary(summary: ValidationSummary): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 验证摘要');
    console.log('='.repeat(60));
    console.log(`🎯 总体结果: ${summary.overallSuccess ? '✅ 通过' : '❌ 失败'}`);
    console.log(`📈 成功率: ${((summary.passedValidators / summary.totalValidators) * 100).toFixed(1)}%`);
    console.log(`✅ 通过: ${summary.passedValidators}/${summary.totalValidators}`);
    
    if (!summary.overallSuccess) {
      console.log(`❌ 失败: ${summary.failedValidators}`);
      
      const totalErrors = summary.results.environment.errors.length + 
                         summary.results.reports.errors.length;
      const totalWarnings = summary.results.environment.warnings.length + 
                           summary.results.reports.warnings.length;
      
      console.log(`🔴 错误: ${totalErrors}`);
      console.log(`🟡 警告: ${totalWarnings}`);
    }
    
    console.log('='.repeat(60));
    
    if (summary.recommendations.length > 0) {
      console.log('\n💡 主要建议:');
      for (let i = 0; i < Math.min(3, summary.recommendations.length); i++) {
        console.log(`   ${i + 1}. ${summary.recommendations[i]}`);
      }
    }
    
    if (this.config.generateReports) {
      console.log(`\n📄 详细报告已生成到: ${this.config.outputDir || 'reports/naming-validation'}`);
    }
  }
}       warningCount: warnings.length,
        duration
      }
    };
  }

  /**
   * 运行单个验证任务
   */
  async runEnvironmentValidation(projectRoot: string): Promise<EnvironmentValidationResult> {
    const envValidator = new EnvironmentValidator(this.config.environment);
    return await envValidator.validate(projectRoot);
  }

  async runReportValidation(projectRoot: string): Promise<ReportValidationResult> {
    const reportValidator = new ReportValidator(this.config.reports);
    return await reportValidator.validate(projectRoot);
  }

  async runCIValidation(projectRoot: string): Promise<CIValidationResult> {
    const ciValidator = new CIValidator(th