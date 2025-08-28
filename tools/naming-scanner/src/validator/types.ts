/**
 * 验证器类型定义
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

export interface ValidationError {
  type: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity: 'high' | 'medium' | 'low';
  suggestion?: string;
}

export interface ValidationWarning {
  type: string;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  suggestion?: string;
}

export interface ValidationSummary {
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningCount: number;
  errorCount: number;
  executionTime: number;
}

export interface EnvironmentValidationConfig {
  requiredPrefix: string;
  allowedPrefixes: string[];
  excludePatterns: string[];
  checkFiles: string[];
}

export interface ReportValidationConfig {
  requiredFields: string[];
  allowedFormats: string[];
  schemaValidation: boolean;
  maxFileSize: number;
}

export interface CIValidationConfig {
  enabledChecks: string[];
  failOnWarnings: boolean;
  outputFormat: 'json' | 'junit' | 'text';
  reportPath: string;
}

export interface ValidationConfig {
  environment: EnvironmentValidationConfig;
  report: ReportValidationConfig;
  ci: CIValidationConfig;
}

export interface EnvironmentVariable {
  name: string;
  value?: string;
  file: string;
  line: number;
  isValid: boolean;
  issues: string[];
}

export interface ReportFile {
  path: string;
  format: string;
  size: number;
  content: any;
  isValid: boolean;
  issues: string[];
}