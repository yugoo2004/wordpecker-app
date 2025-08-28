#!/usr/bin/env node

/**
 * 命名规范验证脚本
 * 用于 CI/CD 集成的自动化验证
 */

import { CIValidator } from './dist/validators/ci-validator.js';
import { EnvironmentValidator } from './dist/validators/environment-validator.js';
import { ReportValidator } from './dist/validators/report-validator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// 命令行参数解析
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    projectRoot: process.cwd(),
    check: 'all', // all, env, reports, naming
    strict: false,
    failOnWarnings: false,
    outputFormat: 'text', // text, json, junit
    outputFile: null,
    fix: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--project-root':
      case '-p':
        options.projectRoot = args[++i];
        break;
      case '--check':
      case '-c':
        options.check = args[++i];
        break;
      case '--strict':
      case '-s':
        options.strict = true;
        break;
      case '--fail-on-warnings':
      case '-w':
        options.failOnWarnings = true;
        break;
      case '--output-format':
      case '-f':
        options.outputFormat = args[++i];
        break;
      case '--output-file':
      case '-o':
        options.outputFile = args[++i];
        break;
      case '--fix':
        options.fix = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`❌ 未知选项: ${arg}`);
          process.exit(1);
        } else {
          options.projectRoot = arg;
        }
        break;
    }
  }

  return options;
}

// 显示帮助信息
function showHelp() {
  console.log(`
🔍 SeeDream 命名规范验证工具

用法:
  node validate-naming.js [选项] [项目路径]

选项:
  -h, --help                显示帮助信息
  -p, --project-root <路径>  指定项目根目录 (默认: 当前目录)
  -c, --check <类型>        指定检查类型: all|env|reports|naming (默认: all)
  -s, --strict              严格模式，任何问题都导致失败
  -w, --fail-on-warnings    警告也导致失败
  -f, --output-format <格式> 输出格式: text|json|junit (默认: text)
  -o, --output-file <文件>   输出到文件
  --fix                     自动修复可修复的问题

检查类型:
  all      - 执行所有检查 (默认)
  env      - 仅检查环境变量命名
  reports  - 仅检查测试报告格式
  naming   - 仅检查通用命名规范

示例:
  # 检查当前项目的所有命名规范
  node validate-naming.js

  # 检查指定项目的环境变量命名
  node validate-naming.js --check env /path/to/project

  # 严格模式检查并输出 JSON 格式
  node validate-naming.js --strict --output-format json

  # 检查并自动修复问题
  node validate-naming.js --fix

  # 生成 JUnit XML 报告用于 CI/CD
  node validate-naming.js --output-format junit --output-file naming-report.xml

退出码:
  0 - 所有检查通过
  1 - 发现问题或警告
  2 - 执行错误
`);
}

// 主函数
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log('🔍 SeeDream 命名规范验证工具');
  console.log(`📁 项目路径: ${options.projectRoot}`);
  console.log(`🎯 检查类型: ${options.check}`);
  console.log('');

  try {
    // 检查项目路径是否存在
    try {
      await fs.access(options.projectRoot);
    } catch (error) {
      console.error(`❌ 项目路径不存在: ${options.projectRoot}`);
      process.exit(2);
    }

    let exitCode = 0;

    switch (options.check) {
      case 'all':
        exitCode = await runFullValidation(options);
        break;
      case 'env':
        exitCode = await runEnvironmentValidation(options);
        break;
      case 'reports':
        exitCode = await runReportValidation(options);
        break;
      case 'naming':
        exitCode = await runNamingValidation(options);
        break;
      default:
        console.error(`❌ 无效的检查类型: ${options.check}`);
        console.error('支持的类型: all, env, reports, naming');
        process.exit(2);
    }

    process.exit(exitCode);

  } catch (error) {
    console.error('❌ 验证过程中发生错误:', error);
    process.exit(2);
  }
}

// 执行完整验证
async function runFullValidation(options) {
  const ciValidator = new CIValidator();
  
  const result = await ciValidator.validateForCI(options.projectRoot, {
    strict: options.strict,
    failOnWarnings: options.failOnWarnings,
    outputFormat: options.outputFormat,
    outputFile: options.outputFile
  });

  if (options.fix && !result.isValid) {
    console.log('\n🔧 尝试自动修复问题...');
    await attemptAutoFix(options.projectRoot, result);
  }

  return result.exitCode;
}

// 执行环境变量验证
async function runEnvironmentValidation(options) {
  const validator = new EnvironmentValidator();
  
  console.log('🌍 检查环境变量命名一致性...');
  const result = await validator.validateProject(options.projectRoot);
  
  if (options.outputFile) {
    const report = validator.generateReport(result);
    await fs.writeFile(options.outputFile, report, 'utf-8');
    console.log(`📄 报告已保存到: ${options.outputFile}`);
  }

  console.log(`\n结果: ${result.isValid ? '✅ 通过' : '❌ 失败'}`);
  console.log(`错误: ${result.errors.length}, 警告: ${result.warnings.length}`);

  if (!result.isValid && options.fix) {
    console.log('\n🔧 环境变量问题需要手动修复');
    console.log('请参考报告中的建议进行修复');
  }

  return result.isValid ? 0 : 1;
}

// 执行报告验证
async function runReportValidation(options) {
  const validator = new ReportValidator();
  
  console.log('📊 检查测试报告格式...');
  const result = await validator.validateProject(options.projectRoot);
  
  if (options.outputFile) {
    const report = validator.generateReport(result);
    await fs.writeFile(options.outputFile, report, 'utf-8');
    console.log(`📄 报告已保存到: ${options.outputFile}`);
  }

  console.log(`\n结果: ${result.isValid ? '✅ 通过' : '❌ 失败'}`);
  console.log(`错误: ${result.errors.length}, 警告: ${result.warnings.length}`);

  if (!result.isValid && options.fix) {
    console.log('\n🔧 尝试自动修复报告格式问题...');
    let fixedCount = 0;
    
    // 获取所有报告文件并尝试修复
    const reportFiles = result.errors
      .map(error => error.file)
      .filter((file, index, arr) => arr.indexOf(file) === index); // 去重

    for (const filePath of reportFiles) {
      try {
        const fixed = await validator.fixReportNaming(filePath);
        if (fixed) {
          fixedCount++;
          console.log(`✅ 已修复: ${filePath}`);
        }
      } catch (error) {
        console.log(`❌ 修复失败 ${filePath}: ${error.message}`);
      }
    }

    console.log(`\n🎉 已修复 ${fixedCount} 个报告文件`);
  }

  return result.isValid ? 0 : 1;
}

// 执行通用命名验证
async function runNamingValidation(options) {
  console.log('📝 检查通用命名规范...');
  
  // 使用 CI 验证器的通用命名检查
  const ciValidator = new CIValidator();
  const result = await ciValidator.validateForCI(options.projectRoot, {
    strict: false,
    failOnWarnings: false,
    outputFormat: 'text'
  });
  
  const scanResult = {
    totalMatches: result.summary.errors + result.summary.warnings
  };
  
  console.log(`\n结果: ${scanResult.totalMatches === 0 ? '✅ 通过' : '❌ 失败'}`);
  console.log(`发现 ${scanResult.totalMatches} 个命名问题`);

  if (options.outputFile) {
    const report = JSON.stringify(scanResult, null, 2);
    await fs.writeFile(options.outputFile, report, 'utf-8');
    console.log(`📄 扫描结果已保存到: ${options.outputFile}`);
  }

  return scanResult.totalMatches === 0 ? 0 : 1;
}

// 尝试自动修复
async function attemptAutoFix(projectRoot, result) {
  let fixedCount = 0;

  // 修复报告格式问题
  if (result.checks.reports && !result.checks.reports.isValid) {
    const reportValidator = new ReportValidator();
    const reportFiles = result.checks.reports.errors
      .map(error => error.file)
      .filter((file, index, arr) => arr.indexOf(file) === index);

    for (const filePath of reportFiles) {
      try {
        const fixed = await reportValidator.fixReportNaming(filePath);
        if (fixed) {
          fixedCount++;
          console.log(`✅ 已修复报告: ${filePath}`);
        }
      } catch (error) {
        console.log(`❌ 修复报告失败 ${filePath}: ${error.message}`);
      }
    }
  }

  console.log(`\n🎉 自动修复完成，共修复 ${fixedCount} 个文件`);
  
  if (fixedCount > 0) {
    console.log('💡 建议重新运行验证以确认修复效果');
  }
}

// 运行主函数
main().catch(error => {
  console.error('❌ 程序执行失败:', error);
  process.exit(2);
});