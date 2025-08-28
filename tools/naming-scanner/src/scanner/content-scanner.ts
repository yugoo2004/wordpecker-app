/**
 * 内容扫描器 - 扫描文件内容中的命名问题
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Match, ContentMatch, NamingPattern } from '../types/index.js';
import { NAMING_PATTERNS, getPatternsForFileType } from '../patterns/naming-patterns.js';

export class ContentScanner {
  
  /**
   * 扫描文件内容
   */
  async scanFileContent(filePath: string): Promise<ContentMatch> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const matches = this.scanContent(content, filePath);
      
      return {
        matches,
        content,
        filePath
      };
    } catch (error) {
      console.warn(`⚠️  无法读取文件: ${filePath}`, error);
      return {
        matches: [],
        content: '',
        filePath
      };
    }
  }

  /**
   * 扫描文本内容
   */
  scanContent(content: string, filePath: string): Match[] {
    const matches: Match[] = [];
    const ext = path.extname(filePath);
    const fileName = path.basename(filePath);
    
    // 获取适用于此文件类型的模式
    const patterns = getPatternsForFileType(ext);
    
    // 按行分割内容
    const lines = content.split('\n');
    
    // 扫描每一行
    lines.forEach((line, lineIndex) => {
      patterns.forEach(pattern => {
        const lineMatches = this.findMatchesInLine(
          line, 
          lineIndex + 1, 
          pattern, 
          filePath
        );
        matches.push(...lineMatches);
      });
    });

    // 扫描文件名本身
    const fileNameMatches = this.scanFileName(fileName, filePath);
    matches.push(...fileNameMatches);

    return matches;
  }

  /**
   * 在单行中查找匹配项
   */
  private findMatchesInLine(
    line: string, 
    lineNumber: number, 
    pattern: NamingPattern, 
    filePath: string
  ): Match[] {
    const matches: Match[] = [];
    
    pattern.incorrectPatterns.forEach(regex => {
      // 重置正则表达式的 lastIndex
      regex.lastIndex = 0;
      
      let match;
      while ((match = regex.exec(line)) !== null) {
        const originalText = match[0];
        const column = match.index + 1;
        
        // 检查上下文规则
        if (!this.validateContext(originalText, line, pattern, filePath)) {
          continue;
        }
        
        // 生成修复建议
        const suggestedFix = this.generateFix(originalText, pattern, line);
        
        matches.push({
          category: pattern.category,
          line: lineNumber,
          column,
          originalText,
          suggestedFix,
          context: this.getContext(line, match.index, 20),
          severity: pattern.severity,
          pattern: pattern.name
        });
        
        // 防止无限循环
        if (!regex.global) break;
      }
    });
    
    return matches;
  }

  /**
   * 扫描文件名
   */
  private scanFileName(fileName: string, filePath: string): Match[] {
    const matches: Match[] = [];
    const fileNamePatterns = NAMING_PATTERNS.filter(p => p.category === 'file');
    
    fileNamePatterns.forEach(pattern => {
      pattern.incorrectPatterns.forEach(regex => {
        regex.lastIndex = 0;
        const match = regex.exec(fileName);
        
        if (match) {
          const originalText = match[0];
          const suggestedFix = this.generateFileNameFix(originalText, fileName);
          
          matches.push({
            category: 'file',
            line: 0, // 文件名没有行号
            column: 0,
            originalText: fileName,
            suggestedFix,
            context: `文件名: ${fileName}`,
            severity: pattern.severity,
            pattern: pattern.name
          });
        }
      });
    });
    
    return matches;
  }

  /**
   * 验证上下文规则
   */
  private validateContext(
    match: string, 
    line: string, 
    pattern: NamingPattern, 
    filePath: string
  ): boolean {
    const fileName = path.basename(filePath);
    
    // 检查文件模式
    const applicableRules = pattern.contextRules.filter(rule => {
      const fileRegex = new RegExp(rule.filePattern);
      return fileRegex.test(fileName);
    });
    
    if (applicableRules.length === 0) {
      return true; // 没有特定规则，默认匹配
    }
    
    // 检查上下文验证规则
    return applicableRules.some(rule => 
      rule.validationRule(match, line)
    );
  }

  /**
   * 生成修复建议
   */
  private generateFix(originalText: string, pattern: NamingPattern, context: string): string {
    const template = pattern.correctFormat;
    
    switch (pattern.category) {
      case 'environment':
        return this.generateEnvironmentFix(originalText);
      
      case 'config':
        return this.generateConfigFix(originalText, context);
      
      case 'display':
        return 'SeeDream 3.0';
      
      case 'class':
        return this.generateClassFix(originalText);
      
      case 'variable':
        return this.generateVariableFix(originalText);
      
      case 'api':
        return this.generateApiFix(originalText);
      
      case 'database':
        return this.generateDatabaseFix(originalText);
      
      default:
        return template;
    }
  }

  /**
   * 生成环境变量修复
   */
  private generateEnvironmentFix(originalText: string): string {
    // 提取后缀部分
    const suffixMatch = originalText.match(/(?:SEEDDREAM_|SEEDRAM_|SEED_DREAM_)(.+)/);
    const suffix = suffixMatch ? suffixMatch[1] : 'VARIABLE';
    return `SEEDREAM_${suffix}`;
  }

  /**
   * 生成配置修复
   */
  private generateConfigFix(originalText: string, context: string): string {
    // 保持引号格式
    if (originalText.includes('"')) {
      return '"seedream"';
    }
    if (originalText.includes("'")) {
      return "'seedream'";
    }
    if (context.includes(':')) {
      return 'seedream';
    }
    return 'seedream';
  }

  /**
   * 生成类名修复
   */
  private generateClassFix(originalText: string): string {
    // 提取后缀部分
    const suffixMatch = originalText.match(/(?:SeedRam|SeedDream|Seed_Dream|SEEDRAM|SEEDDREAM)(.+)/);
    const suffix = suffixMatch ? suffixMatch[1] : 'Service';
    return `Seedream${suffix}`;
  }

  /**
   * 生成变量名修复
   */
  private generateVariableFix(originalText: string): string {
    // 提取后缀部分
    const suffixMatch = originalText.match(/(?:seedRam|seedDream|seed_ram|seed_dream|seedram|seeddream)(.+)/);
    const suffix = suffixMatch ? suffixMatch[1] : 'Variable';
    return `seedream${suffix}`;
  }

  /**
   * 生成 API 修复
   */
  private generateApiFix(originalText: string): string {
    return originalText.replace(/\/(seeddream|seedram|seed-dream)/, '/seedream');
  }

  /**
   * 生成数据库字段修复
   */
  private generateDatabaseFix(originalText: string): string {
    const suffixMatch = originalText.match(/(?:seedram_|seeddream_|seed_dream_)(.+)/);
    const suffix = suffixMatch ? suffixMatch[1] : 'field';
    return `seedream_${suffix}`;
  }

  /**
   * 生成文件名修复
   */
  private generateFileNameFix(originalText: string, fileName: string): string {
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    
    let newBaseName = baseName
      .replace(/seeddream/g, 'seedream')
      .replace(/seedram/g, 'seedream')
      .replace(/seed-dream/g, 'seedream')
      .replace(/seed_dream/g, 'seedream');
    
    return `${newBaseName}${ext}`;
  }

  /**
   * 获取上下文文本
   */
  private getContext(line: string, position: number, contextLength: number): string {
    const start = Math.max(0, position - contextLength);
    const end = Math.min(line.length, position + contextLength);
    
    let context = line.substring(start, end);
    
    // 添加省略号
    if (start > 0) context = '...' + context;
    if (end < line.length) context = context + '...';
    
    return context;
  }
}