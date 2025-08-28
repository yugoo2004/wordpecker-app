/**
 * SeeDream 命名扫描和分析工具 - 主入口
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { FileScanner } from './scanner/file-scanner.js';
import { ContentScanner } from './scanner/content-scanner.js';
import { ProblemAnalyzer } from './analyzer/problem-analyzer.js';
import { RefactorPlanner } from './planner/refactor-planner.js';
import { ScanResult, FileMatch, ScanOptions, RefactorPlan, ValidationResult } from './types/index.js';

export class NamingScanner {
  private fileScanner: FileScanner;
  private contentScanner: ContentScanner;
  private problemAnalyzer: ProblemAnalyzer;
  private refactorPlanner: RefactorPlanner;

  constructor(options: Partial<ScanOptions> = {}) {
    this.fileScanner = new FileScanner(options);
    this.contentScanner = new ContentScanner();
    this.problemAnalyzer = new ProblemAnalyzer();
    this.refactorPlanner = new RefactorPlanner();
  }

  /**
   * 执行完整的项目扫描
   */
  async scanProject(): Promise<ScanResult> {
    console.log('🚀 开始 SeeDream 命名标准化扫描...\n');
    
    try {
      // 1. 扫描项目文件
      console.log('📁 第一步: 扫描项目文件...');
      const files = await this.fileScanner.scanProject();
      
      if (files.length === 0) {
        console.log('⚠️  没有找到需要扫描的文件');
        return this.createEmptyResult();
      }

      // 2. 扫描文件内容
      console.log(`📖 第二步: 扫描 ${files.length} 个文件的内容...`);
      const fileMatches = await this.scanFileContents(files);

      // 3. 分析问题
      console.log('🔍 第三步: 分析扫描结果...');
      const scanResult = this.problemAnalyzer.analyzeScanResults(fileMatches);

      // 4. 输出结果
      this.printScanSummary(scanResult);

      return scanResult;

    } catch (error) {
      console.error('❌ 扫描过程中发生错误:', error);
      throw error;
    }
  }

  /**
   * 扫描文件内容
   */
  private async scanFileContents(files: string[]): Promise<FileMatch[]> {
    const fileMatches: FileMatch[] = [];
    let processedCount = 0;

    for (const filePath of files) {
      try {
        const contentMatch = await this.contentScanner.scanFileContent(filePath);
        
        const fileMatch: FileMatch = {
          filePath: this.fileScanner.getRelativePath(filePath),
          fileType: this.fileScanner.getFileType(filePath),
          matches: contentMatch.matches,
          totalMatches: contentMatch.matches.length
        };

        fileMatches.push(fileMatch);
        processedCount++;

        // 显示进度
        if (processedCount % 10 === 0 || processedCount === files.length) {
          console.log(`   处理进度: ${processedCount}/${files.length} (${Math.round(processedCount / files.length * 100)}%)`);
        }

      } catch (error) {
        console.warn(`⚠️  跳过文件 ${filePath}:`, error);
        continue;
      }
    }

    return fileMatches;
  }

  /**
   * 创建空结果
   */
  private createEmptyResult(): ScanResult {
    return {
      files: [],
      totalMatches: 0,
      categories: {
        environmentVariables: [],
        configKeys: [],
        displayNames: [],
        fileNames: [],
        classNames: [],
        variableNames: []
      },
      summary: {
        totalFiles: 0,
        scannedFiles: 0,
        skippedFiles: 0,
        totalIssues: 0,
        issuesByCategory: {
          environment: 0,
          config: 0,
          display: 0,
          file: 0,
          class: 0,
          variable: 0,
          api: 0,
          database: 0
        },
        issuesBySeverity: {
          high: 0,
          medium: 0,
          low: 0
        }
      }
    };
  }

  /**
   * 打印扫描摘要
   */
  private printScanSummary(scanResult: ScanResult): void {
    const { summary } = scanResult;
    
    console.log('\n📊 扫描结果摘要:');
    console.log('================');
    console.log(`扫描文件: ${summary.scannedFiles}`);
    console.log(`发现问题: ${summary.totalIssues}`);
    console.log(`高优先级: ${summary.issuesBySeverity.high} 🔴`);
    console.log(`中优先级: ${summary.issuesBySeverity.medium} 🟡`);
    console.log(`低优先级: ${summary.issuesBySeverity.low} 🟢`);
    
    console.log('\n🏷️ 问题分类:');
    console.log(`环境变量: ${summary.issuesByCategory.environment}`);
    console.log(`配置键值: ${summary.issuesByCategory.config}`);
    console.log(`显示名称: ${summary.issuesByCategory.display}`);
    console.log(`文件命名: ${summary.issuesByCategory.file}`);
    console.log(`类名: ${summary.issuesByCategory.class}`);
    console.log(`变量名: ${summary.issuesByCategory.variable + summary.issuesByCategory.api + summary.issuesByCategory.database}`);
  }

  /**
   * 创建重构计划
   */
  async createRefactorPlan(scanResult: ScanResult, rootPath: string = process.cwd()): Promise<RefactorPlan> {
    console.log('📋 基于扫描结果创建重构计划...\n');
    
    try {
      const plan = await this.refactorPlanner.createPlan(scanResult, rootPath);
      
      console.log('✅ 重构计划创建完成');
      console.log(`📊 计划摘要:`);
      console.log(`   - 总动作数: ${plan.metadata.totalActions}`);
      console.log(`   - 文件重命名: ${plan.fileRenames.length}`);
      console.log(`   - 内容变更: ${plan.contentChanges.length}`);
      console.log(`   - 引用更新: ${plan.referenceUpdates.length}`);
      console.log(`   - 检测冲突: ${plan.conflicts.length}`);
      console.log(`   - 风险级别: ${plan.metadata.riskLevel}`);
      console.log(`   - 预计时间: ${plan.metadata.estimatedDuration} 分钟\n`);
      
      return plan;
    } catch (error) {
      console.error('❌ 创建重构计划失败:', error);
      throw error;
    }
  }

  /**
   * 验证重构计划
   */
  validateRefactorPlan(plan: RefactorPlan): ValidationResult {
    console.log('🔍 验证重构计划...\n');
    
    const validation = this.refactorPlanner.validatePlan(plan);
    
    console.log('📋 验证结果:');
    console.log(`   - 计划有效: ${validation.isValid ? '✅' : '❌'}`);
    console.log(`   - 错误数量: ${validation.errors.length}`);
    console.log(`   - 警告数量: ${validation.warnings.length}`);
    console.log(`   - 建议数量: ${validation.suggestions.length}\n`);
    
    if (validation.errors.length > 0) {
      console.log('❌ 发现的错误:');
      validation.errors.forEach(error => {
        console.log(`   - ${error.message} (${error.code})`);
      });
      console.log();
    }
    
    if (validation.warnings.length > 0) {
      console.log('⚠️ 警告信息:');
      validation.warnings.forEach(warning => {
        console.log(`   - ${warning.message}`);
        console.log(`     建议: ${warning.suggestion}`);
      });
      console.log();
    }
    
    if (validation.suggestions.length > 0) {
      console.log('💡 优化建议:');
      validation.suggestions.forEach(suggestion => {
        console.log(`   - ${suggestion}`);
      });
      console.log();
    }
    
    return validation;
  }

  /**
   * 优化重构计划
   */
  optimizeRefactorPlan(plan: RefactorPlan): RefactorPlan {
    console.log('🔧 优化重构计划...\n');
    
    const optimizedPlan = this.refactorPlanner.optimizePlan(plan);
    
    console.log('✅ 计划优化完成');
    console.log(`📊 优化效果:`);
    console.log(`   - 原动作数: ${plan.metadata.totalActions} -> ${optimizedPlan.metadata.totalActions}`);
    console.log(`   - 原预计时间: ${plan.metadata.estimatedDuration} -> ${optimizedPlan.metadata.estimatedDuration} 分钟\n`);
    
    return optimizedPlan;
  }

  /**
   * 保存重构计划
   */
  async saveRefactorPlan(plan: RefactorPlan, outputDir: string = './reports'): Promise<void> {
    try {
      // 确保输出目录存在
      await fs.mkdir(outputDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const planPath = path.join(outputDir, `refactor-plan-${timestamp}.json`);
      
      await fs.writeFile(planPath, JSON.stringify(plan, null, 2), 'utf-8');
      console.log(`📄 重构计划已保存: ${planPath}`);

      // 保存人类可读的计划摘要
      const summaryPath = path.join(outputDir, `refactor-plan-summary-${timestamp}.md`);
      const summary = this.generatePlanSummary(plan);
      await fs.writeFile(summaryPath, summary, 'utf-8');
      console.log(`📄 计划摘要已保存: ${summaryPath}`);

    } catch (error) {
      console.error('❌ 保存重构计划失败:', error);
      throw error;
    }
  }

  /**
   * 生成计划摘要
   */
  private generatePlanSummary(plan: RefactorPlan): string {
    const summary = [
      `# SeeDream 命名标准化重构计划`,
      ``,
      `**计划ID**: ${plan.id}`,
      `**创建时间**: ${plan.timestamp.toISOString()}`,
      `**总动作数**: ${plan.metadata.totalActions}`,
      `**预计时间**: ${plan.metadata.estimatedDuration} 分钟`,
      `**风险级别**: ${plan.metadata.riskLevel}`,
      `**需要备份**: ${plan.metadata.backupRequired ? '是' : '否'}`,
      `**需要测试**: ${plan.metadata.testingRequired ? '是' : '否'}`,
      ``,
      `## 动作分类`,
      ``,
      `### 文件重命名 (${plan.fileRenames.length})`,
      ...plan.fileRenames.map(r => `- ${r.oldPath} → ${r.newPath}`),
      ``,
      `### 内容变更 (${plan.contentChanges.length})`,
      ...plan.contentChanges.map(c => `- ${c.filePath} (${c.replacements.length} 处修改)`),
      ``,
      `### 引用更新 (${plan.referenceUpdates.length})`,
      ...plan.referenceUpdates.map(u => `- ${u.filePath}: ${u.oldReference} → ${u.newReference}`),
      ``,
      `## 检测到的冲突 (${plan.conflicts.length})`,
      ...plan.conflicts.map(c => `- **${c.severity.toUpperCase()}**: ${c.description}`),
      ``,
      `## 执行顺序`,
      ...plan.executionOrder.map((actionId, index) => `${index + 1}. ${actionId}`),
      ``
    ];

    return summary.join('\n');
  }

  /**
   * 保存扫描报告
   */
  async saveReport(scanResult: ScanResult, outputDir: string = './reports'): Promise<void> {
    try {
      // 确保输出目录存在
      await fs.mkdir(outputDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // 保存详细报告 (Markdown)
      const detailedReport = this.problemAnalyzer.generateDetailedReport(scanResult);
      const mdPath = path.join(outputDir, `seedream-naming-scan-${timestamp}.md`);
      await fs.writeFile(mdPath, detailedReport, 'utf-8');
      console.log(`📄 详细报告已保存: ${mdPath}`);

      // 保存 JSON 报告
      const jsonReport = this.problemAnalyzer.generateJsonReport(scanResult);
      const jsonPath = path.join(outputDir, `seedream-naming-scan-${timestamp}.json`);
      await fs.writeFile(jsonPath, jsonReport, 'utf-8');
      console.log(`📄 JSON 报告已保存: ${jsonPath}`);

      // 保存 CSV 报告
      const csvReport = this.problemAnalyzer.generateCsvReport(scanResult);
      const csvPath = path.join(outputDir, `seedream-naming-scan-${timestamp}.csv`);
      await fs.writeFile(csvPath, csvReport, 'utf-8');
      console.log(`📄 CSV 报告已保存: ${csvPath}`);

    } catch (error) {
      console.error('❌ 保存报告失败:', error);
      throw error;
    }
  }
}

// 导出类型和主要类
export * from './types/index.js';
export { FileScanner } from './scanner/file-scanner.js';
export { ContentScanner } from './scanner/content-scanner.js';
export { ProblemAnalyzer } from './analyzer/problem-analyzer.js';
export { RefactorPlanner } from './planner/refactor-planner.js';
export { DependencyAnalyzer } from './planner/dependency-analyzer.js';
export { ConflictDetector } from './planner/conflict-detector.js';
export { NAMING_PATTERNS } from './patterns/naming-patterns.js';