#!/usr/bin/env node

/**
 * 验证当前项目的命名规范
 */

import { ValidationRunner } from './dist/validator/validation-runner.js';
import * as path from 'path';

async function validateProject() {
  console.log('🔍 开始验证 SeeDream 项目命名规范...\n');

  try {
    // 项目根目录（向上两级）
    const projectPath = path.resolve(process.cwd(), '../..');
    console.log(`项目路径: ${projectPath}\n`);

    // 创建配置
    const config = ValidationRunner.createDefaultConfig();
    
    // 创建验证运行器
    const runner = new ValidationRunner(config);

    // 运行验证
    const result = await runner.runAllValidations(projectPath);

    // 输出结果
    console.log('\n📋 验证结果摘要:');
    console.log('='.repeat(50));
    console.log(`状态: ${result.isValid ? '✅ 通过' : '❌ 失败'}`);
    console.log(`总检查项: ${result.summary.totalChecks}`);
    console.log(`通过检查: ${result.summary.passedChecks}`);
    console.log(`失败检查: ${result.summary.failedChecks}`);
    console.log(`错误数量: ${result.summary.errorCount}`);
    console.log(`警告数量: ${result.summary.warningCount}`);
    console.log(`执行时间: ${result.summary.executionTime}ms`);
    console.log('='.repeat(50));

    if (result.errors.length > 0) {
      console.log('\n❌ 发现的问题:');
      result.errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. [${error.type}] ${error.message}`);
        if (error.file) console.log(`   文件: ${error.file}`);
        if (error.suggestion) console.log(`   建议: ${error.suggestion}`);
        console.log();
      });
      
      if (result.errors.length > 10) {
        console.log(`... 还有 ${result.errors.length - 10} 个问题`);
      }
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️ 警告:');
      result.warnings.slice(0, 5).forEach((warning, index) => {
        console.log(`${index + 1}. [${warning.type}] ${warning.message}`);
        if (warning.file) console.log(`   文件: ${warning.file}`);
        console.log();
      });
    }

    console.log('\n💡 提示:');
    console.log('  - 使用 npm run validate:env 仅验证环境变量');
    console.log('  - 使用 npm run validate:reports 仅验证测试报告');
    console.log('  - 查看 naming-validation.config.json 自定义配置');

    // 退出码
    process.exit(result.isValid ? 0 : 1);

  } catch (error) {
    console.error('❌ 验证失败:', error);
    console.error('错误详情:', error.stack);
    process.exit(1);
  }
}

// 运行验证
validateProject().catch(console.error);