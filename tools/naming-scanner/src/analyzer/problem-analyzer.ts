/**
 * 问题分析器 - 分析和分类扫描结果
 */

import { ScanResult, FileMatch, Match, ScanSummary, MatchCategory } from '../types/index.js';

export class ProblemAnalyzer {
  
  /**
   * 分析扫描结果
   */
  analyzeScanResults(fileMatches: FileMatch[]): ScanResult {
    const allMatches = this.flattenMatches(fileMatches);
    const categories = this.categorizeMatches(allMatches);
    const summary = this.generateSummary(fileMatches, allMatches);
    
    return {
      files: fileMatches,
      totalMatches: allMatches.length,
      categories,
      summary
    };
  }

  /**
   * 扁平化所有匹配项
   */
  private flattenMatches(fileMatches: FileMatch[]): Match[] {
    return fileMatches.reduce((acc, fileMatch) => {
      return acc.concat(fileMatch.matches);
    }, [] as Match[]);
  }

  /**
   * 按类别分类匹配项
   */
  private categorizeMatches(matches: Match[]) {
    const categories = {
      environmentVariables: [] as Match[],
      configKeys: [] as Match[],
      displayNames: [] as Match[],
      fileNames: [] as Match[],
      classNames: [] as Match[],
      variableNames: [] as Match[]
    };

    matches.forEach(match => {
      switch (match.category) {
        case 'environment':
          categories.environmentVariables.push(match);
          break;
        case 'config':
          categories.configKeys.push(match);
          break;
        case 'display':
          categories.displayNames.push(match);
          break;
        case 'file':
          categories.fileNames.push(match);
          break;
        case 'class':
          categories.classNames.push(match);
          break;
        case 'variable':
        case 'api':
        case 'database':
          categories.variableNames.push(match);
          break;
      }
    });

    return categories;
  }

  /**
   * 生成扫描摘要
   */
  private generateSummary(fileMatches: FileMatch[], allMatches: Match[]): ScanSummary {
    const totalFiles = fileMatches.length;
    const scannedFiles = fileMatches.filter(f => f.matches.length >= 0).length;
    const skippedFiles = 0; // 这里可以从扫描器获取跳过的文件数
    
    // 按类别统计问题
    const issuesByCategory: Record<MatchCategory, number> = {
      environment: 0,
      config: 0,
      display: 0,
      file: 0,
      class: 0,
      variable: 0,
      api: 0,
      database: 0
    };

    // 按严重程度统计问题
    const issuesBySeverity: Record<'high' | 'medium' | 'low', number> = {
      high: 0,
      medium: 0,
      low: 0
    };

    allMatches.forEach(match => {
      issuesByCategory[match.category]++;
      issuesBySeverity[match.severity]++;
    });

    return {
      totalFiles,
      scannedFiles,
      skippedFiles,
      totalIssues: allMatches.length,
      issuesByCategory,
      issuesBySeverity
    };
  }

  /**
   * 生成详细报告
   */
  generateDetailedReport(scanResult: ScanResult): string {
    const { summary, categories } = scanResult;
    
    let report = '# SeeDream 命名标准化扫描报告\n\n';
    
    // 总体统计
    report += '## 📊 总体统计\n\n';
    report += `- 扫描文件总数: ${summary.scannedFiles}\n`;
    report += `- 发现问题总数: ${summary.totalIssues}\n`;
    report += `- 高优先级问题: ${summary.issuesBySeverity.high}\n`;
    report += `- 中优先级问题: ${summary.issuesBySeverity.medium}\n`;
    report += `- 低优先级问题: ${summary.issuesBySeverity.low}\n\n`;

    // 按类别统计
    report += '## 🏷️ 问题分类统计\n\n';
    report += `| 类别 | 问题数量 | 描述 |\n`;
    report += `|------|----------|------|\n`;
    report += `| 环境变量 | ${categories.environmentVariables.length} | SEEDREAM_* 前缀问题 |\n`;
    report += `| 配置键值 | ${categories.configKeys.length} | 配置文件中的 seedream 键值问题 |\n`;
    report += `| 显示名称 | ${categories.displayNames.length} | 用户界面显示的 SeeDream 3.0 问题 |\n`;
    report += `| 文件命名 | ${categories.fileNames.length} | 文件名 seedream- 前缀问题 |\n`;
    report += `| 类名 | ${categories.classNames.length} | TypeScript/JavaScript 类名问题 |\n`;
    report += `| 变量名 | ${categories.variableNames.length} | 变量、函数、API、数据库字段问题 |\n\n`;

    // 详细问题列表
    if (categories.environmentVariables.length > 0) {
      report += this.generateCategoryReport('环境变量问题', categories.environmentVariables);
    }
    
    if (categories.configKeys.length > 0) {
      report += this.generateCategoryReport('配置键值问题', categories.configKeys);
    }
    
    if (categories.displayNames.length > 0) {
      report += this.generateCategoryReport('显示名称问题', categories.displayNames);
    }
    
    if (categories.fileNames.length > 0) {
      report += this.generateCategoryReport('文件命名问题', categories.fileNames);
    }
    
    if (categories.classNames.length > 0) {
      report += this.generateCategoryReport('类名问题', categories.classNames);
    }
    
    if (categories.variableNames.length > 0) {
      report += this.generateCategoryReport('变量名问题', categories.variableNames);
    }

    // 修复建议
    report += '## 🔧 修复建议\n\n';
    report += this.generateFixSuggestions(scanResult);

    return report;
  }

  /**
   * 生成类别报告
   */
  private generateCategoryReport(title: string, matches: Match[]): string {
    let report = `### ${title}\n\n`;
    
    // 按文件分组
    const matchesByFile = this.groupMatchesByFile(matches);
    
    Object.entries(matchesByFile).forEach(([filePath, fileMatches]) => {
      report += `#### 📄 ${filePath}\n\n`;
      
      fileMatches.forEach(match => {
        const severity = this.getSeverityIcon(match.severity);
        const lineInfo = match.line > 0 ? `第 ${match.line} 行` : '文件名';
        
        report += `- ${severity} **${lineInfo}**: \`${match.originalText}\` → \`${match.suggestedFix}\`\n`;
        if (match.context && match.line > 0) {
          report += `  - 上下文: \`${match.context}\`\n`;
        }
      });
      
      report += '\n';
    });
    
    return report;
  }

  /**
   * 按文件分组匹配项
   */
  private groupMatchesByFile(matches: Match[]): Record<string, Match[]> {
    const grouped: Record<string, Match[]> = {};
    
    // 这里需要从 FileMatch 中获取文件路径信息
    // 暂时使用一个简化的实现
    matches.forEach(match => {
      const key = 'unknown'; // 实际实现中需要从 match 中获取文件路径
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(match);
    });
    
    return grouped;
  }

  /**
   * 获取严重程度图标
   */
  private getSeverityIcon(severity: 'high' | 'medium' | 'low'): string {
    switch (severity) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * 生成修复建议
   */
  private generateFixSuggestions(scanResult: ScanResult): string {
    let suggestions = '';
    
    const { categories, summary } = scanResult;
    
    // 优先级建议
    if (summary.issuesBySeverity.high > 0) {
      suggestions += '### 🔴 高优先级修复\n\n';
      suggestions += '1. **环境变量**: 立即修复所有 SEEDREAM_* 前缀问题，这可能影响应用配置\n';
      suggestions += '2. **显示名称**: 修复用户界面中的品牌名称显示\n';
      suggestions += '3. **API 路由**: 修复 API 端点命名，避免影响前后端通信\n\n';
    }
    
    if (summary.issuesBySeverity.medium > 0) {
      suggestions += '### 🟡 中优先级修复\n\n';
      suggestions += '1. **配置文件**: 统一配置键值命名\n';
      suggestions += '2. **文件命名**: 重命名相关文件并更新引用\n';
      suggestions += '3. **类名**: 更新 TypeScript/JavaScript 类名\n\n';
    }
    
    if (summary.issuesBySeverity.low > 0) {
      suggestions += '### 🟢 低优先级修复\n\n';
      suggestions += '1. **变量名**: 统一代码中的变量和函数命名\n';
      suggestions += '2. **数据库字段**: 更新数据库相关的字段命名\n\n';
    }
    
    // 修复顺序建议
    suggestions += '### 📋 建议修复顺序\n\n';
    suggestions += '1. 首先备份项目\n';
    suggestions += '2. 修复环境变量和配置文件\n';
    suggestions += '3. 更新显示名称和文档\n';
    suggestions += '4. 重构代码中的类名和变量名\n';
    suggestions += '5. 重命名文件并更新引用\n';
    suggestions += '6. 运行测试验证修复结果\n\n';
    
    return suggestions;
  }

  /**
   * 生成 JSON 格式报告
   */
  generateJsonReport(scanResult: ScanResult): string {
    return JSON.stringify(scanResult, null, 2);
  }

  /**
   * 生成 CSV 格式报告
   */
  generateCsvReport(scanResult: ScanResult): string {
    const headers = [
      'File Path',
      'Line',
      'Column', 
      'Category',
      'Severity',
      'Original Text',
      'Suggested Fix',
      'Context',
      'Pattern'
    ];
    
    let csv = headers.join(',') + '\n';
    
    scanResult.files.forEach(fileMatch => {
      fileMatch.matches.forEach(match => {
        const row = [
          `"${fileMatch.filePath}"`,
          match.line.toString(),
          match.column.toString(),
          match.category,
          match.severity,
          `"${match.originalText}"`,
          `"${match.suggestedFix}"`,
          `"${match.context}"`,
          `"${match.pattern}"`
        ];
        csv += row.join(',') + '\n';
      });
    });
    
    return csv;
  }
}