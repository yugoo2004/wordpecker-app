#!/usr/bin/env node

/**
 * SeeDream 命名扫描工具 - 命令行界面
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import { NamingScanner } from './index.js';

const program = new Command();

program
  .name('seedream-naming-scanner')
  .description('SeeDream 命名标准化扫描和分析工具')
  .version('1.0.0');

program
  .command('scan')
  .description('扫描项目中的命名问题')
  .option('-p, --path <path>', '项目根目录路径', process.cwd())
  .option('-o, --output <dir>', '报告输出目录', './reports')
  .option('--include <patterns...>', '包含文件模式')
  .option('--exclude <patterns...>', '排除文件模式')
  .option('--max-size <size>', '最大文件大小 (MB)', '10')
  .option('--no-save', '不保存报告文件')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('🔍 SeeDream 命名标准化扫描工具\n'));
      
      const scanOptions = {
        rootPath: path.resolve(options.path),
        maxFileSize: parseInt(options.maxSize) * 1024 * 1024,
        ...(options.include && { includePatterns: options.include }),
        ...(options.exclude && { excludePatterns: options.exclude })
      };

      console.log(chalk.gray(`扫描路径: ${scanOptions.rootPath}`));
      console.log(chalk.gray(`输出目录: ${path.resolve(options.output)}\n`));

      const scanner = new NamingScanner(scanOptions);
      const result = await scanner.scanProject();

      if (options.save !== false) {
        await scanner.saveReport(result, options.output);
      }

      // 显示结果摘要
      const { summary } = result;
      
      if (summary.totalIssues === 0) {
        console.log(chalk.green.bold('\n✅ 恭喜！没有发现命名问题。'));
      } else {
        console.log(chalk.yellow.bold(`\n⚠️  发现 ${summary.totalIssues} 个命名问题需要修复。`));
        
        if (summary.issuesBySeverity.high > 0) {
          console.log(chalk.red(`   🔴 高优先级: ${summary.issuesBySeverity.high} 个`));
        }
        if (summary.issuesBySeverity.medium > 0) {
          console.log(chalk.yellow(`   🟡 中优先级: ${summary.issuesBySeverity.medium} 个`));
        }
        if (summary.issuesBySeverity.low > 0) {
          console.log(chalk.green(`   🟢 低优先级: ${summary.issuesBySeverity.low} 个`));
        }
      }

      console.log(chalk.blue('\n📋 下一步建议:'));
      console.log('1. 查看生成的详细报告');
      console.log('2. 按优先级顺序修复问题');
      console.log('3. 运行测试验证修复结果');

    } catch (error) {
      console.error(chalk.red.bold('❌ 扫描失败:'), error);
      process.exit(1);
    }
  });

program
  .command('patterns')
  .description('显示所有支持的命名模式')
  .action(() => {
    console.log(chalk.blue.bold('📋 支持的命名模式:\n'));
    
    const patterns = [
      { category: '环境变量', correct: 'SEEDREAM_*', incorrect: 'SEEDDREAM_*, SEEDRAM_*' },
      { category: '配置键值', correct: 'seedream', incorrect: 'seeddream, seedram' },
      { category: '显示名称', correct: 'SeeDream 3.0', incorrect: 'SeedRam 3.0, SeedDream' },
      { category: '文件命名', correct: 'seedream-*', incorrect: 'seeddream-*, seedram-*' },
      { category: '类名', correct: 'SeedreamService', incorrect: 'SeedRamService, SeedDreamService' },
      { category: '变量名', correct: 'seedreamVariable', incorrect: 'seedramVariable, seedDreamVariable' },
      { category: 'API 路由', correct: '/api/seedream', incorrect: '/api/seeddream, /api/seedram' },
      { category: '数据库字段', correct: 'seedream_field', incorrect: 'seedram_field, seeddream_field' }
    ];

    patterns.forEach(pattern => {
      console.log(chalk.green.bold(`${pattern.category}:`));
      console.log(chalk.green(`  ✅ 正确: ${pattern.correct}`));
      console.log(chalk.red(`  ❌ 错误: ${pattern.incorrect}\n`));
    });
  });

program
  .command('plan')
  .description('基于扫描结果创建重构计划')
  .option('-p, --path <path>', '项目根目录路径', process.cwd())
  .option('-o, --output <dir>', '计划输出目录', './reports')
  .option('--scan-file <file>', '使用已有的扫描结果文件')
  .option('--validate', '验证生成的计划')
  .option('--optimize', '优化重构计划')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('📋 SeeDream 重构计划生成器\n'));
      
      const scanner = new NamingScanner();
      let scanResult;

      if (options.scanFile) {
        // 从文件加载扫描结果
        console.log(chalk.gray(`加载扫描结果: ${options.scanFile}`));
        const fs = await import('fs/promises');
        const scanData = await fs.readFile(options.scanFile, 'utf-8');
        scanResult = JSON.parse(scanData);
      } else {
        // 执行新的扫描
        console.log(chalk.gray(`扫描项目: ${path.resolve(options.path)}`));
        scanResult = await scanner.scanProject();
      }

      if (scanResult.totalMatches === 0) {
        console.log(chalk.green.bold('✅ 没有发现需要修复的命名问题，无需创建重构计划。'));
        return;
      }

      // 创建重构计划
      const plan = await scanner.createRefactorPlan(scanResult, path.resolve(options.path));

      // 验证计划
      if (options.validate) {
        const validation = scanner.validateRefactorPlan(plan);
        if (!validation.isValid) {
          console.log(chalk.red.bold('❌ 计划验证失败，请检查错误信息。'));
          return;
        }
      }

      // 优化计划
      let finalPlan = plan;
      if (options.optimize) {
        finalPlan = scanner.optimizeRefactorPlan(plan);
      }

      // 保存计划
      await scanner.saveRefactorPlan(finalPlan, options.output);

      console.log(chalk.green.bold('✅ 重构计划创建完成！'));
      console.log(chalk.blue('\n📋 下一步建议:'));
      console.log('1. 查看生成的重构计划文件');
      console.log('2. 在测试环境中执行计划');
      console.log('3. 验证重构结果的正确性');

    } catch (error) {
      console.error(chalk.red.bold('❌ 创建重构计划失败:'), error);
      process.exit(1);
    }
  });

program
  .command('analyze-deps')
  .description('分析项目文件依赖关系')
  .option('-p, --path <path>', '项目根目录路径', process.cwd())
  .option('-o, --output <dir>', '输出目录', './reports')
  .option('--format <format>', '输出格式 (json|dot)', 'json')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('🔍 项目依赖关系分析器\n'));
      
      const { DependencyAnalyzer } = await import('./planner/dependency-analyzer.js');
      const { FileScanner } = await import('./scanner/file-scanner.js');
      
      const fileScanner = new FileScanner({ rootPath: path.resolve(options.path) });
      const dependencyAnalyzer = new DependencyAnalyzer();
      
      console.log(chalk.gray(`分析路径: ${path.resolve(options.path)}`));
      
      // 扫描项目文件
      const files = await fileScanner.scanProject();
      const relativePaths = files.map(f => fileScanner.getRelativePath(f));
      
      // 分析依赖关系
      const dependencyGraph = await dependencyAnalyzer.analyzeDependencies(
        relativePaths, 
        path.resolve(options.path)
      );

      // 保存结果
      const fs = await import('fs/promises');
      await fs.mkdir(options.output, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      if (options.format === 'json') {
        const jsonPath = path.join(options.output, `dependency-graph-${timestamp}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(dependencyGraph, null, 2), 'utf-8');
        console.log(chalk.green(`📄 依赖图已保存: ${jsonPath}`));
      }
      
      if (options.format === 'dot') {
        const dotContent = generateDotGraph(dependencyGraph);
        const dotPath = path.join(options.output, `dependency-graph-${timestamp}.dot`);
        await fs.writeFile(dotPath, dotContent, 'utf-8');
        console.log(chalk.green(`📄 DOT 图已保存: ${dotPath}`));
        console.log(chalk.gray('提示: 使用 Graphviz 可视化: dot -Tpng dependency-graph.dot -o graph.png'));
      }

      // 显示统计信息
      console.log(chalk.blue('\n📊 依赖分析结果:'));
      console.log(`   - 文件节点: ${dependencyGraph.nodes.length}`);
      console.log(`   - 依赖边: ${dependencyGraph.edges.length}`);
      console.log(`   - 循环依赖: ${dependencyGraph.cycles.length}`);
      
      if (dependencyGraph.cycles.length > 0) {
        console.log(chalk.yellow('\n⚠️ 发现循环依赖:'));
        dependencyGraph.cycles.forEach((cycle, index) => {
          console.log(`   ${index + 1}. ${cycle.join(' → ')}`);
        });
      }

    } catch (error) {
      console.error(chalk.red.bold('❌ 依赖分析失败:'), error);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('运行测试扫描（使用示例数据）')
  .action(async () => {
    console.log(chalk.blue.bold('🧪 运行测试扫描...\n'));
    
    try {
      // 创建测试数据
      const testContent = `
// 测试文件内容
const SEEDDREAM_API_KEY = process.env.SEEDDREAM_API_KEY;
const SEEDRAM_CONFIG = { seeddream: true };
class SeedRamImageService {
  private seedramVariable = 'test';
}
app.get('/api/seedram/images', handler);
      `.trim();

      const { ContentScanner } = await import('./scanner/content-scanner.js');
      const { ProblemAnalyzer } = await import('./analyzer/problem-analyzer.js');
      
      const contentScanner = new ContentScanner();
      const analyzer = new ProblemAnalyzer();
      
      const matches = contentScanner.scanContent(testContent, 'test.ts');
      const fileMatch = {
        filePath: 'test.ts',
        fileType: 'source',
        matches,
        totalMatches: matches.length
      };
      
      const result = analyzer.analyzeScanResults([fileMatch]);
      
      console.log(chalk.green(`✅ 测试完成，发现 ${result.totalMatches} 个问题:`));
      
      result.files[0]?.matches.forEach(match => {
        const severity = match.severity === 'high' ? '🔴' : match.severity === 'medium' ? '🟡' : '🟢';
        console.log(`${severity} 第${match.line}行: ${match.originalText} → ${match.suggestedFix}`);
      });
      
    } catch (error) {
      console.error(chalk.red('❌ 测试失败:'), error);
    }
  });

/**
 * 生成 DOT 格式的依赖图
 */
function generateDotGraph(dependencyGraph: any): string {
  const lines = [
    'digraph DependencyGraph {',
    '  rankdir=LR;',
    '  node [shape=box, style=rounded];',
    ''
  ];

  // 添加节点
  for (const node of dependencyGraph.nodes) {
    const label = path.basename(node.id);
    const color = node.type === 'config' ? 'lightblue' : 
                  node.type === 'module' ? 'lightgreen' : 'lightgray';
    lines.push(`  "${node.id}" [label="${label}", fillcolor=${color}, style=filled];`);
  }

  lines.push('');

  // 添加边
  for (const edge of dependencyGraph.edges) {
    const style = edge.type === 'import' ? 'solid' : 
                  edge.type === 'require' ? 'dashed' : 'dotted';
    lines.push(`  "${edge.from}" -> "${edge.to}" [style=${style}];`);
  }

  lines.push('}');
  return lines.join('\n');
}

// 解析命令行参数
program.parse();

// 如果没有提供命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}