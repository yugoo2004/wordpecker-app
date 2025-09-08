/**
 * 环境变量命名一致性验证器
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ValidationResult, ValidationError, ValidationWarning, EnvironmentValidationConfig } from './types';

export class EnvironmentValidator {
  private config: EnvironmentValidationConfig;

  EnvironmentValidationConfig,
  EnvironmentVariable 
} from './t

  /**
   * 验证环境变量命名一致性
   */
  async validate(projectRoot: string): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    try {sult> {
    const startTime = Date.now();
    const erenvFiles = await this.findEnvironmentFiles(projectRoot);
      
      for (const envFile of envFiles) {
        const fileResult = await this.validateEnvironmentFile(envFile);
        errors.push(...fileResult.errors);
    try {
      // 扫描环境变量文件
      const envFiles = await this.findEnvironmentFiles(projectPath);
      const envVariables = await this.extractEnvironmentVariables(envFiles);
      
      totalChecks = envVariables.length;

      // 检查命名规范
      for (const envVar of envVariaceFiles) {
        const fileResult = await this.validateSourceFile(sourceFile);
        errors.push(...fileResult.errors);
        warnings.push(...fileResult.warnings);
        totalChecks += fileResult.totalChecks;
        passedChecks += fileResult.passedChecks;
      }

      const executionTime = Date.now() - startTime;

      return {.summary.invalidVariables += fileResult.invalidVariables;
length === 0,
        errors,
        warnings,
        summary: {
          totalChecks,
          passedChecks,
          failedChecks: totalChecks - passedChecks,
          warningCount: warnings.length,
          errorCount:  result.errors.length === 0;
      executionTime
        }
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        isValid: false,
        errors: [{
          type: 'environment',
          severity: 'high',
          message: `验证过程中发生错误: ${error instanceof Error ? error.message : String(error)}`
        }],
        warnings: [],
        summary: {
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 1,
          warningCount: 0,
          errorCou
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 1,
          warningCount: 0,
          errorCount: 1,
          executionTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * 查找环境变量文件
   */
  private async findEnvironmentFiles(projectPath: string): Promise<string[]> {
    const patterns = [
      '**/.env*',
      '**/*.env.example'
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, { 
        cwd: projectPath,
        ignore: this.config.excludeFiles
      });
      files.push(...matches.map(f => path.join(projectPath, f)));
    }*.env*',
      '**/environment/**/*.env*',
      '**/*.env.example',
      '**/*.env.local',
      '**/*.env.development',
      '**/*.env.production',
      '**/*.env.test'
    ];

    const files: string[] = [];
    
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: projectRoot,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        absolute: true
      });
      files.push(...matches);
    }

    // 去重并过滤存在的文件
    const uniqueFiles = [...new Set(files)];
    const existingFiles: string[] = [];

    for (const file of uniqueFiles) {
      try {
        await fs.access(file);
        existingFiles.push(file);
      } catch {
        // 文件不存在，跳过
      }
    }

    return existingFiles;
  }

  /**
   * 从文件中提取环境变量
   */
  private async extractEnvironmentVariables(filePath: string): Promise<EnvironmentVariable[]> {
    const variables: EnvironmentVariable[] = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNumber = i + 1;

        // 跳过注释和空行
        if (!line || line.startsWith('#') || line.startsWith('//')) {
          continue;
        }

        // 匹配环境变量定义 (KEY=value 或 KEY="value" 或 KEY='value')
        const envVarMatch = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
        if (envVarMatch) {
          const [, name, value] = envVarMatch;
          
          // 检查是否是 SeeDream 相关的变量
          if (this.isSeeDreamVariable(name)) {
            const isCorrect = this.isCorrectVariableName(name);
            const suggestedName = isCorrect ? undefined : this.getSuggestedVariableName(name);

            variables.push({
              name,
              file: filePath,
              line: lineNumber,
              value: value.replace(/^["']|["']$/g, ''), // 移除引号
              isCorrect,
              suggestedName
            });
          }
        }

        // 匹配代码中的环境变量引用 (process.env.VARIABLE_NAME)
        const envRefMatches = line.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g);
        for (const match of envRefMatches) {
          const name = match[1];
          if (this.isSeeDreamVariable(name)) {
            const isCorrect = this.isCorrectVariableName(name);
            const suggestedName = isCorrect ? undefined : this.getSuggestedVariableName(name);

            variables.push({
              name,
              file: filePath,
              line: lineNumber,
              isCorrect,
              suggestedName
            });
          }
        }
      }
    } catch (error) {
      // 文件读取失败，返回空数组
    }

    return variables;
  }

  /**
   * 检查是否是 SeeDream 相关的变量
   */
  private isSeeDreamVariable(name: string): boolean {
    const seeDreamPatterns = [
      /^SEEDREAM_/i,
      /^SEEDDREAM_/i,
      /^SEEDRAM_/i,
      /seedream/i,
      /seeddream/i,
      /seedram/i
    ];

    return seeDreamPatterns.some(pattern => pattern.test(name));
  }

  /**
   * 检查变量名是否正确
   */
  private isCorrectVariableName(name: string): boolean {
    // 正确的格式应该是 SEEDREAM_ 开头
    return name.startsWith('SEEDREAM_');
  }

  /**
   * 获取建议的变量名
   */
  private getSuggestedVariableName(name: string): string {
    // 将各种错误格式转换为正确格式
    return name
      .replace(/^SEEDDREAM_/i, 'SEEDREAM_')
      .replace(/^SEEDRAM_/i, 'SEEDREAM_')
      .toUpperCase();
  }

  /**
   * 验证单个变量名
   */
  private validateVariableName(variable: EnvironmentVariable): {
    isValid: boolean;
    error?: string;
    suggestion?: string;
  } {
    if (variable.isCorrect) {
      return { isValid: true };
    }

    return {
      isValid: false,
      error: `环境变量 "${variable.name}" 使用了不正确的命名格式`,
      suggestion: `建议改为: ${variable.suggestedName}`
    };
  }

  /**
   * 检测变量命名的不一致性
   */
  private detectInconsistencies(variables: EnvironmentVariable[]): EnvironmentInconsistency[] {
    const inconsistencies: EnvironmentInconsistency[] = [];
    const variableGroups = new Map<string, EnvironmentVariable[]>();

    // 按基础名称分组变量
    for (const variable of variables) {
      const baseName = this.getBaseName(variable.name);
      if (!variableGroups.has(baseName)) {
        variableGroups.set(baseName, []);
      }
      variableGroups.get(baseName)!.push(variable);
    }

    // 检查每组中是否有不同的格式
    for (const [baseName, group] of variableGroups) {
      const formats = [...new Set(group.map(v => this.getVariableFormat(v.name)))];
      
      if (formats.length > 1) {
        const files = [...new Set(group.map(v => v.file))];
        const recommendedFormat = this.getRecommendedFormat(baseName);
        
        inconsistencies.push({
          variableName: baseName,
          files,
          formats,
          recommendedFormat
        });
      }
    }

    return inconsistencies;
  }

  /**
   * 获取变量的基础名称（去除前缀）
   */
  private getBaseName(variableName: string): string {
    return variableName
      .replace(/^(SEEDREAM_|SEEDDREAM_|SEEDRAM_)/i, '')
      .toLowerCase();
  }

  /**
   * 获取变量的格式类型
   */
  private getVariableFormat(variableName: string): string {
    if (variableName.startsWith('SEEDREAM_')) return 'SEEDREAM_';
    if (variableName.startsWith('SEEDDREAM_')) return 'SEEDDREAM_';
    if (variableName.startsWith('SEEDRAM_')) return 'SEEDRAM_';
    return 'unknown';
  }

  /**
   * 获取推荐的格式
   */
  private getRecommendedFormat(baseName: string): string {
    return `SEEDREAM_${baseName.toUpperCase()}`;
  }
}