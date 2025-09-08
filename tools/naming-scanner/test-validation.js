#!/usr/bin/env node

/**
 * 验证器功能测试脚本
 */

console.log('🧪 开始验证器功能测试...\n');

async function testValidation() {
  try {
    // 动态导入模块
    const { ValidationRunner } = await import('./dist/validator/validation-runner.js');
    const { DEFAULT_VALIDATION_CONFIG } = await import('./dist/validator/config.js');
    const fs = await import('fs/promises');

    // 1. 测试验证运行器创建
    console.log('1️⃣ 测试验证运行器创建...');
    const runner = new ValidationRunner(DEFAULT_VALIDATION_CONFIG);
    console.log('✅ 验证运行器创建成功\n');

    // 2. 创建测试环境变量文件
    console.log('2️⃣ 创建测试环境变量文件...');
    const testEnvContent = `SEEDREAM_API_KEY=test-key
SEEDREAM_DATABASE_URL=mongodb://localhost
SEEDDREAM_WRONG_KEY=wrong
SEEDRAM_ANOTHER_KEY=also-wrong`;

    await fs.writeFile('.env.test', testEnvContent, 'utf-8');
    console.log('✅ 测试环境变量文件已创建\n');

    // 3. 创建测试报告文件
    console.log('3️⃣ 创建测试报告文件...');
    const testReport = {
      timestamp: new Date().toISOString(),
      serviceName: 'SeedDream 3.0',
      status: 'success',
      results: [{ name: 'test1', status: 'passed', duration: 100 }],
      performance: { responseTime: 200, throughput: 1000 }
    };

    await fs.mkdir('test-reports', { recursive: true });
    await fs.writeFile('test-reports/test-report.json', JSON.stringify(testReport, null, 2), 'utf-8');
    console.log('✅ 测试报告文件已创建\n');

    // 4. 测试环境变量验证
    console.log('4️⃣ 测试环境变量验证...');
    const envResult = await runner.runEnvironmentValidation(process.cwd());
    console.log(`✅ 环境变量验证完成: ${envResult.isValid ? '通过' : '失败'}`);
    console.log(`   发现 ${envResult.errors.length} 个错误, ${envResult.warnings.length} 个警告\n`);

    // 5. 测试报告验证
    console.log('5️⃣ 测试报告验证...');
    const reportResult = await runner.runReportValidation(process.cwd());
    console.log(`✅ 报告验证完成: ${reportResult.isValid ? '通过' : '失败'}`);
    console.log(`   发现 ${reportResult.errors.length} 个错误, ${reportResult.warnings.length} 个警告\n`);

    // 6. 测试 CI 验证
    console.log('6️⃣ 测试 CI 验证...');
    const ciResult = await runner.runCIValidation(process.cwd());
    console.log(`✅ CI 验证完成: ${ciResult.isValid ? '通过' : '失败'}`);
    console.log(`   发现 ${ciResult.errors.length} 个错误, ${ciResult.warnings.length} 个警告\n`);

    console.log('🎉 验证器测试完成！');

    // 清理测试文件
    await fs.unlink('.env.test');
    await fs.rm('test-reports', { recursive: true, force: true });
    console.log('🧹 测试文件已清理');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

testValidation();