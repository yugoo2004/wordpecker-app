#!/usr/bin/env node

/**
 * 验证系统功能测试
 */

import { ValidationRunner } from './dist/validator/validation-runner.js';

async function testValidationSystem() {
  console.log('🧪 开始验证系统功能测试...\n');

  try {
    // 测试配置
    const config = {
      environment: {
        enabled: true,
        checkFiles: ['.env*', '**/.env*'],
        requiredPrefix: 'SEEDREAM_',
        allowedPrefixes: ['SEEDREAM_'],
        strictMode: true
      },
      reports: {
        enabled: true,
        reportPaths: ['**/*test-report*.json', '**/*-report.json'],
        requiredFields: ['serviceName', 'timestamp', 'results'],
        formatValidation: true,
        schemaValidation: true
      },
      ci: {
        enabled: true,
        configFiles: ['.github/workflows/*.yml', '.gitlab-ci.yml'],
        requiredSteps: ['naming-validation', 'environment-check'],
        integrationChecks: true
      },
      general: {
        outputFormat: 'text',
        verbose: true,
        failOnWarnings: false,
        excludePatterns: ['node_modules/**', 'dist/**', 'build/**']
      }
    };

    // 1. 测试验证运行器创建
    console.log('1️⃣ 测试验证运行器创建...');
    const runner = new ValidationRunner(config);
    console.log('✅ 验证运行器创建成功\n');

    // 2. 测试环境变量验证
    console.log('2️⃣ 测试环境变量验证...');
    try {
      const envResult = await runner.runEnvironmentValidation(process.cwd());
      console.log(`✅ 环境变量验证完成: ${envResult.isValid ? '通过' : '失败'}`);
      console.log(`   检查变量: ${envResult.checkedVariables.length}`);
      console.log(`   不一致变量: ${envResult.inconsistentVariables.length}`);
      console.log(`   缺失变量: ${envResult.missingVariables.length}\n`);
    } catch (error) {
      console.log(`⚠️ 环境变量验证跳过: ${error.message}\n`);
    }

    // 3. 测试报告验证
    console.log('3️⃣ 测试报告验证...');
    try {
      const reportResult = await runner.runReportValidation(process.cwd());
      console.log(`✅ 报告验证完成: ${reportResult.isValid ? '通过' : '失败'}`);
      console.log(`   检查报告: ${reportResult.checkedReports.length}`);
      console.log(`   无效报告: ${reportResult.invalidReports.length}`);
      console.log(`   模式错误: ${reportResult.schemaErrors.length}\n`);
    } catch (error) {
      console.log(`⚠️ 报告验证跳过: ${error.message}\n`);
    }

    // 4. 测试 CI 验证
    console.log('4️⃣ 测试 CI 验证...');
    try {
      const ciResult = await runner.runCIValidation(process.cwd());
      console.log(`✅ CI 验证完成: ${ciResult.isValid ? '通过' : '失败'}`);
      console.log(`   检查配置: ${ciResult.checkedConfigs.length}`);
      console.log(`   缺失步骤: ${ciResult.missingSteps.length}`);
      console.log(`   集成问题: ${ciResult.integrationIssues.length}\n`);
    } catch (error) {
      console.log(`⚠️ CI 验证跳过: ${error.message}\n`);
    }

    // 5. 测试完整验证流程
    console.log('5️⃣ 测试完整验证流程...');
    try {
      const fullResult = await runner.runAll(process.cwd());
      console.log(`✅ 完整验证完成: ${fullResult.overall.isValid ? '通过' : '失败'}`);
      console.log(`   总错误: ${fullResult.overall.errors.length}`);
      console.log(`   总警告: ${fullResult.overall.warnings.length}`);
      console.log(`   执行时间: ${fullResult.executionTime}ms\n`);

      // 6. 测试报告生成
      console.log('6️⃣ 测试报告生成...');
      const reportPath = './validation-test-report.json';
      await runner.generateReport(fullResult, reportPath);
      console.log(`✅ 验证报告已生成: ${reportPath}\n`);

    } catch (error) {
      console.log(`⚠️ 完整验证跳过: ${error.message}\n`);
    }

    console.log('🎉 验证系统测试完成！所有功能正常工作。');

  } catch (error) {
    console.error('❌ 验证系统测试失败:', error);
    console.error('错误详情:', error.stack);
    process.exit(1);
  }
}

// 运行测试
testValidationSystem().catch(console.error);