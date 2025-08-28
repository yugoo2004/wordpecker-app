/**
 * 文件扫描器 - 扫描项目中的所有相关文件
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { ScanOptions, FileMatch } from '../types/index.js';

export class FileScanner {
  private options: ScanOptions;

  constructor(options: Partial<ScanOptions> = {}) {
    this.options = {
      rootPath: process.cwd(),
      includePatterns: ['**/*'],
      excludePatterns: [
        'node_modules/**',
        '.git/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '*.log',
        '*.tmp',
        '.DS_Store',
        'Thumbs.db',
        '**/*.min.js',
        '**/*.min.css',
        '**/logs/**',
        '**/audio-cache/**',
        '**/backups/**'
      ],
      fileTypes: [
        '.ts', '.js', '.tsx', '.jsx',
        '.vue', '.html', '.css', '.scss',
        '.json', '.yaml', '.yml',
        '.md', '.mdx',
        '.env', '.env.example', '.env.local',
        '.sh', '.bash',
        '.dockerfile', 'Dockerfile',
        '.conf', '.config'
      ],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      followSymlinks: false,
      ...options
    };
  }

  /**
   * 扫描项目中的所有相关文件
   */
  async scanProject(): Promise<string[]> {
    console.log(`🔍 开始扫描项目: ${this.options.rootPath}`);
    
    try {
      // 构建 glob 模式
      const patterns = this.buildGlobPatterns();
      
      // 使用 glob 查找文件
      const files = await glob(patterns, {
        cwd: this.options.rootPath,
        ignore: this.options.excludePatterns,
        absolute: true,
        nodir: true
      });

      // 过滤文件
      const filteredFiles = await this.filterFiles(files);
      
      console.log(`📁 找到 ${filteredFiles.length} 个相关文件`);
      return filteredFiles;
      
    } catch (error) {
      console.error('❌ 文件扫描失败:', error);
      throw new Error(`文件扫描失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 构建 glob 模式
   */
  private buildGlobPatterns(): string[] {
    const patterns: string[] = [];
    
    // 基于文件类型构建模式
    for (const fileType of this.options.fileTypes) {
      if (fileType.startsWith('.')) {
        patterns.push(`**/*${fileType}`);
      } else {
        patterns.push(`**/${fileType}`);
      }
    }
    
    // 添加自定义包含模式
    patterns.push(...this.options.includePatterns);
    
    return patterns;
  }

  /**
   * 过滤文件列表
   */
  private async filterFiles(files: string[]): Promise<string[]> {
    const filteredFiles: string[] = [];
    
    for (const file of files) {
      try {
        // 检查文件是否存在
        const stats = await fs.stat(file);
        
        // 跳过目录
        if (stats.isDirectory()) {
          continue;
        }
        
        // 检查文件大小
        if (stats.size > this.options.maxFileSize) {
          console.warn(`⚠️  跳过大文件: ${file} (${this.formatFileSize(stats.size)})`);
          continue;
        }
        
        // 检查文件类型
        if (!this.isValidFileType(file)) {
          continue;
        }
        
        // 检查是否为二进制文件
        if (await this.isBinaryFile(file)) {
          continue;
        }
        
        filteredFiles.push(file);
        
      } catch (error) {
        console.warn(`⚠️  无法访问文件: ${file}`, error);
        continue;
      }
    }
    
    return filteredFiles;
  }

  /**
   * 检查文件类型是否有效
   */
  private isValidFileType(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath);
    
    // 检查扩展名
    if (this.options.fileTypes.some(type => 
      type.startsWith('.') ? ext === type : fileName === type
    )) {
      return true;
    }
    
    // 检查特殊文件名
    const specialFiles = [
      'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
      'package.json', 'tsconfig.json', 'eslint.config.js',
      'vite.config.ts', 'vite.config.js'
    ];
    
    return specialFiles.includes(fileName);
  }

  /**
   * 检查是否为二进制文件
   */
  private async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      // 读取文件的前 1024 字节
      const buffer = Buffer.alloc(1024);
      const fd = await fs.open(filePath, 'r');
      const { bytesRead } = await fd.read(buffer, 0, 1024, 0);
      await fd.close();
      
      // 检查是否包含 null 字节（二进制文件的特征）
      for (let i = 0; i < bytesRead; i++) {
        if (buffer[i] === 0) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      // 如果无法读取，假设是二进制文件
      return true;
    }
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 获取文件的相对路径
   */
  getRelativePath(filePath: string): string {
    return path.relative(this.options.rootPath, filePath);
  }

  /**
   * 获取文件类型
   */
  getFileType(filePath: string): string {
    const ext = path.extname(filePath);
    const fileName = path.basename(filePath);
    
    // 特殊文件类型
    if (fileName.startsWith('.env')) return 'environment';
    if (fileName === 'package.json') return 'package';
    if (fileName.includes('docker')) return 'docker';
    if (['.json', '.yaml', '.yml'].includes(ext)) return 'config';
    if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) return 'source';
    if (['.vue', '.html'].includes(ext)) return 'template';
    if (['.md', '.mdx'].includes(ext)) return 'documentation';
    if (['.css', '.scss', '.sass'].includes(ext)) return 'style';
    
    return 'other';
  }
}