#!/usr/bin/env node

/**
 * 验证器功能测试脚本
 */

import { ValidationRunner } from './dist/validator/validation-runner.js';
import { EnvironmentValidator } from './dist/validator/environment-validator.js';
import { ReportValidator } from './dist/validator/report-validator.js';
import { CIValidator } from './dist/validator/ci-validator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testValidators() {
  console.log('🧪 开始验证器功能测试...\n');

  try {
    const projectRoot = path.resolve('../../');
    
    // 1. 测试环境变量验证器
    console.log('1️⃣ 测试环境变量验证器...');
    const envValidator = new EnvironmentValidator();
    const envResult = await envValidator.validateProject(projectRoot);
    
    console.log(`   ✅ 环境变量验证完成:`);
    console.log(`      - 检查项: ${envResult.summary.totalChecks}`);
    console.log(`      - 通过: ${envResult.summary.passedChecks}`);
    console.log(`      - 错误: ${envResult.summary.errorCount}`);
    console.log(`      - 警告: ${envResult.summary.warningCount}\n`);

    // 2. 测试报告验证器
    console.log('2️⃣ 测试报告验证器...');
    const reportValidator = new ReportValidator();
    const reportResult = await reportValidator.validateReports(projectRoot);
    
    console.log(`   ✅ 报告验证完成:`);
    console.log(`      - 检查项: ${reportResult.summary.totalChecks}`);
    console.log(`      - 通过: ${reportResult.summary.passedChecks}`);
    console.log(`      - 错误: ${reportResult.summary.errorCount}`);
    console.log(`      - 警告: ${reportResult.summary.warningCount}\n`);

    // 3. 测试 CI 验证器
    console.log('3️⃣ 测试 CI 验证器...');
    const ciValidator = new CIValidator({
      outputFormat: 'json',
      reportPath: './test-reports'
    });
    const ciResult = await ciValidator.runValidation(projectRoot);
    
    console.log(`   ✅ CI 验证完成:`);
    console.log(`      - 检查项: ${ciResult.summary.totalChecks}`);
    console.log(`      - 通过: ${ciResult.summary.passedChecks}`);
    console.log(`      - 错误: ${ciResult.summary.errorCount}`);
    console.log(`      - 警告: ${ciResult.summary.warningCount}\n`);

    // 4. 测试验证运行器
    console.log('4️⃣ 测试验证运行器...');
    const runner = new ValidationRunner();
    
    // 生成配置文件测试
    const configPath = './test-config.json';
    await runner.generateConfigFile(configPath);
    console.log(`   ✅ 配置文件生成测试通过`);
    
    // 加载配置文件测试
    await runner.loadConfigFromFile(configPath);
    console.log(`   ✅ 配置文件加载测试通过`);
    
    // 配置验证测试
    const configValidation = runner.validateConfig();
    console.log(`   ✅ 配置验证测试: ${configValidation.isValid ? '通过' : '失败'}`);
    
    if (!configValidation.isValid) {
      console.log(`      错误: ${configValidation.errors.join(', ')}`);
    }

    // 清理测试文件
    try {
      await fs.unlink(configPath);
    } catch (error) {
      // 忽略清理错误
    }

    // 5. 显示详细错误信息（如果有）
    const allErrors = [
      ...envResult.errors,
      ...reportResult.errors,
      ...ciResult.errors
    ];

    if (allErrors.length > 0) {
      console.log('🚨 发现的问题:');
      allErrors.slice(0, 10).forEach((error, index) => {
        console.log(`   ${index + 1}. [${error.severity}] ${error.message}`);
        if (error.file) {
          console.log(`      文件: ${error.file}`);
        }
        if (error.suggestion) {
          console.log(`      建议: ${error.suggestion}`);
        }
      });
      
      if (allErrors.length > 10) {
        console.log(`   ... 还有 ${allErrors.length - 10} 个问题`);
      }
      console.log();
    }

    // 6. 总结
    const totalChecks = envResult.summary.totalChecks + 
                       reportResult.summary.totalChecks + 
                       ciResult.summary.totalChecks;
    const totalPassed = envResult.summary.passedChecks + 
                       reportResult.summary.passedChecks + 
                       ciResult.summary.passedChecks;
    const totalErrors = envResult.summary.errorCount + 
                       reportResult.summary.errorCount + 
                       ciResult.summary.errorCount;
    const totalWarnings = envResult.summary.warningCount + 
                         reportResult.summary.warningCount + 
                         ciResult.summary.warningCount;

    console.log('📊 验证器测试总结:');
    console.log(`   - 总检查项: ${totalChecks}`);
    console.log(`   - 通过检查: ${totalPassed}`);
    console.log(`   - 总错误数: ${totalErrors}`);
    console.log(`   - 总警告数: ${totalWarnings}`);
    console.log(`   - 成功率: ${totalChecks > 0 ? ((totalPassed / totalChecks) * 100).toFixed(1) : 0}%`);

    console.log('\n🎉 验证器功能测试完成！');

    // 返回适当的退出码
    return totalErrors > 0 ? 1 : 0;

  } catch (error) {
    console.error('❌ 验证器测试失败:', error);
    return 1;
  }
}

// 运行测试
testValidators()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('❌ 测试执行失败:', error);
    process.exit(1);
  });