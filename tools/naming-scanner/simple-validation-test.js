// 简单的验证功能测试
const { ValidationRunner } = require('./dist/validator/validation-runner.js');

async function testValidation() {
  console.log('🧪 开始验证功能测试...');
  
  try {
    const config = {
      projectRoot: process.cwd(),
      outputDir: './test-reports',
      generateReports: false,
      ciMode: false
    };

    const runner = new ValidationRunner(config);
    const summary = await runner.runAll();

    console.log('✅ 验证功能测试完成');
    console.log(`总体结果: ${summary.overallSuccess ? '通过' : '失败'}`);
    console.log(`通过验证器: ${summary.passedValidators}/${summary.totalValidators}`);
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testValidation();