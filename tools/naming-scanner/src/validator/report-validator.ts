/**
 * 测试报告格式验证器
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { ReportValidationResult, ValidationError, ValidationWarning } from './types';

export class ReportValidator {
  private readonly reportPatterns = [
    '**/*test-report*.json',
    '**/*-report-*.json',
    '**/reports/**/*.json',
    '**/test-results/**/*.json'
  ];

  /**
   * 验证项目中的所有测试报告
   */
  async validateProject(projectRoot: string): Promise<ReportValidationResult> {
    const result: ReportValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      summary: {
        totalReports: 0,
        validReports: 0,
        invalidReports: 0,
        checkedFields: 0,
        validFields: 0,
        invalidFields: 0
      }
    };

    try {
      // 查找所有测试报告文件
      const reportFiles = await this.findReportFiles(projectRoot);
      result.summary.totalReports = reportFiles.length;

      for (const file of reportFiles) {
        const fileResult = await this.validateReportFile(file);
        
        result.errors.push(...fileResult.errors);
        result.warnings.push(...fileResult.warnings);
        result.summary.checkedFields += fileResult.checkedFields;
        result.summary.validFields += fileResult.validFields;
        result.summary.invalidFields += fileResult.invalidFields;

        if (fileResult.errors.length === 0) {
          result.summary.validReports++;
        } else {
          result.summary.invalidReports++;
        }
      }

      result.isValid = result.errors.length === 0;
      
    } catch (error) {
      result.isValid = false;
      result.errors.push({
        file: 'system',
        field: '',
        issue: `验证过程中发生错误: ${error.message}`,
        expected: '',
        actual: '',
        severity: 'high'
      });
    }

    return result;
  }

  /**
   * 验证单个报告文件
   */
  async validateReportFile(filePath: string): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
    checkedFields: number;
    validFields: number;
    invalidFields: number;
  }> {
    const result = {
      errors: [],
      warnings: [],
      checkedFields: 0,
      validFields: 0,
      invalidFields: 0
    };

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      let reportData: any;

      try {
        reportData = JSON.parse(content);
      } catch (parseError) {
        result.errors.push({
          file: filePath,
          field: 'json',
          issue: 'JSON 格式无效',
          expected: '有效的 JSON 格式',
          actual: parseError.message,
          severity: 'high'
        });
        return result;
      }

      // 验证服务名称
      if ('serviceName' in reportData) {
        result.checkedFields++;
        const serviceNameResult = this.validateServiceName(reportData.serviceName);
        if (!serviceNameResult.isValid) {
          result.invalidFields++;
          result.errors.push({
            file: filePath,
            field: 'serviceName',
            issue: serviceNameResult.issue,
            expected: serviceNameResult.expected,
            actual: reportData.serviceName,
            severity: 'high'
          });
        } else {
          result.validFields++;
        }
      }

      // 递归验证嵌套对象中的命名
      this.validateNestedNaming(reportData, filePath, '', result);

    } catch (error) {
      result.errors.push({
        file: filePath,
        field: 'file',
        issue: `无法读取文件: ${error.message}`,
        expected: '可读取的文件',
        actual: error.message,
        severity: 'high'
      });
    }

    return result;
  }

  /**
   * 查找项目中所有测试报告文件
   */
  private async findReportFiles(projectRoot: string): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of this.reportPatterns) {
      try {
        const files = await glob(pattern, {
          cwd: projectRoot,
          absolute: true,
          ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**']
        });
        allFiles.push(...files);
      } catch (error) {
        console.warn(`警告: 无法扫描模式 ${pattern}: ${error.message}`);
      }
    }

    return [...new Set(allFiles)];
  }

  /**
   * 验证服务名称
   */
  private validateServiceName(serviceName: string): {
    isValid: boolean;
    issue?: string;
    expected?: string;
  } {
    const invalidNames = ['SeedDream 3.0', 'SeedRam 3.0', 'seedram', 'seeddream'];
    
    // 检查是否使用了无效的服务名称
    for (const invalid of invalidNames) {
      if (serviceName.includes(invalid)) {
        return {
          isValid: false,
          issue: `使用了错误的服务名称 "${invalid}"`,
          expected: 'SeeDream 3.0'
        };
      }
    }

    return { isValid: true };
  }

  /**
   * 递归验证嵌套对象中的命名
   */
  private validateNestedNaming(
    obj: any, 
    filePath: string, 
    path: string, 
    result: {
      errors: ValidationError[];
      warnings: ValidationWarning[];
      checkedFields: number;
      validFields: number;
      invalidFields: number;
    }
  ): void {
    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // 检查字符串值
      if (typeof value === 'string' && value.toLowerCase().includes('seed')) {
        result.checkedFields++;
        
        const valueValidation = this.validateServiceName(value);
        if (!valueValidation.isValid) {
          result.invalidFields++;
          result.errors.push({
            file: filePath,
            field: currentPath,
            issue: `字段值 "${value}" ${valueValidation.issue}`,
            expected: valueValidation.expected || 'SeeDream 3.0',
            actual: value,
            severity: 'medium'
          });
        } else {
          result.validFields++;
        }
      }

      // 递归检查嵌套对象
      if (typeof value === 'object' && value !== null) {
        this.validateNestedNaming(value, filePath, currentPath, result);
      }
    }
  }

  /**
   * 生成验证报告
   */
  generateReport(result: ReportValidationResult): string {
    const lines: string[] = [];
    
    lines.push('# 测试报告格式验证报告');
    lines.push('');
    lines.push(`## 验证结果: ${result.isValid ? '✅ 通过' : '❌ 失败'}`);
    lines.push('');
    
    // 摘要信息
    lines.push('## 摘要');
    lines.push(`- 总报告数: ${result.summary.totalReports}`);
    lines.push(`- 有效报告: ${result.summary.validReports}`);
    lines.push(`- 无效报告: ${result.summary.invalidReports}`);
    lines.push(`- 检查字段: ${result.summary.checkedFields}`);
    lines.push(`- 有效字段: ${result.summary.validFields}`);
    lines.push(`- 无效字段: ${result.summary.invalidFields}`);
    lines.push('');

    return lines.join('\n');
  }
}