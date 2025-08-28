#!/usr/bin/env node

/**
 * SeeDream 命名扫描器 CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';

const program = new Command();

program
  .name('seedream-naming-scanner')
  .description('SeeDream 命名标准化扫描和分析工具')
  .version('1.0.0');

// 扫描命令
program
  .command('scan')
  .description('扫描项目中的命名问题')
  .option('-p, --path <path>', '项目路径', process.cwd())
  .option('-o, --output <path>', '输出目录', './reports')
  .option('--format <format>', '输出格式 (json|markdown|csv)', 'markdown')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('🔍 SeeDream 命名扫描器\n'));
      
      const { NamingScanner } = await import('./scanner/naming-scanner');
      const scanner = new NamingScanner();
      
      const result = await scanner.scanProject(path.resolve(options.path));
      
      console.log(`扫描完成: 发现 ${result.totalMatches} 个问题`);
      
      // 生成报告
      const { ReportGenerator } = await import('./analyzer/report-generator');
      const generator = new ReportGenerator();
      
      const outputPath = path.join(options.output, `naming-scan-${Date.now()}.${options.format}`);
      await generator.generateReport(result, outputPath, options.format);
      
      console.log(chalk.green(`📄 报告已保存到: ${outputPath}`));
      
    } catch (error) {
      console.error(chalk.red('❌ 扫描失败:'), error);
      process.exit(1);
    }
  });

// 验证命令 - 重定向到外部脚本
program
  .command('validate')
  .description('验证命名规范（使用 validate-naming.js）')
  .action(() => {
    console.log(chalk.blue.bold('🔍 命名规范验证\n'));
    console.log('请使用以下命令进行验证:');
    console.log('');
    console.log(chalk.yellow('  node validate-naming.js          # 完整验证'));
    console.log(chalk.yellow('  node validate-naming.js --check env    # 环境变量验证'));
    console.log(chalk.yellow('  node validate-naming.js --check reports # 报告格式验证'));
    console.log(chalk.yellow('  node validate-naming.js --fix          # 自动修复'));
    console.log('');
    console.log('更多选项请运行: node validate-naming.js --help');
  });

// 帮助命令
program
  .command('help')
  .description('显示详细帮助信息')
  .action(() => {
    console.log(chalk.blue.bold('🔍 SeeDream 命名工具套件\n'));
    
    console.log(chalk.green('可用工具:'));
    console.log('');
    console.log('1. 命名扫描器 (naming-scanner)');
    console.log('   - 扫描项目中的命名问题');
    console.log('   - 生成详细的分析报告');
    console.log('   - 支持多种输出格式');
    console.log('');
    console.log('2. 命名验证器 (validate-naming.js)');
    console.log('   - 验证环境变量命名');
    console.log('   - 验证测试报告格式');
    console.log('   - CI/CD 集成支持');
    console.log('   - 自动修复功能');
    console.log('');
    
    console.log(chalk.green('快速开始:'));
    console.log('');
    console.log(chalk.yellow('  # 扫描项目'));
    console.log(chalk.yellow('  npm run build && node dist/cli.js scan'));
    console.log('');
    console.log(chalk.yellow('  # 验证命名规范'));
    console.log(chalk.yellow('  node validate-naming.js'));
    console.log('');
    console.log(chalk.yellow('  # 安装 Git hooks'));
    console.log(chalk.yellow('  npm run install:hooks'));
    console.log('');
    
    console.log('详细文档请参考 VALIDATION_GUIDE.md');
  });

// 解析命令行参数
program.parse();

// 如果没有提供命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}